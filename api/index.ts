console.log(">>> [BOOT] api/index.ts carregando...");

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('>>> [CRÍTICO] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('>>> [CRÍTICO] Uncaught Exception:', error);
});

const app = express();
const WHAPI_BASE_URL = "https://gate.whapi.cloud";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

// --- STRIPE CONFIG ---
let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    const key = (process.env.STRIPE_SECRET_KEY || "").trim();
    stripeInstance = new Stripe(key, {
      apiVersion: '2023-10-16' as any,
    });
  }
  return stripeInstance;
}

// --- FIREBASE ADMIN CONFIG ---
let dbAdmin: admin.firestore.Firestore | null = null;
let isInitializing = false;

async function initializeFirebaseAdmin() {
  if (dbAdmin) return dbAdmin;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return dbAdmin;
  }

  isInitializing = true;
  try {
    console.log(">>> [SISTEMA] Inicializando Firebase Admin...");
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    
    if (!fs.existsSync(configPath)) {
      console.error(">>> [SISTEMA] Erro: firebase-applet-config.json não encontrado!");
      isInitializing = false;
      return null;
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId;

    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
      console.log(">>> [SISTEMA] Firebase Admin inicializado.");
    }

    try {
      dbAdmin = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
      console.log(`>>> [SISTEMA] Firestore conectado (DB: ${dbId || 'default'}).`);
    } catch (e: any) {
      console.warn(`>>> [SISTEMA] Erro ao conectar no DB ${dbId}: ${e.message}`);
      dbAdmin = getFirestore();
    }

    isInitializing = false;
    return dbAdmin;
  } catch (error: any) {
    console.error(">>> [SISTEMA] Erro crítico na inicialização:", error.message);
    isInitializing = false;
    return null;
  }
}

// --- MIDDLEWARES ---

// 1. Stripe Webhook (MUST be before express.json)
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return res.status(400).send("Webhook Error: Assinatura ou Secret ausente.");
  }

  try {
    const event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(`>>> [STRIPE] Evento: ${event.type}`);
    
    if (!dbAdmin) await initializeFirebaseAdmin();
    if (!dbAdmin) throw new Error("Firebase Admin não disponível");

    const db = dbAdmin;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId) {
          console.log(`>>> [STRIPE] Ativando assinatura para o usuário: ${userId}`);
          await db.collection("usuarios").doc(userId).set({
            isActive: true,
            plan: "premium",
            subscriptionId: subscriptionId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const userQuery = await db.collection("usuarios").where("subscriptionId", "==", subscriptionId).limit(1).get();
          if (!userQuery.empty) {
            await userQuery.docs[0].ref.update({ isActive: true, lastPayment: admin.firestore.FieldValue.serverTimestamp() });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.id) {
          const userQuery = await db.collection("usuarios").where("subscriptionId", "==", subscription.id).limit(1).get();
          if (!userQuery.empty) {
            await userQuery.docs[0].ref.update({ isActive: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`>>> [STRIPE] Erro no Webhook: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// 2. Global JSON Body Parser (for all other routes)
app.use("/api", express.json({ limit: '10mb' }));

// 3. Request Logging
app.use((req, res, next) => {
  console.log(`>>> [REQUEST] ${req.method} ${req.url}`);
  next();
});

// 4. Lazy Firebase Init for API routes
app.use("/api", async (req, res, next) => {
  if (!dbAdmin && !["/health", "/debug-vars"].includes(req.path)) {
    await initializeFirebaseAdmin();
  }
  next();
});

// --- ROUTES ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", vercel: !!process.env.VERCEL });
});

app.get("/api/debug-vars", (req, res) => {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  res.json({
    STRIPE_KEY_EXISTS: !!key,
    STRIPE_KEY_PREFIX: key.substring(0, 3),
    STRIPE_KEY_LENGTH: key.length,
    NODE_ENV: process.env.NODE_ENV || "unknown",
    VERCEL: !!process.env.VERCEL,
    PRICE_ID_EXISTS: !!process.env.VITE_STRIPE_PRICE_ID
  });
});

app.post("/api/checkout", async (req, res) => {
  const { userId, email, priceId } = req.body;
  if (!userId || !email) return res.status(400).json({ error: "UserId e Email são obrigatórios." });

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId || process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      customer_email: email,
      metadata: { userId },
      success_url: `${req.headers.origin}/?payment=success`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro Checkout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/webhook-whatsapp", async (req, res) => {
  try {
    const { default: handler } = await import("./webhook-whatsapp.js");
    await handler(req, res);
  } catch (err: any) {
    console.error(">>> [WHATSAPP] Erro:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Helpers
async function sendWhatsApp(to: string, message: string) {
  if (!WHAPI_TOKEN) return { success: false, error: "Token ausente" };
  let cleanNumber = to.replace(/\D/g, "");
  if (cleanNumber.length === 10 || cleanNumber.length === 11) cleanNumber = "55" + cleanNumber;
  const recipient = `${cleanNumber}@s.whatsapp.net`;

  try {
    const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, body: message }),
    });
    return response.ok ? { success: true } : { success: false, error: await response.text() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

app.post("/api/notify-transaction", async (req, res) => {
  const { userId, data, phone } = req.body;
  if (!dbAdmin) await initializeFirebaseAdmin();
  if (!dbAdmin) return res.status(500).json({ error: "DB não disponível" });

  try {
    // Check if user is active
    const userSnap = await dbAdmin.collection("usuarios").doc(userId).get();
    const userData = userSnap.data();
    
    if (!userData || userData.isActive === false) {
      console.log(`>>> [NOTIFICAÇÃO] Bloqueada: Usuário ${userId} inativo.`);
      return res.status(403).json({ error: "Usuário inativo. Regularize seu pagamento." });
    }

    let telefone = phone || userData.telefone;
    if (!telefone) return res.status(400).json({ error: "Telefone não encontrado" });

    const valor = parseFloat(String(data.valor || 0).replace(',', '.'));
    const msg = `*REGISTRO:* ${data.descricao || "Despesa"}\n*Valor:* R$ ${valor.toFixed(2)}`;
    const result = await sendWhatsApp(telefone, msg);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Server initialization for non-Vercel environments
if (!process.env.VERCEL) {
  const PORT = 3000;
  initializeFirebaseAdmin().then(async () => {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log(">>> [SISTEMA] Configurando middleware do Vite...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`>>> [SISTEMA] Servidor rodando em http://0.0.0.0:${PORT}`);
    });
    
    // Cron Job (Local only)
    cron.schedule("0 8 * * *", async () => {
      console.log(">>> [JOB] Rodando notificações diárias...");
      if (!dbAdmin) return;

      try {
        const now = new Date();
        const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        const todayStr = brazilTime.toISOString().split('T')[0];
        const today = new Date(todayStr + "T12:00:00");

        const snapshot = await dbAdmin.collection("lancamentos")
          .where("tipo", "in", ["expense", "birthday"])
          .get();

        if (snapshot.empty) return;

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const userId = data.userId;

          // Check if user is active
          const userSnap = await dbAdmin.collection("usuarios").doc(userId).get();
          const userData = userSnap.data();

          if (!userData || userData.isActive === false) {
            continue; // Skip inactive users
          }

          const telefone = userData.telefone;
          if (!telefone) continue;

          // Notification logic (simplified version of what was there)
          const vencimento = new Date(data.data + "T12:00:00");
          const diffTime = vencimento.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          const valor = parseFloat(String(data.valor || 0).replace(',', '.'));
          const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

          if (data.tipo === 'birthday') {
            if (diffDays === 1 && !data.notificadoAmanha) {
              const msg = `👀 *LEMBRETE:* Amanhã é aniversário de *${data.descricao}*!`;
              const res = await sendWhatsApp(telefone, msg);
              if (res.success) await doc.ref.update({ notificadoAmanha: true });
            }
            if (diffDays === 0 && !data.notificadoNoDia) {
              const msg = `🥳 *HOJE:* É aniversário de *${data.descricao}*!`;
              const res = await sendWhatsApp(telefone, msg);
              if (res.success) await doc.ref.update({ notificadoNoDia: true });
            }
          } else {
            if (diffDays === 5 && !data.notificado5dias) {
              const msg = `⚠️ *AVISO:* Sua despesa "${data.descricao}" vence em 5 dias (R$ ${valorFormatado}).`;
              const res = await sendWhatsApp(telefone, msg);
              if (res.success) await doc.ref.update({ notificado5dias: true });
            }
            if (diffDays === 0 && !data.notificadoNoDia) {
              const msg = `🚨 *VENCIMENTO:* Sua despesa "${data.descricao}" vence HOJE (R$ ${valorFormatado}).`;
              const res = await sendWhatsApp(telefone, msg);
              if (res.success) await doc.ref.update({ notificadoNoDia: true });
            }
          }
        }
      } catch (err) {
        console.error(">>> [JOB] Erro:", err);
      }
    });
  });
}

export default app;
