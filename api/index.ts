console.log(">>> [BOOT] api/index.ts carregando...");

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs";
import { initializeFirebaseAdmin, admin, FieldValue } from "./firebase-admin.js";
import Stripe from "stripe";
// import { createServer as createViteServer } from "vite"; // Dynamic import used below
import whatsappHandler from "./webhook-whatsapp.js";

dotenv.config();

// Constants for shared logic
export const ADMIN_EMAILS = [
  "adrianodiasdasilva@yahoo.com.br",
  "adrianodiasdasilva.silva@gmail.com"
];

export const ADMIN_USER_IDS = [
  "24cC8kguY3X3IwSwfh6tTAKmJOK2",
  "o60eUYDOD6WD4o1j8YBZoOXqfiR2",
  "uCpsT3N8pAWWzAsP74qKqPTeYAt2"
];

export function isUserAdmin(uid: string, email?: string) {
  if (ADMIN_USER_IDS.includes(uid)) return true;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  return false;
}

export function isPhoneException(phone?: string) {
  if (!phone) return false;
  return phone.replace(/\D/g, "").includes("19994792245");
}

// Global Cache for Firebase Admin
let dbAdmin: any = null; 

async function logCronExecution(status: string, results?: any) {
  try {
    const db = await initializeFirebaseAdmin();
    if (!db) return;
    await db.collection("config").doc("lastCronRun").set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status,
      results: results || {},
      environment: process.env.NODE_ENV || 'unknown'
    }, { merge: true });
  } catch (e) {
    console.error(">>> [CRON] Erro ao logar execução:", e);
  }
}

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

// --- FIREBASE CLIENT (Legacy/Shared logic if needed - now using admin for backend) ---
async function initializeFirebaseClient() {
  return initializeFirebaseAdmin();
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
    
    const db = await initializeFirebaseAdmin();
    if (!db) throw new Error("Firebase Admin não disponível");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        let userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerPhone = session.customer_details?.phone;
        const stripeCustomerId = session.customer as string;

        console.log(`>>> [STRIPE] Sessão Completada. User Metadata: ${userId}, Email: ${customerEmail}, Sub: ${subscriptionId}`);

        // Fallback: Tentar encontrar usuário pelo email se o userId sumir do metadado
        if (!userId && customerEmail) {
          console.log(`>>> [STRIPE] Metadado userId ausente. Buscando usuário pelo email: ${customerEmail}`);
          const userQuery = await db.collection("usuarios")
            .where("email", "==", customerEmail)
            .limit(1)
            .get();
          
          if (!userQuery.empty) {
            userId = userQuery.docs[0].id;
            console.log(`>>> [STRIPE] Usuário encontrado via email match: ${userId}`);
          } else {
            // Tentar busca secundária
            const userQuery2 = await db.collection("usuarios")
              .where("stripeEmail", "==", customerEmail)
              .limit(1)
              .get();
            if (!userQuery2.empty) {
              userId = userQuery2.docs[0].id;
              console.log(`>>> [STRIPE] Usuário encontrado via stripeEmail match: ${userId}`);
            }
          }
        }

        if (userId) {
          console.log(`>>> [STRIPE] Ativando assinatura para o usuário: ${userId}`);
          
          let nextPaymentDate = null;

          try {
            const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
            nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          } catch (e: any) {
            console.error(">>> [STRIPE] Erro ao buscar detalhes da assinatura:", e.message);
          }

          const updateData: any = {
            isActive: true,
            plan: "premium",
            subscriptionId: subscriptionId,
            stripeCustomerId: stripeCustomerId,
            valorAssinatura: session.amount_total ? session.amount_total / 100 : 0,
            nextPaymentDate: nextPaymentDate,
            dataAssinatura: FieldValue.serverTimestamp(),
            lastPayment: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          };

          if (customerPhone) {
            updateData.telefone = customerPhone.replace(/\D/g, "");
          }
          
          if (customerEmail) {
            updateData.stripeEmail = customerEmail;
          }

          await db.collection("usuarios").doc(userId).set(updateData, { merge: true });
          console.log(`>>> [STRIPE] Documento do usuário ${userId} atualizado com sucesso.`);

          // Enviar mensagem de boas-vindas/ajuda se tiver telefone
          const userDoc = await db.collection("usuarios").doc(userId).get();
          const userData = userDoc.data();
          const phoneToSend = updateData.telefone || userData?.telefone;

          if (phoneToSend) {
            console.log(`>>> [STRIPE] Enviando boas-vindas para: ${phoneToSend}`);
            const welcomeMsg = `🚀 *Bem-vindo ao ProcVisual Premium!*\n\nSeu pagamento foi confirmado e sua conta já está ativa. Agora você pode registrar despesas direto por aqui!\n\n📖 *Guia de Uso*\n\nVocê pode registrar despesas enviando:\n\n1️⃣ *Texto:* "Almoço 35.00" ou "Internet 120 amanhã"\n2️⃣ *Áudio:* Fale o que comprou e o valor.\n3️⃣ *Foto:* Envie uma foto do cupom fiscal ou comprovante.\n\n*Dica:* Para parcelas, diga algo como "Geladeira 2000 em 10x".`;
            await sendWhatsApp(phoneToSend, welcomeMsg);
          }
        } else {
          console.error(`>>> [STRIPE] CRÍTICO: Não foi possível vincular o pagamento ao usuário. Email: ${customerEmail}`);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const userQuery = await db.collection("usuarios")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();
            
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
              valorAssinatura: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
              dataAssinatura: FieldValue.serverTimestamp(),
              lastPayment: FieldValue.serverTimestamp() 
            });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.id) {
          const userQuery = await db.collection("usuarios")
            .where("subscriptionId", "==", subscription.id)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            await userQuery.docs[0].ref.update({ 
              isActive: false, 
              updatedAt: FieldValue.serverTimestamp() 
            });
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status;
        const isActive = status === 'active' || status === 'trialing';
        
        const userQuery = await db.collection("usuarios")
          .where("subscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (!userQuery.empty) {
          const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
          await userQuery.docs[0].ref.update({ 
            isActive: isActive,
            nextPaymentDate: nextPaymentDate,
            updatedAt: FieldValue.serverTimestamp() 
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
    const db = await initializeFirebaseAdmin();
    if (!db) return res.status(500).json({ error: "DB não disponível" });

    const userDoc = await db.collection("usuarios").doc(userId).get();
    const userData = userDoc.data();

    // BLOQUEIO MANUAL: Se o admin desativou, não deixa o Stripe reativar sozinho
    if (userData?.manuallyBlocked === true) {
      console.log(`>>> [API-SUBS] Bloqueio manual ativo para ${userId}. Recusando reativação automática.`);
      return res.json({ 
        status: 'blocked', 
        isActive: false, 
        message: "Sua conta foi desativada por um administrador. Favor entrar em contato." 
      });
    }

    const isAdmin = isUserAdmin(userId, userData?.email);
    const isException = isPhoneException(userData?.telefone);

    console.log(`>>> [API-SUBS] Verificando User: ${userId} | Email: ${userData?.email} | Admin: ${isAdmin} | Exceção: ${isException}`);

    if (isAdmin || isException) {
      console.log(`>>> [API-SUBS] Acesso priviligiado detectado (Admin/Exceção). Forçando Ativo.`);
      await userDoc.ref.set({
        isActive: true,
        plan: 'premium',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return res.json({ status: 'active', plan: 'premium', isAdmin, source: 'admin_check' });
    }

    // 1. Tentar via subscriptionId direto
    if (userData?.subscriptionId) {
      try {
        console.log(`>>> [API-SUBS] Buscando via SubID: ${userData.subscriptionId}`);
        const subscription = await getStripe().subscriptions.retrieve(userData.subscriptionId);
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const nextPaymentDate = new Date((subscription as any).current_period_end * 1000).toISOString();
        
        // Atualizar data da assinatura detectada no Stripe
        const stripeStartDate = new Date((subscription as any).start_date * 1000);
        const updateObj: any = { 
          nextPaymentDate,
          isActive,
          plan: 'premium',
          dataAssinatura: admin.firestore.Timestamp.fromDate(stripeStartDate),
          updatedAt: FieldValue.serverTimestamp()
        };

        await userDoc.ref.set(updateObj, { merge: true });

        if (isActive) return res.json({ 
          status: 'active', 
          plan: 'premium', 
          isActive, 
          nextPaymentDate, 
          dataAssinatura: stripeStartDate.toISOString(),
          source: 'sub_id' 
        });
      } catch (e: any) {
        console.warn(`>>> [API-SUBS] Erro SubID ${userData.subscriptionId}:`, e.message);
      }
    }

    // 2. Tentar via stripeCustomerId
    if (userData?.stripeCustomerId) {
      try {
        console.log(`>>> [API-SUBS] Buscando via CustomerID: ${userData.stripeCustomerId}`);
        const subs = await getStripe().subscriptions.list({
          customer: userData.stripeCustomerId,
          status: 'active',
          limit: 1
        });
        
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          const nextPaymentDate = new Date((sub as any).current_period_end * 1000).toISOString();
          const stripeStartDate = new Date((sub as any).start_date * 1000);
          
          const updateObj: any = { 
            subscriptionId: sub.id,
            nextPaymentDate,
            isActive: true,
            plan: 'premium',
            dataAssinatura: admin.firestore.Timestamp.fromDate(stripeStartDate),
            updatedAt: FieldValue.serverTimestamp()
          };

          await userDoc.ref.set(updateObj, { merge: true });
          return res.json({ 
            status: 'active', 
            plan: 'premium', 
            isActive: true, 
            nextPaymentDate, 
            dataAssinatura: stripeStartDate.toISOString(),
            source: 'customer_id' 
          });
        }
      } catch (e: any) {
        console.warn(`>>> [API-SUBS] Erro CustomerID ${userData.stripeCustomerId}:`, e.message);
      }
    }

    // 3. Tentar via Email Search (Fallback agressivo)
    const emailsToTry = Array.from(new Set([
      userData?.email,
      userData?.stripeEmail,
      'adrianodiasdasilva@yahoo.com.br',
      'adrianodiasdasilva.silva@gmail.com'
    ])).filter(Boolean);

    console.log(`>>> [API-SUBS] Busca agressiva por email:`, emailsToTry);

    for (const email of emailsToTry) {
      try {
        const customers = await getStripe().customers.list({ email: email as string, limit: 1 });
        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const subs = await getStripe().subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1
          });

          if (subs.data.length > 0) {
            const sub = subs.data[0];
            console.log(`>>> [API-SUBS] Sucesso! Assinatura encontrada para ${email}`);
            const nextPaymentDate = new Date((sub as any).current_period_end * 1000).toISOString();
            const stripeStartDate = new Date((sub as any).start_date * 1000);
            
            const updateObj: any = { 
              subscriptionId: sub.id,
              stripeCustomerId: customer.id,
              stripeEmail: email,
              nextPaymentDate,
              isActive: true,
              plan: 'premium',
              dataAssinatura: admin.firestore.Timestamp.fromDate(stripeStartDate),
              updatedAt: FieldValue.serverTimestamp()
            };
            
            await userDoc.ref.set(updateObj, { merge: true });

            return res.json({ 
              status: 'active', 
              plan: 'premium', 
              isActive: true, 
              nextPaymentDate, 
              dataAssinatura: stripeStartDate.toISOString(),
              source: 'email_search', 
              email 
            });
          }
        }
      } catch (e: any) {
        console.warn(`>>> [API-SUBS] Erro busca email ${email}:`, e.message);
      }
    }

    // 4. Último suspiro: Verificar se houve pagamento recente mas sem assinatura recorrente (Checkout avulso se houver)
    // (Omitido por enquanto para focar em assinaturas)

    console.log(`>>> [API-SUBS] Nenhuma assinatura encontrada para o usuário ${userId}`);
    await userDoc.ref.set({ isActive: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ status: 'inactive', isActive: false, userId });

  } catch (error: any) {
    console.error(">>> [API-SUBS] Erro Crítico:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Request Logging
app.use((req, res, next) => {
  console.log(`>>> [REQUEST] ${req.method} ${req.url}`);
  next();
});

// Novo: Robô de auto-despertar (Garante execução diária caso o cron interno falhe/durma)
let lastWakeupCheck = 0;
app.use(async (req, res, next) => {
  const now = Date.now();
  // Evitar checar o banco em cada requisição (limite de 1 check a cada 10 min)
  if (now - lastWakeupCheck < 10 * 60 * 1000) return next();
  lastWakeupCheck = now;

  try {
    const db = await initializeFirebaseAdmin();
    if (!db) return next();

    const lastRunDoc = await db.collection("config").doc("lastCronRun").get();
    const lastRun = lastRunDoc.data();
    
    const nowBr = new Date(now - (3 * 60 * 60 * 1000));
    const todayStr = nowBr.toISOString().split('T')[0];
    const hourBr = nowBr.getUTCHours();

    let needsRun = false;
    if (!lastRun || !lastRun.timestamp) {
      needsRun = true;
    } else {
      const lastRunDate = lastRun.timestamp.toDate();
      const lastRunBr = new Date(lastRunDate.getTime() - (3 * 60 * 60 * 1000));
      const lastRunStr = lastRunBr.toISOString().split('T')[0];
      
      // Se a última execução não foi hoje e já passou das 08:00 Brasília
      if (lastRunStr !== todayStr && hourBr >= 8) {
        needsRun = true;
      }
    }

    if (needsRun && hourBr >= 8 && hourBr <= 22) {
      console.log(`>>> [ROBÔ] Despertando sistema! Verificado que hoje (${todayStr}) as notificações ainda não rodaram.`);
      // Executa em background para não atrasar a resposta do usuário
      runDailyNotifications().catch(e => console.error(">>> [ROBÔ] Erro na execução automática:", e));
    }
  } catch (e) {
    console.error(">>> [ROBÔ] Erro ao verificar agendamento:", e);
  }
  next();
});

// 4. Lazy Firebase Init for API routes
app.use("/api", async (req, res, next) => {
  if (!admin.apps.length && !["/health", "/debug-vars"].includes(req.path)) {
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
  const { userId, email, phone, priceId } = req.body;
  if (!userId || !email) return res.status(400).json({ error: "UserId e Email são obrigatórios." });

  try {
    const sessionOptions: any = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId || process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      customer_email: email,
      metadata: { userId },
      success_url: `${req.headers.origin}/?payment=success`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    };

    const session = await getStripe().checkout.sessions.create(sessionOptions);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro Checkout:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/check-user", async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "Email é obrigatório" });
  
  const db = await initializeFirebaseAdmin();
  if (!db) return res.status(500).json({ error: "DB não disponível" });

  try {
    const snapshot = await db.collection("usuarios")
      .where("email", "==", email)
      .get();
      
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
    console.log(">>> [WHATSAPP] Payload length:", JSON.stringify(req.body).length);
    await whatsappHandler(req, res);
  } catch (err: any) {
    console.error(">>> [WHATSAPP] Erro no handler:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/webhook-debug", (req, res) => {
  console.log(">>> [DEBUG-WEBHOOK] Método:", req.method);
  console.log(">>> [DEBUG-WEBHOOK] Headers:", JSON.stringify(req.headers));
  console.log(">>> [DEBUG-WEBHOOK] Body:", JSON.stringify(req.body, null, 2));
  res.json({ status: "received", body_type: typeof req.body });
});

// WhatsApp Helpers
async function sendWhatsApp(to: string, message: string) {
  if (!WHAPI_TOKEN) return { success: false, error: "Token ausente" };
  
  // Robust number cleaning (A mesma lógica de sucesso do registro de despesas)
  let cleanNumber = to.replace(/\D/g, "");
  
  // Se começar com 55 e tiver 12 ou 13 dígitos, assume-se que já está no formato internacional
  // Caso contrário, tenta-se normalizar para 55 + número
  if (cleanNumber.length === 10 || cleanNumber.length === 11) {
    cleanNumber = "55" + cleanNumber;
  } else if (cleanNumber.length > 11 && !cleanNumber.startsWith("55")) {
    // Caso seja um número internacional que não começa com 55 (improvável no contexto do usuário)
    // Deixa passar como está
  }
  
  const recipient = `${cleanNumber}@s.whatsapp.net`;
  console.log(`>>> [WHATSAPP] Enviando para: ${recipient}`);

  try {
    const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${WHAPI_TOKEN}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        to: recipient, 
        body: message,
        typing_time: 2 // Adiciona um pequeno delay de digitação para parecer mais humano
      }),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`>>> [WHATSAPP] Erro Whapi (${response.status}):`, errText);
      return { success: false, error: errText };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`>>> [WHATSAPP] Erro de conexão:`, error.message);
    return { success: false, error: error.message };
  }
}

app.post("/api/notify-transaction", async (req, res) => {
  const { userId, data, phone } = req.body;
  const db = await initializeFirebaseAdmin();
  if (!db) return res.status(500).json({ error: "DB não disponível" });

  try {
    // Check if user is active
    const userDoc = await db.collection("usuarios").doc(userId).get();
    const userData = userDoc.data();
    
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

app.post("/api/admin/run-notifications", async (req, res, next) => {
  try {
    const { userId } = req.body;
    console.log(`>>> [ADMIN] Disparando notificações manualmente... ${userId ? `(Para usuário: ${userId})` : '(Geral)'}`);
    
    const db = await initializeFirebaseAdmin();
    if (!db) {
      return res.status(500).json({ error: "DB não disponível (null)" });
    }
    const results = await runDailyNotifications(userId);
    res.json({ success: true, results });
  } catch (err: any) {
    console.error(">>> [ADMIN] Erro fatal em run-notifications:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.post("/api/admin/test-whatsapp", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, error: "Número ausente" });
  
  try {
    const msg = "✅ *Teste de Integração ProcVisual*\n\nSeu sistema de notificações via WhatsApp está funcionando corretamente! 🚀";
    const result = await sendWhatsApp(to, msg);
    res.json(result);
  } catch (err: any) {
    console.error(">>> [ADMIN] Erro em test-whatsapp:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/send-custom-message", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ error: "UserId e Mensagem são obrigatórios" });

  try {
    const db = await initializeFirebaseAdmin();
    if (!db) return res.status(500).json({ error: "DB não disponível" });

    const userDoc = await db.collection("usuarios").doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "Usuário não encontrado" });

    const userData = userDoc.data();
    const phone = userData?.telefone;
    if (!phone) return res.status(400).json({ error: "Usuário não possui telefone cadastrado" });

    console.log(`>>> [ADMIN] Enviando mensagem customizada para ${userId} (${phone})`);
    const result = await sendWhatsApp(phone, message);
    res.json(result);
  } catch (err: any) {
    console.error(">>> [ADMIN] Erro ao enviar mensagem customizada:", err);
    res.status(500).json({ error: err.message });
  }
});

// Final catch-all for /api routes to prevent HTML response
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global API error handler
app.use((err: any, req: any, res: any, next: any) => {
  if (req.path.startsWith('/api')) {
    console.error(">>> [API ERROR]", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
  next(err);
});

async function runDailyNotifications(targetUserId?: string) {
  let step = "start";
  try {
    const db = await initializeFirebaseAdmin();
    step = "db_initialized";
    if (!db) return { error: "DB não disponível", processed: 0, notified: 0 };
    
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];
    const today = new Date(todayStr + "T12:00:00Z");
    
    console.log(`>>> [JOB] Ativado em: ${now.toISOString()} | Brasília: ${todayStr} | Target: ${targetUserId || 'Todos'}`);
    
    // Log de início no Firestore para monitoramento
    if (!targetUserId) await logCronExecution("started");

    step = "query_lancamentos";
    let query: admin.firestore.Query;
    if (targetUserId) {
      query = db.collection("lancamentos")
        .where("userId", "==", targetUserId)
        .where("tipo", "in", ["expense", "birthday", "despesa"])
        .where("pago", "==", false);
    } else {
      // Para todos, focamos nos não pagos
      // E podemos filtrar por data para não pegar lixo antigo (ex: data >= hoje - 5 dias)
      const fiveDaysAgo = new Date(today.getTime() - (5 * 24 * 60 * 60 * 1000));
      const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
      
      query = db.collection("lancamentos")
        .where("tipo", "in", ["expense", "birthday", "despesa"])
        .where("pago", "==", false)
        .where("data", ">=", fiveDaysAgoStr);
    }
    
    const snapshot = await query.limit(500).get();
    console.log(`>>> [JOB] Localizados ${snapshot.size} lançamentos para análise.`);

    if (snapshot.empty) {
      console.log(">>> [JOB] Nenhum lançamento encontrado.");
      return { processed: 0, notified: 0 };
    }

    let processed = 0;
    let notified = 0;
    
    const userCache: Record<string, any> = {};

    for (const docSnap of snapshot.docs) {
      processed++;
      const data = docSnap.data();
      const userId = data.userId;

      if (!userId || userId === 'whatsapp_pending') continue;

      step = `get_user_${userId}`;
      
      let userData = userCache[userId];
      if (!userData) {
        const userDoc = await db.collection("usuarios").doc(userId).get();
        userData = userDoc.exists ? userDoc.data() : { _not_found: true };
        userCache[userId] = userData;
      }

      if (userData._not_found) continue;

      const isAdmin = isUserAdmin(userId, userData?.email);
      const isException = isPhoneException(userData?.telefone || data.telefone);

      // Se o usuário estiver inativo e não for admin/exceção, pula
      if (userData.isActive === false && !isAdmin && !isException) {
        console.log(`>>> [JOB] Ignorado: Usuário ${userId} (${userData.email}) inativo e sem privilégios.`);
        continue; 
      }

      const telefone = userData.telefone || data.telefone;
      if (!telefone) {
        console.log(`>>> [JOB] Ignorado: Telefone não encontrado para despesa ${docSnap.id} do usuário ${userId}.`);
        continue;
      }

      // Sanitização e parsing da data do lançamento
      let dataLancamento = data.data;
      if (dataLancamento instanceof admin.firestore.Timestamp) {
        dataLancamento = dataLancamento.toDate().toISOString().split('T')[0];
      }
      
      if (!dataLancamento || typeof dataLancamento !== 'string') continue;

      const vencimento = new Date(dataLancamento + "T12:00:00Z");
      if (isNaN(vencimento.getTime())) continue;

      let diffDays = -1;

      if (data.tipo === 'birthday') {
        const bDay = vencimento.getUTCDate();
        const bMonth = vencimento.getUTCMonth();
        const tDay = today.getUTCDate();
        const tMonth = today.getUTCMonth();

        if (bDay === tDay && bMonth === tMonth) {
          diffDays = 0;
        } else {
          // Checar 1 dia antes
          const d1 = new Date(today);
          d1.setUTCDate(today.getUTCDate() + 1);
          if (bDay === d1.getUTCDate() && bMonth === d1.getUTCMonth()) {
            diffDays = 1;
          } else {
            // Checar 5 dias antes
            const d5 = new Date(today);
            d5.setUTCDate(today.getUTCDate() + 5);
            if (bDay === d5.getUTCDate() && bMonth === d5.getUTCMonth()) {
              diffDays = 5;
            }
          }
        }
      } else {
        // Cálculo robusto de diferença de dias usando componentes UTC
        const d_venc = Date.UTC(vencimento.getUTCFullYear(), vencimento.getUTCMonth(), vencimento.getUTCDate());
        const d_today = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        diffDays = Math.floor((d_venc - d_today) / (1000 * 60 * 60 * 24));
      }

      const valor = parseFloat(String(data.valor || 0).replace(',', '.'));
      const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const userName = userData?.nome || "Cliente";

      // Log discreto para debug em caso de falha
      if (diffDays >= -1 && diffDays <= 5) {
        console.log(`>>> [JOB] [HIT] ${userName} | ${data.descricao} | Venc: ${dataLancamento} | Diff: ${diffDays} | Pago: ${data.pago}`);
      }

      if (data.tipo === 'birthday') {
        if (diffDays === 5 && !data.notificado5dias) {
          const msg = `🎉 *LEMBRETE DE ANIVERSÁRIO*\n👋🏻 Oi, ${userName}! \n\nEm 5 dias será o aniversário de ${data.descricao || data.estabelecimento}! 🎂 Que tal já preparar uma surpresa?`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificado5dias: true });
            notified++;
          }
        }
        if (diffDays === 1 && !data.notificadoAmanha) {
          const msg = `Olá, ${userName}! Amanhã é aniversário do(a) ${data.descricao || data.estabelecimento}. Não esqueça de enviar seus parabéns! 🎂🥳`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificadoAmanha: true });
            notified++;
          }
        }
        if (diffDays === 0 && !data.notificadoNoDia) {
          const msg = `Olá, ${userName}! HOJE é aniversário do(a) ${data.descricao || data.estabelecimento}. Já desejou os parabéns? 🎂🥳🎉\n\nA equipe da ProcVisual deseja um dia incrível para ${data.descricao || data.estabelecimento}, cheio de conquistas, alegria e momentos especiais.\nQue seu novo ciclo seja ainda mais organizado, produtivo e cheio de realizações! 🚀`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificadoNoDia: true });
            notified++;
          }
        }
      } else {
        // Apenas despesas não pagas
        if (data.pago === true) continue;

        if (diffDays === 5 && !data.notificado5dias) {
          const msg = `👋🏻 Oi, ${userName}! Só um lembrete importante:\n\nSua despesa no valor de R$ ${valorFormatado} vence em 5 dias.\nCategoria: ${data.categoria}\nNome: ${data.descricao || data.estabelecimento}`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificado5dias: true });
            notified++;
          }
        }
        if (diffDays === 1 && !data.notificadoAmanha) {
          const msg = `🔔 *CONTA PRÓXIMA*\n👋🏻 Oi, ${userName}! \n\nSua despesa no valor de R$ ${valorFormatado} vence AMANHÃ.\nCategoria: ${data.categoria}\nNome: ${data.descricao || data.estabelecimento}`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificadoAmanha: true });
            notified++;
          }
        }
        if (diffDays === 0 && !data.notificadoNoDia) {
          const msg = `🚨 *VENCIMENTO*\n👋🏻 Oi, ${userName}! \n\nSua despesa no valor de R$ ${valorFormatado} vence HOJE.\nCategoria: ${data.categoria}\nNome: ${data.descricao || data.estabelecimento}`;
          const res = await sendWhatsApp(telefone, msg);
          if (res.success) {
            await docSnap.ref.update({ notificadoNoDia: true });
            notified++;
          }
        }
      }
    }

    console.log(`>>> [JOB] Finalizado. Processados: ${processed}, Notificados: ${notified}`);
    if (!targetUserId) await logCronExecution("success", { processed, notified });
    return { processed, notified };
  } catch (e: any) {
    console.error(`>>> [JOB] Erro no passo ${step}:`, e.message);
    if (!targetUserId) await logCronExecution("error", { step, error: e.message });
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
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`>>> [BOOT] Ambiente detectado: ${nodeEnv}`);

    if (nodeEnv !== "production") {
      console.log(">>> [SISTEMA] Configurando middleware do Vite...");
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log(">>> [SISTEMA] Middleware do Vite configurado com sucesso.");
      } catch (viteError: any) {
        console.error(">>> [SISTEMA] FALHA AO INICIALIZAR VITE:", viteError.message);
        // Em alguns ambientes, o Vite/Rollup falha devido a binários. 
        // Se já houver um 'dist', podemos tentar servir estático como fallback.
        if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
          console.warn(">>> [SISTEMA] Fallback: Servindo arquivos de 'dist' devido a erro no Vite.");
          const distPath = path.join(process.cwd(), 'dist');
          app.use(express.static(distPath));
          app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
          });
        }
      }
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
    // Roda de hora em hora para garantir que se o servidor dormir às 8h, ele tente novamente
    cron.schedule("0 * * * *", async () => {
      const now = new Date();
      const brHour = new Date(now.getTime() - (3 * 60 * 60 * 1000)).getUTCHours();
      
      console.log(`>>> [CRON] Check de hora em hora: UTC ${now.getUTCHours()}h | Brasília ${brHour}h`);
      
      // Permitir execução automática apenas entre 08h e 22h Brasília
      if (brHour >= 8 && brHour <= 22) {
        try {
          const result = await runDailyNotifications();
          console.log(`>>> [CRON] Sucesso: ${result.notified} notificações enviadas.`);
        } catch (err) {
          console.error(">>> [CRON] Erro ao rodar notificações:", err);
        }
      } else {
        console.log(">>> [CRON] Fora do horário permitido (08h às 22h). Pulando.");
      }
    });
  };

  startServer();
}

export default app;
