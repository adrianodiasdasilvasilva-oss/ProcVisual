console.log(">>> [BOOT] api/index.ts carregando...");

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  limit, 
  serverTimestamp,
  FieldValue
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
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

// --- FIREBASE CLIENT CONFIG ---
let dbClient: any = null;
let authClient: any = null;
let isInitializing = false;

async function initializeFirebaseClient() {
  if (dbClient && authClient) return dbClient;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return dbClient;
  }

  isInitializing = true;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    
    if (!fs.existsSync(configPath)) {
      console.error(">>> [SISTEMA] Erro: firebase-applet-config.json não encontrado!");
      isInitializing = false;
      return null;
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = initializeApp(firebaseConfig);
    
    // Use initializeFirestore with long polling to avoid gRPC issues in Node
    dbClient = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);

    // Skip anonymous auth (not enabled by default)
    authClient = getAuth(app);
    console.log(">>> [SISTEMA] Firebase Client inicializado.");

    isInitializing = false;
    return dbClient;
  } catch (error: any) {
    console.error(">>> [SISTEMA] Erro crítico na inicialização:", error.message);
    isInitializing = false;
    throw error;
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
    
    const db = await initializeFirebaseClient();
    if (!db) throw new Error("Firebase Client não disponível");

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
            lastPayment: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          if (customerPhone) {
            updateData.telefone = customerPhone.replace(/\D/g, "");
          }

          await setDoc(doc(db, "usuarios", userId), updateData, { merge: true });

          // Enviar mensagem de boas-vindas/ajuda se tiver telefone
          const userSnap = await getDoc(doc(db, "usuarios", userId));
          const userData = userSnap.data();
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
          const q = query(collection(db, "usuarios"), where("subscriptionId", "==", subscriptionId), limit(1));
          const userQuery = await getDocs(q);
          if (!userQuery.empty) {
            let nextPaymentDate = null;
            try {
              const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
              nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
            } catch (e) {
              console.error(">>> [STRIPE] Erro ao buscar detalhes da assinatura no invoice:", e);
            }

            await updateDoc(userQuery.docs[0].ref, { 
              isActive: true, 
              nextPaymentDate: nextPaymentDate,
              lastPayment: serverTimestamp() 
            });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.id) {
          const q = query(collection(db, "usuarios"), where("subscriptionId", "==", subscription.id), limit(1));
          const userQuery = await getDocs(q);
          if (!userQuery.empty) {
            await updateDoc(userQuery.docs[0].ref, { isActive: false, updatedAt: serverTimestamp() });
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status;
        const isActive = status === 'active' || status === 'trialing';
        
        const q = query(collection(db, "usuarios"), where("subscriptionId", "==", subscription.id), limit(1));
        const userQuery = await getDocs(q);
        if (!userQuery.empty) {
          const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          await updateDoc(userQuery.docs[0].ref, { 
            isActive: isActive,
            nextPaymentDate: nextPaymentDate,
            updatedAt: serverTimestamp() 
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
    const db = await initializeFirebaseClient();
    if (!db) return res.status(500).json({ error: "DB não disponível" });

    const userSnap = await getDoc(doc(db, "usuarios", userId));
    const userData = userSnap.data();

    const isAdmin = (userData?.email || "").toLowerCase() === "adrianodiasilva@yahoo.com.br" || 
                    (userData?.email || "").toLowerCase() === "adrianodiasdasilva.silva@gmail.com";

    const isException = (userData?.telefone || "").replace(/\D/g, "").includes("19994792245");

    if (isAdmin || isException) {
      console.log(`>>> [API] Usuário ${isAdmin ? 'ADMIN' : 'EXCEÇÃO'} detectado: ${userData?.email || userData?.telefone}. Garantindo status ativo.`);
      await updateDoc(userSnap.ref, {
        isActive: true,
        plan: 'premium',
        updatedAt: serverTimestamp()
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
          await updateDoc(userSnap.ref, { 
            nextPaymentDate,
            isActive,
            plan: 'premium',
            updatedAt: serverTimestamp()
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
            await updateDoc(userSnap.ref, { 
              subscriptionId: subscription.id,
              nextPaymentDate,
              isActive,
              plan: 'premium',
              updatedAt: serverTimestamp()
            });
            return res.json({ nextPaymentDate });
          }
        }
      } catch (e: any) {
        console.warn(`>>> [API] Erro ao buscar via ID ${userData.subscriptionId || userData.stripeCustomerId}, tentando via email...`);
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
          const subscriptions = await getStripe().subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 5
          });

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
            
            await updateDoc(userSnap.ref, { 
              subscriptionId: subscription.id,
              stripeCustomerId: customer.id,
              nextPaymentDate,
              isActive,
              plan: 'premium',
              updatedAt: serverTimestamp()
            });
            return res.json({ nextPaymentDate, source: 'email_search', email, status: subscription.status });
          }
        }
      }
      
      if (userData?.lastPayment) {
        const lastPay = userData.lastPayment.toDate ? userData.lastPayment.toDate() : new Date(userData.lastPayment);
        const nextDate = new Date(lastPay.getTime() + (30 * 24 * 60 * 60 * 1000));
        const now = new Date();
        
        if (nextDate > now) {
          await updateDoc(userSnap.ref, { 
            nextPaymentDate: nextDate.toISOString(),
            isActive: true,
            updatedAt: serverTimestamp()
          });
          return res.json({ nextPaymentDate: nextDate.toISOString(), source: 'internal_calculation' });
        }
      }

      await updateDoc(userSnap.ref, { 
        isActive: false,
        updatedAt: serverTimestamp()
      });

      return res.json({ nextPaymentDate: null, isActive: false, message: "Nenhuma assinatura ativa encontrada." });
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
  if (!dbClient && !["/health", "/debug-vars"].includes(req.path)) {
    await initializeFirebaseClient();
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
  
  const db = await initializeFirebaseClient();
  if (!db) return res.status(500).json({ error: "DB não disponível" });

  try {
    const q = query(collection(db, "usuarios"), where("email", "==", email));
    const snapshot = await getDocs(q);
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
  const db = await initializeFirebaseClient();
  if (!db) return res.status(500).json({ error: "DB não disponível" });

  try {
    // Check if user is active
    const userSnap = await getDoc(doc(db, "usuarios", userId));
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
  try {
    const db = await initializeFirebaseClient();
    if (!db) {
      return res.status(500).json({ error: "DB não disponível (null)" });
    }
    const results = await runDailyNotifications();
    res.json({ success: true, results });
  } catch (err: any) {
    console.error(">>> [ADMIN] Erro fatal:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

async function runDailyNotifications() {
  let step = "start";
  try {
    const db = await initializeFirebaseClient();
    step = "db_initialized";
    if (!db) return { error: "DB não disponível" };
    
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];
    const today = new Date(todayStr + "T12:00:00Z");
    
    console.log(`>>> [JOB] Iniciando processamento para: ${todayStr} (UTC: ${today.toISOString()})`);
    
    step = "query_lancamentos";
    const q = query(collection(db, "lancamentos"), where("tipo", "in", ["expense", "birthday", "despesa"]), limit(500));
    const snapshot = await getDocs(q);
    console.log(`>>> [JOB] Snapshot obtido com ${snapshot.size} documentos.`);

    if (snapshot.empty) {
      console.log(">>> [JOB] Nenhum lançamento encontrado.");
      return { processed: 0 };
    }

    let processed = 0;
    let notified = 0;

    for (const docSnap of snapshot.docs) {
      processed++;
      const data = docSnap.data();
      const userId = data.userId;

      if (!userId || userId === 'whatsapp_pending') continue;

      step = `get_user_${userId}`;
      const userSnap = await getDoc(doc(db, "usuarios", userId));
      const userData = userSnap.data();

    // Permitir admin mesmo se inativo (para testes) ou se for a exceção
    const isAdmin = (userData?.email || "").toLowerCase() === "adrianodiasilva@yahoo.com.br" || 
                    (userData?.email || "").toLowerCase() === "adrianodiasdasilva.silva@gmail.com";
    const isException = (userData?.telefone || data.telefone || "").replace(/\D/g, "").includes("19994792245");

    if (!userData || (userData.isActive === false && !isAdmin && !isException)) {
      console.log(`>>> [JOB] Lançamento ${docSnap.id} ignorado: Usuário ${userId} inativo e não é admin/exceção.`);
      continue; 
    }

    const telefone = userData.telefone || data.telefone;
    if (!telefone) {
      console.log(`>>> [JOB] Lançamento ${docSnap.id} ignorado: Telefone não encontrado.`);
      continue;
    }

    // Data do lançamento (YYYY-MM-DD)
    const vencimento = new Date(data.data + "T12:00:00Z");
    let diffDays = -1;

    if (data.tipo === 'birthday') {
      const bDay = vencimento.getUTCDate();
      const bMonth = vencimento.getUTCMonth();
      const tDay = today.getUTCDate();
      const tMonth = today.getUTCMonth();

      if (bDay === tDay && bMonth === tMonth) {
        diffDays = 0;
      } else {
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(today.getUTCDate() + 1);
        if (bDay === tomorrow.getUTCDate() && bMonth === tomorrow.getUTCMonth()) {
          diffDays = 1;
        }
      }
    } else {
      const diffTime = vencimento.getTime() - today.getTime();
      diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    const valor = parseFloat(String(data.valor || 0).replace(',', '.'));
    const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    console.log(`>>> [JOB] Analisando: ${data.descricao} | Venc: ${data.data} | Diff: ${diffDays} dias`);

    if (data.tipo === 'birthday') {
      if (diffDays === 1 && !data.notificadoAmanha) {
        const msg = `👀 *LEMBRETE:* Amanhã é aniversário de *${data.descricao || data.estabelecimento}*!`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await updateDoc(docSnap.ref, { notificadoAmanha: true });
          notified++;
        } else {
          console.error(`>>> [JOB] Erro ao enviar WhatsApp (Aniversário Amanhã) para ${telefone}:`, res.error);
        }
      }
      if (diffDays === 0 && !data.notificadoNoDia) {
        const msg = `🥳 *HOJE:* É aniversário de *${data.descricao || data.estabelecimento}*!`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await updateDoc(docSnap.ref, { notificadoNoDia: true });
          notified++;
        } else {
          console.error(`>>> [JOB] Erro ao enviar WhatsApp (Aniversário Hoje) para ${telefone}:`, res.error);
        }
      }
    } else {
      // Apenas despesas não pagas
      if (data.pago === true) continue;

      if (diffDays === 5 && !data.notificado5dias) {
        const msg = `⚠️ *AVISO:* Sua despesa "${data.descricao || data.estabelecimento}" vence em 5 dias (R$ ${valorFormatado}).`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await updateDoc(docSnap.ref, { notificado5dias: true });
          notified++;
        } else {
          console.error(`>>> [JOB] Erro ao enviar WhatsApp (Vencimento 5 dias) para ${telefone}:`, res.error);
        }
      }
      if (diffDays === 0 && !data.notificadoNoDia) {
        const msg = `🚨 *VENCIMENTO:* Sua despesa "${data.descricao || data.estabelecimento}" vence HOJE (R$ ${valorFormatado}).`;
        const res = await sendWhatsApp(telefone, msg);
        if (res.success) {
          await updateDoc(docSnap.ref, { notificadoNoDia: true });
          notified++;
        } else {
          console.error(`>>> [JOB] Erro ao enviar WhatsApp (Vencimento Hoje) para ${telefone}:`, res.error);
        }
      }
    }
  }

  console.log(`>>> [JOB] Finalizado. Processados: ${processed}, Notificados: ${notified}`);
  return { processed, notified };
  } catch (e: any) {
    console.error(`>>> [JOB] Erro no passo ${step}:`, e.message);
    throw new Error(`[Step: ${step}] ${e.message}`);
  }
}

// Server initialization for non-Vercel environments
if (!process.env.VERCEL) {
  const PORT = 3000;
  
  const startServer = async () => {
    try {
      await initializeFirebaseClient();
    } catch (e: any) {
      console.error(">>> [BOOT] Erro ao inicializar Firebase em segundo plano:", e.message);
    }

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
    cron.schedule("0 8,9,10 * * *", async () => {
      console.log(">>> [CRON] Iniciando tarefa agendada de notificações...");
      try {
        await runDailyNotifications();
      } catch (err) {
        console.error(">>> [CRON] Erro ao rodar notificações:", err);
      }
    });
  };

  startServer();
}

export default app;
