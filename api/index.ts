console.log(">>> [BOOT] api/index.ts carregando...");

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import whatsappHandler from "./webhook-whatsapp.js";

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
if (!WHAPI_TOKEN) {
  console.warn(">>> [WHATSAPP] WHAPI_TOKEN não configurado no ambiente!");
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn(">>> [GEMINI] GEMINI_API_KEY não configurada no ambiente!");
} else {
  console.log(">>> [GEMINI] GEMINI_API_KEY detectada (tamanho: " + GEMINI_API_KEY.trim().length + ")");
}

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
    }

    try {
      dbAdmin = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
    } catch (e: any) {
      console.warn(`>>> [SISTEMA] Erro ao conectar no DB ${dbId}: ${e.message}. Tentando fallback...`);
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
        const customerPhone = session.customer_details?.phone;

        if (userId) {
          console.log(`>>> [STRIPE] Ativando assinatura para o usuário: ${userId}`);
          
          let nextPaymentDate = null;
          try {
            const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
            nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          } catch (e) {
            console.error(">>> [STRIPE] Erro ao buscar detalhes da assinatura:", e);
          }

          const updateData: any = {
            isActive: true,
            plan: "premium",
            subscriptionId: subscriptionId,
            nextPaymentDate: nextPaymentDate,
            lastPayment: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          if (customerPhone) {
            updateData.telefone = customerPhone.replace(/\D/g, "");
          }

          await db.collection("usuarios").doc(userId).set(updateData, { merge: true });

          // Enviar mensagem de boas-vindas/ajuda se tiver telefone
          const userDoc = await db.collection("usuarios").doc(userId).get();
          const userData = userDoc.data();
          const phoneToSend = updateData.telefone || userData?.telefone;

          if (phoneToSend) {
            console.log(`>>> [STRIPE] Enviando boas-vindas para: ${phoneToSend}`);
            const welcomeMsg = `🚀 *Bem-vindo ao ProcVisual Premium!*\n\nSeu pagamento foi confirmado e sua conta já está ativa. Agora você pode registrar despesas direto por aqui!\n\n📖 *Guia de Uso*\n\nVocê pode registrar despesas enviando:\n\n1️⃣ *Texto:* "Almoço 35.00" ou "Internet 120 amanhã"\n2️⃣ *Áudio:* Fale o que comprou e o valor.\n3️⃣ *Foto:* Envie uma foto do cupom fiscal ou comprovante.\n\n*Dica:* Para parcelas, diga algo como "Geladeira 2000 em 10x".`;
            await sendWhatsApp(phoneToSend, welcomeMsg);
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const userQuery = await db.collection("usuarios").where("subscriptionId", "==", subscriptionId).limit(1).get();
          if (!userQuery.empty) {
            let nextPaymentDate = null;
            try {
              const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
              nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
            } catch (e) {
              console.error(">>> [STRIPE] Erro ao buscar detalhes da assinatura no invoice:", e);
            }

            await userQuery.docs[0].ref.update({ 
              isActive: true, 
              nextPaymentDate: nextPaymentDate,
              lastPayment: admin.firestore.FieldValue.serverTimestamp() 
            });
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
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status;
        const isActive = status === 'active' || status === 'trialing';
        
        const userQuery = await db.collection("usuarios").where("subscriptionId", "==", subscription.id).limit(1).get();
        if (!userQuery.empty) {
          const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          await userQuery.docs[0].ref.update({ 
            isActive: isActive,
            nextPaymentDate: nextPaymentDate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
          console.log(`>>> [STRIPE] Assinatura ${subscription.id} atualizada. Status: ${status}, Ativo: ${isActive}`);
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

// New endpoint to fetch subscription details
app.get("/api/subscription-details", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: "UserId missing" });

  try {
    if (!dbAdmin) await initializeFirebaseAdmin();
    const userDoc = await dbAdmin!.collection("usuarios").doc(userId).get();
    const userData = userDoc.data();

    const isAdmin = (userData?.email || "").toLowerCase() === "adrianodiasilva@yahoo.com.br" || 
                    (userData?.email || "").toLowerCase() === "adrianodiasdasilva.silva@gmail.com";

    const isException = (userData?.telefone || "").replace(/\D/g, "").includes("19994792245");

    if (isAdmin || isException) {
      console.log(`>>> [API] Usuário ${isAdmin ? 'ADMIN' : 'EXCEÇÃO'} detectado: ${userData?.email || userData?.telefone}. Garantindo status ativo.`);
      await userDoc.ref.update({
        isActive: true,
        plan: 'premium',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.json({ status: 'active', plan: 'premium', isAdmin });
    }

    if (userData?.subscriptionId || userData?.stripeCustomerId) {
      try {
        if (userData.subscriptionId) {
          console.log(`>>> [API] Buscando assinatura via ID: ${userData.subscriptionId}`);
          const subscription = await getStripe().subscriptions.retrieve(userData.subscriptionId);
          const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';

          // Sync Firestore with latest Stripe data
          await userDoc.ref.update({ 
            nextPaymentDate,
            isActive,
            plan: 'premium',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          return res.json({ nextPaymentDate });
        } else if (userData.stripeCustomerId) {
          console.log(`>>> [API] Buscando assinatura via Customer ID: ${userData.stripeCustomerId}`);
          const subscriptions = await getStripe().subscriptions.list({
            customer: userData.stripeCustomerId,
            status: 'all',
            limit: 1
          });
          const subscription = subscriptions.data[0];
          if (subscription) {
            const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
            const isActive = subscription.status === 'active' || subscription.status === 'trialing';
            await userDoc.ref.update({ 
              subscriptionId: subscription.id,
              nextPaymentDate,
              isActive,
              plan: 'premium',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.json({ nextPaymentDate });
          }
        }
      } catch (e: any) {
        console.warn(`>>> [API] Erro ao buscar via ID ${userData.subscriptionId || userData.stripeCustomerId}, tentando via email...`);
        // Fallback to email search if ID fails
      }
    }

    // Try searching Stripe by email as fallback
    const emailsToTry = [
        userData?.email, 
        'adrianodiasilva@yahoo.com.br',
        'adrianodiasdasilva.silva@gmail.com'
      ].filter(Boolean);
      
      console.log(`>>> [API] Buscando assinatura para o usuário ${userId}. Emails:`, emailsToTry);
      
      for (const email of emailsToTry) {
        const customers = await getStripe().customers.list({
          email: email as string,
          limit: 1
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          // Fetch subscriptions separately to be sure
          const subscriptions = await getStripe().subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 5 // Check more than one to find the active one
          });

          // Sort subscriptions: active/trialing first, then by end date
          const sortedSubs = subscriptions.data.sort((a, b) => {
            const aActive = a.status === 'active' || a.status === 'trialing' ? 1 : 0;
            const bActive = b.status === 'active' || b.status === 'trialing' ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            return (b as any).current_period_end - (a as any).current_period_end;
          });

          const subscription = sortedSubs[0];
          if (subscription) {
            console.log(`>>> [API] Assinatura encontrada para ${email}: ${subscription.id} (Status: ${subscription.status})`);
            const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
            const isActive = subscription.status === 'active' || subscription.status === 'trialing';
            
            await userDoc.ref.update({ 
              subscriptionId: subscription.id,
              stripeCustomerId: customer.id,
              nextPaymentDate,
              isActive,
              plan: 'premium',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.json({ nextPaymentDate, source: 'email_search', email, status: subscription.status });
          }
        }
      }
      console.log(`>>> [API] Nenhuma assinatura encontrada para o usuário ${userId} após tentar todos os e-mails.`);
      
      // If we reach here, it means Stripe has no active subscription for this user
      // We should update isActive to false unless we have a valid internal calculation
      
      // Fallback: If we have lastPayment, calculate 30 days ahead as requested by user
      if (userData?.lastPayment) {
        const lastPay = userData.lastPayment.toDate ? userData.lastPayment.toDate() : new Date(userData.lastPayment);
        const nextDate = new Date(lastPay.getTime() + (30 * 24 * 60 * 60 * 1000));
        const now = new Date();
        
        if (nextDate > now) {
          console.log(`>>> [API] Usando cálculo interno (lastPayment + 30d): ${nextDate.toISOString()}`);
          await userDoc.ref.update({ 
            nextPaymentDate: nextDate.toISOString(),
            isActive: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return res.json({ nextPaymentDate: nextDate.toISOString(), source: 'internal_calculation' });
        }
      }

      // If no Stripe sub and no valid internal date, set to inactive
      await userDoc.ref.update({ 
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ nextPaymentDate: null, isActive: false, message: "Nenhuma assinatura ativa encontrada." });

    res.status(404).json({ error: "User not found" });
  } catch (error: any) {
    console.error(">>> [API] Erro ao buscar detalhes da assinatura:", error.message);
    res.status(500).json({ error: error.message });
  }
});

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
    PRICE_ID_EXISTS: !!process.env.VITE_STRIPE_PRICE_ID,
    WHAPI_TOKEN_EXISTS: !!process.env.WHAPI_TOKEN,
    GEMINI_KEY_EXISTS: !!process.env.GEMINI_API_KEY
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
      phone_number_collection: { enabled: true },
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

app.get("/api/admin/check-user", async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "Email é obrigatório" });
  
  if (!dbAdmin) await initializeFirebaseAdmin();
  if (!dbAdmin) return res.status(500).json({ error: "DB não disponível" });

  try {
    const snapshot = await dbAdmin.collection("usuarios").where("email", "==", email).get();
    if (snapshot.empty) return res.json({ found: false });
    
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ found: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/whapi-status", async (req, res) => {
  if (!WHAPI_TOKEN) return res.json({ success: false, error: "Token ausente" });
  try {
    const response = await fetch(`${WHAPI_BASE_URL}/health`, {
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}` }
    });
    const data = await response.json();
    res.json({ success: response.ok, data });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

app.post("/api/test-whatsapp", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone) return res.status(400).json({ error: "Telefone é obrigatório" });
  
  const result = await sendWhatsApp(phone, message || "Teste de conexão ProcVisual");
  res.json(result);
});

app.post("/api/webhook-whatsapp", async (req, res) => {
  try {
    console.log(">>> [WHATSAPP] Webhook atingido!");
    await whatsappHandler(req, res);
  } catch (err: any) {
    console.error(">>> [WHATSAPP] Erro no handler:", err.message);
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

app.post("/api/admin/run-notifications", async (req, res) => {
  console.log(">>> [ADMIN] Disparando notificações manualmente...");
  if (!dbAdmin) await initializeFirebaseAdmin();
  if (!dbAdmin) return res.status(500).json({ error: "DB não disponível" });

  try {
    const results = await runDailyNotifications();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function runDailyNotifications() {
  if (!dbAdmin) return { error: "DB não disponível" };
  
  const now = new Date();
  // Ajuste para Horário de Brasília (UTC-3)
  const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const todayStr = brazilTime.toISOString().split('T')[0];
  const today = new Date(todayStr + "T12:00:00");
  
  console.log(`>>> [JOB] Iniciando processamento para: ${todayStr}`);
  
  const snapshot = await dbAdmin.collection("lancamentos")
    .where("tipo", "in", ["expense", "birthday"])
    .get();

  if (snapshot.empty) {
    console.log(">>> [JOB] Nenhum lançamento encontrado.");
    return { processed: 0 };
  }

  let processed = 0;
  let notified = 0;

  for (const doc of snapshot.docs) {
    processed++;
    const data = doc.data();
    const userId = data.userId;

    if (!userId || userId === 'whatsapp_pending') continue;

    const userSnap = await dbAdmin.collection("usuarios").doc(userId).get();
    const userData = userSnap.data();

    if (!userData || userData.isActive === false) {
      continue; 
    }

    const telefone = userData.telefone;
    if (!telefone) continue;

    const vencimento = new Date(data.data + "T12:00:00");
    let diffDays = -1;

    if (data.tipo === 'birthday') {
      const bDay = vencimento.getDate();
      const bMonth = vencimento.getMonth();
      const tDay = today.getDate();
      const tMonth = today.getMonth();

      if (bDay === tDay && bMonth === tMonth) {
        diffDays = 0;
      } else {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (bDay === tomorrow.getDate() && bMonth === tomorrow.getMonth()) {
          diffDays = 1;
        }
      }
    } else {
      const diffTime = vencimento.getTime() - today.getTime();
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const valor = parseFloat(String(data.valor || 0).replace(',', '.'));
    const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    if (data.tipo === 'birthday') {
      if (diffDays === 1 && !data.notificadoAmanha) {
        const msg = `👀 *LEMBRETE:* Amanhã é aniversário de *${data.descricao || data.estabelecimento}*!`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await doc.ref.update({ notificadoAmanha: true });
          notified++;
        }
      }
      if (diffDays === 0 && !data.notificadoNoDia) {
        const msg = `🥳 *HOJE:* É aniversário de *${data.descricao || data.estabelecimento}*!`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await doc.ref.update({ notificadoNoDia: true });
          notified++;
        }
      }
    } else {
      // Apenas despesas não pagas
      if (data.pago === true) continue;

      if (diffDays === 5 && !data.notificado5dias) {
        const msg = `⚠️ *AVISO:* Sua despesa "${data.descricao || data.estabelecimento}" vence em 5 dias (R$ ${valorFormatado}).`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await doc.ref.update({ notificado5dias: true });
          notified++;
        }
      }
      if (diffDays === 0 && !data.notificadoNoDia) {
        const msg = `🚨 *VENCIMENTO:* Sua despesa "${data.descricao || data.estabelecimento}" vence HOJE (R$ ${valorFormatado}).`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await doc.ref.update({ notificadoNoDia: true });
          notified++;
        }
      }
    }
  }

  console.log(`>>> [JOB] Finalizado. Processados: ${processed}, Notificados: ${notified}`);
  return { processed, notified };
}

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
    // Roda às 08:00 e 09:00 para garantir (caso o servidor esteja acordando)
    cron.schedule("0 8,9 * * *", async () => {
      await runDailyNotifications();
    });
  });
}

export default app;
