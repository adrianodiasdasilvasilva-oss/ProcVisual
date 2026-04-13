import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import fs from "fs";
import Stripe from "stripe";
import whatsappWebhook from "./webhook-whatsapp";

dotenv.config();

// Global error handlers to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('>>> [CRÍTICO] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('>>> [CRÍTICO] Uncaught Exception:', error);
});

// Vite should only be imported in development
let createViteServer: any;
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  import("vite").then(m => {
    createViteServer = m.createServer;
  });
}

const serverStartTime = new Date();
console.log(`>>> [SISTEMA] Servidor iniciado em: ${serverStartTime.toISOString()}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE_URL = "https://gate.whapi.cloud";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Global middleware for API routes
app.use("/api", express.json({ limit: '10mb' }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`>>> [REQUEST] ${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`>>> [BODY] ${JSON.stringify(req.body).substring(0, 100)}...`);
  }
  next();
});

// Initialize Firebase Admin SDK (Global Scope)
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
      console.error(">>> [SISTEMA] Erro: Arquivo firebase-applet-config.json não encontrado!");
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

// Middleware to ensure Firebase is initialized
app.use("/api", async (req, res, next) => {
  if (!dbAdmin && req.path !== "/health") {
    await initializeFirebaseAdmin();
  }
  next();
});

async function checkWhapiStatus() {
  if (!WHAPI_TOKEN) {
    return { success: false, error: "Token não configurado nos Segredos (Secrets)." };
  }

  try {
    // 1. Try /health first
    const healthRes = await fetch(`${WHAPI_BASE_URL}/health`, {
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}` }
    });
    const healthData = await healthRes.json();
    
    // 2. Try /users/me as fallback to get user info if connected
    const userRes = await fetch(`${WHAPI_BASE_URL}/users/me`, {
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}` }
    });
    const userData = await userRes.ok ? await userRes.json() : null;

    console.log(">>> [WHATSAPP] Debug Health:", JSON.stringify(healthData));
    if (userData) console.log(">>> [WHATSAPP] Debug User:", JSON.stringify(userData));

    const statusText = healthData.status?.text || "UNKNOWN";
    const hasUserId = healthData.user?.id || (userData && userData.id);
    
    // If we have a user ID, it means we are connected, even if status is still 'AUTH' or 'INITIALIZING'
    const isReady = statusText === "OK" || !!hasUserId;

    return { 
      success: !!isReady, 
      error: isReady ? null : `Status: ${statusText}`,
      data: { 
        health: healthData, 
        user: userData || healthData.user,
        statusText: statusText
      },
      details: healthData
    };
  } catch (error: any) {
    console.error(">>> [WHATSAPP] Erro na verificação:", error.message);
    return { success: false, error: "Erro de conexão com a API" };
  }
}

async function sendWhatsApp(to: string, message: string) {
  if (!WHAPI_TOKEN) {
    return { success: false, error: "WHAPI_TOKEN não configurado." };
  }

  // Clean phone number: remove non-digits
  let cleanNumber = to.replace(/\D/g, "");
  
  // Ensure it has country code 55 (Brazil) if it looks like a local number (10 or 11 digits)
  if (cleanNumber.length === 10 || cleanNumber.length === 11) {
    cleanNumber = "55" + cleanNumber;
  }

  // Whapi expects the recipient in this format
  const recipient = `${cleanNumber}@s.whatsapp.net`;
  console.log(`>>> [WHATSAPP] Tentando enviar mensagem para: ${recipient}`);

  try {
    const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHAPI_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        to: recipient,
        body: message,
        typing_time: 0 // Immediate
      }),
    });

    const responseData = await response.json();
    const status = response.status;

    if (!response.ok) {
      console.error(`>>> [WHATSAPP] Falha no envio (Status ${status}):`, JSON.stringify(responseData));
      return { 
        success: false, 
        error: `Erro na API Whapi (${status})`, 
        details: responseData 
      };
    }

    console.log(`>>> [WHATSAPP] Mensagem enviada com sucesso! ID: ${responseData.id}`);
    return { success: true, data: responseData };
  } catch (error: any) {
    console.error(">>> [WHATSAPP] Erro de rede ao enviar mensagem:", error.message);
    return { success: false, error: `Erro de rede: ${error.message}` };
  }
}

app.get("/api/whapi-status", async (req, res) => {
  console.log(">>> [SISTEMA] Verificando status da instância Whapi...");
  const status = await checkWhapiStatus();
  res.json(status);
});

app.get("/api/test", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "API is reachable",
    config: {
      hasWhapiToken: !!WHAPI_TOKEN,
      whapiTokenPrefix: WHAPI_TOKEN ? WHAPI_TOKEN.substring(0, 5) + "..." : null,
      firebaseInitialized: !!dbAdmin
    }
  });
});

// API Route for WhatsApp Notifications (Direct Trigger)
app.post("/api/notify-transaction", async (req, res) => {
  const { userId, transactionId, data, phone } = req.body;
  
  console.log(`>>> [NOTIFICAÇÃO] Solicitação recebida. User: ${userId}, Doc: ${transactionId}, Phone: ${phone ? 'PROVIDO' : 'NÃO PROVIDO'}`);
  console.log(`>>> [NOTIFICAÇÃO] Token presente: ${!!WHAPI_TOKEN}`);
  
  if (!userId || !data) {
    console.error(">>> [NOTIFICAÇÃO] Erro: Dados incompletos.");
    return res.status(400).json({ error: "Dados incompletos para notificação." });
  }

  if (!dbAdmin) {
    console.warn(">>> [NOTIFICAÇÃO] dbAdmin não inicializado no boot. Tentando inicializar agora...");
    await initializeFirebaseAdmin();
    if (!dbAdmin) {
      console.error(">>> [NOTIFICAÇÃO] Falha crítica: dbAdmin não pôde ser inicializado.");
      return res.status(500).json({ error: "Banco de dados não inicializado no servidor." });
    }
  }

  const cleanUserId = String(userId).trim();
  
  try {
    console.log(`>>> [DEBUG] Acessando Firestore.`);
    console.log(`>>> [DEBUG] Caminho: usuarios/${cleanUserId}`);
    
    // 1. Check Whapi Status
    const status = await checkWhapiStatus();
    
    if (!status.success && !status.data?.user?.id) {
      console.error(">>> [DEBUG] Abortando: Whapi não está pronto.");
      return res.status(500).json({ 
        error: "Instância WhatsApp não está conectada.", 
        details: status.error 
      });
    }

    // 2. Fetch user phone number from Firestore (if not provided in body)
    let telefone = phone;
    
    if (!telefone) {
      console.log(`>>> [DEBUG] Telefone não provido no body. Buscando no Firestore para ID: ${cleanUserId}`);
      let userSnap;
      try {
        userSnap = await dbAdmin.collection("usuarios").doc(cleanUserId).get();
      } catch (firestoreErr: any) {
        console.error(">>> [DEBUG] ERRO DE PERMISSÃO FIRESTORE:", firestoreErr.message);
        return res.status(500).json({ 
          error: "Erro de permissão no banco de dados do servidor.", 
          details: firestoreErr.message,
          code: firestoreErr.code,
          path: `usuarios/${cleanUserId}`
        });
      }
      
      if (!userSnap.exists) {
        console.error(`>>> [DEBUG] Documento não encontrado na coleção 'usuarios' para o ID: ${cleanUserId}`);
        return res.status(404).json({ 
          error: "Usuário não encontrado no banco de dados.",
          debug: { searchedId: cleanUserId }
        });
      }

      const userData = userSnap.data();
      telefone = userData?.telefone;
      console.log(`>>> [DEBUG] Dados do usuário recuperados do Firestore.`);
    } else {
      console.log(`>>> [DEBUG] Usando telefone provido pelo cliente: ${telefone}`);
    }
    
    if (!telefone) {
      console.error(`>>> [DEBUG] Campo 'telefone' está vazio para o usuário ${cleanUserId}`);
      return res.status(400).json({ error: "Você precisa cadastrar seu telefone nas Configurações." });
    }

    // 3. Prepare the message
    const valor = typeof data.valor === 'number' ? data.valor : parseFloat(String(data.valor || 0).replace(',', '.'));
    const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const dataFormatada = data.data ? new Date(data.data + "T12:00:00").toLocaleDateString("pt-BR") : "N/A";
    
    const tipo = (data.tipo || '').toLowerCase();
    const isIncome = tipo === 'income' || tipo === 'receita';
    
    const emoji = isIncome ? '✅' : '💸';
    const titulo = isIncome ? 'NOVA RECEITA REGISTRADA' : 'NOVA DESPESA REGISTRADA';
    const labelDesc = isIncome ? 'Origem' : 'Descrição';
    
    const message = `*${emoji} ${titulo}*\n\n` +
                    `*${labelDesc}:* ${data.descricao || data.estabelecimento || "Sem descrição"}\n` +
                    `*Valor:* R$ ${valorFormatado}\n` +
                    `*Data:* ${dataFormatada}\n\n` +
                    `_Enviado automaticamente pela ProcVisual_`;

    console.log(`>>> [NOTIFICAÇÃO] Enviando WhatsApp para ${telefone}...`);
    const result = await sendWhatsApp(telefone, message);

    if (!result.success) {
      console.error(">>> [NOTIFICAÇÃO] Erro ao enviar via Whapi:", result.error);
      return res.status(500).json({ error: result.error, details: result.details });
    }

    // 4. Mark as notified in Firestore
    if (transactionId) {
      try {
        await dbAdmin.collection("lancamentos").doc(transactionId).update({ 
          notificadoImediato: true,
          whatsappMessageId: result.data?.id
        });
      } catch (dbErr) {
        console.warn(">>> [NOTIFICAÇÃO] Erro ao atualizar status no Firestore (não crítico):", dbErr);
      }
    }

    console.log(">>> [NOTIFICAÇÃO] Processo concluído com sucesso.");
    res.json({ success: true, messageId: result.data?.id });
  } catch (error: any) {
    console.error(">>> [NOTIFICAÇÃO] Erro crítico no processo:", error);
    res.status(500).json({ error: error.message });
  }
});

// API Route for Testing WhatsApp
app.post("/api/test-whatsapp", async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: "Telefone ou mensagem ausente." });
  }

  console.log(`>>> [TESTE] Solicitado teste para: ${phone}`);
  
  // Check status first
  const status = await checkWhapiStatus();
  if (!status.success) {
    console.error(">>> [TESTE] Instância Whapi não está pronta:", status.error);
    return res.status(500).json({ 
      error: "Instância Whapi não está pronta ou token inválido.", 
      details: status.data || status.error 
    });
  }

  const result = await sendWhatsApp(phone, message);

  if (!result.success) {
    return res.status(500).json({ error: result.error, details: result.details });
  }

  res.json({ success: true });
});

// API Route for Receipt Processing
app.post("/api/process-receipt", async (req, res) => {
  console.log(">>> Recebida requisição POST em /api/process-receipt");
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      console.error(">>> Erro: Dados ausentes no body");
      return res.status(400).json({ 
        error: "Imagem ou tipo MIME ausente no corpo da requisição.",
        receivedKeys: Object.keys(req.body || {})
      });
    }

    // Check for API key in environment
    const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error(">>> Erro: Chave de API não encontrada no process.env");
      return res.status(500).json({ 
        error: "Chave de API não configurada no servidor. Por favor, adicione GEMINI_API_KEY_ nos Segredos (Secrets) do AI Studio." 
      });
    }

    console.log(">>> Inicializando Gemini com chave (final):", apiKey.substring(0, 5) + "...");
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    const prompt = `
      Analise este comprovante de pagamento ou nota fiscal e extraia as seguintes informações em formato JSON:
      - estabelecimento: O nome curto e direto do estabelecimento ou emissor (ex: Lojas Cem).
      - valor: O valor total (apenas números, use ponto para decimais).
      - categoria: Uma das seguintes: Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Outros.
      - data: A data no formato YYYY-MM-DD.
      - tipo: 'despesa' ou 'receita'.
      - descricao: Uma breve descrição do que foi pago.

      Responda APENAS o JSON puro, sem blocos de código markdown.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }
    });

    const text = response.text;
    console.log(">>> Resposta bruta do Gemini:", text);
    
    if (!text) {
      throw new Error("Resposta vazia do Gemini.");
    }

    // Clean the response text (remove markdown if present)
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);

    res.json(result);
  } catch (error: any) {
    console.error(">>> Erro no processamento Gemini:", error);
    res.status(500).json({ 
      error: "Erro ao processar o comprovante no servidor.",
      details: error.message 
    });
  }
});

app.post("/api/webhook-whatsapp", (req, res) => {
  whatsappWebhook(req, res);
});

app.get("/api/debug-vars", (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  res.json({
    STRIPE_KEY_EXISTS: !!key,
    STRIPE_KEY_PREFIX: key.substring(0, 3),
    STRIPE_KEY_LENGTH: key.length,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL,
    PRICE_ID_EXISTS: !!process.env.VITE_STRIPE_PRICE_ID
  });
});

// --- Stripe Endpoints ---

app.post("/api/checkout", async (req, res) => {
  const { userId, email, priceId } = req.body;
  console.log(`>>> [STRIPE] POST /api/checkout - User: ${userId}, Email: ${email}`);

  if (!userId || !email) {
    return res.status(400).json({ error: "UserId e Email são obrigatórios." });
  }

  try {
    const rawKey = process.env.STRIPE_SECRET_KEY || "";
    const key = rawKey.trim(); // Remove accidental spaces

    if (!key || !key.startsWith('sk_')) {
      console.error(`>>> [STRIPE] Chave inválida detectada. Prefixo: ${key.substring(0, 3)}, Tamanho: ${key.length}`);
      return res.status(400).json({ 
        error: `Chave Secreta do Stripe inválida ou não configurada no Vercel. A chave deve começar com 'sk_'. O servidor detectou: "${key.substring(0, 3)}..." com ${key.length} caracteres. Verifique as 'Environment Variables' no painel da Vercel.` 
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId || process.env.VITE_STRIPE_PRICE_ID || "SEU_PRICE_ID",
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      metadata: {
        userId: userId,
      },
      success_url: `${req.headers.origin}/?payment=success`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro ao criar sessão:", error.message);
    
    if (error.message.includes('Invalid API Key')) {
      return res.status(401).json({ 
        error: "Chave Secreta do Stripe inválida. Verifique se você copiou a 'Secret Key' corretamente (sk_...) no menu Settings > Secrets." 
      });
    }

    if (error.message.includes('a similar object exists in live mode')) {
      return res.status(400).json({ 
        error: "Conflito de ambiente: Você está usando um Preço de PRODUÇÃO com uma Chave de TESTE. Verifique seu VITE_STRIPE_PRICE_ID." 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error("Assinatura ou Secret ausente.");
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`>>> [STRIPE] Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`>>> [STRIPE] Evento recebido: ${event.type}`);

  try {
    if (!dbAdmin) await initializeFirebaseAdmin();
    if (!dbAdmin) throw new Error("Firebase Admin não inicializado.");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId) {
          console.log(`>>> [STRIPE] Ativando assinatura para o usuário: ${userId}`);
          await dbAdmin.collection("usuarios").doc(userId).set({
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
          const userQuery = await dbAdmin.collection("usuarios")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            console.log(`>>> [STRIPE] Renovação confirmada para o usuário: ${userDoc.id}`);
            await userDoc.ref.update({
              isActive: true,
              lastPayment: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        if (subscriptionId) {
          const userQuery = await dbAdmin.collection("usuarios")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            console.log(`>>> [STRIPE] Assinatura cancelada/removida para o usuário: ${userDoc.id}`);
            await userDoc.ref.update({
              isActive: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro ao processar evento:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all for other /api routes
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
});

async function startServer() {
  const PORT = 3000;

  console.log(`>>> [SISTEMA] Iniciando startServer...`);
  console.log(`>>> [SISTEMA] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`>>> [SISTEMA] VERCEL: ${process.env.VERCEL || "NÃO"}`);
  console.log(`>>> [SISTEMA] WHAPI_TOKEN configurado: ${WHAPI_TOKEN ? "SIM" : "NÃO"}`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    console.log(">>> [SISTEMA] Iniciando Vite middleware...");
    if (!createViteServer) {
      const viteModule = await import("vite");
      createViteServer = viteModule.createServer;
    }
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log(">>> [SISTEMA] Vite middleware pronto.");

    // Only listen in local development
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`>>> [SISTEMA] Servidor ouvindo em http://0.0.0.0:${PORT}`);
    });
  } else {
    // Production (Vercel or Cloud Run)
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // In Cloud Run or AI Studio (non-Vercel), we MUST listen on port 3000
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`>>> [SISTEMA] Servidor de Produção ouvindo em http://0.0.0.0:${PORT}`);
      });
    }
  }

  // --- WhatsApp Notification System ---
  // (Function sendWhatsApp moved up to be accessible by routes)

  // Cron Job: Every day at 08:00 UTC (05:00 AM Brazil)
  cron.schedule("0 8 * * *", async () => {
    console.log(">>> [JOB] Iniciando Job de Notificações WhatsApp (08:00 UTC)...");
    console.log(`>>> [JOB] Token Whapi presente: ${!!WHAPI_TOKEN}`);
    
    if (!dbAdmin) {
      console.error(">>> [JOB] Erro: Banco de dados não inicializado.");
      return;
    }

    try {
      // 1. Define "today" in Brazil Time (UTC-3)
      const now = new Date();
      const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const todayStr = brazilTime.toISOString().split('T')[0];
      const today = new Date(todayStr + "T12:00:00"); // Use noon to avoid DST issues
      
      console.log(`>>> [JOB] Data de referência (Brasil): ${todayStr}`);

      // Fetch all unpaid expenses and birthdays
      const snapshot = await dbAdmin.collection("lancamentos")
        .where("tipo", "in", ["expense", "birthday"])
        .get();

      if (snapshot.empty) {
        console.log(">>> [JOB] Nenhum lançamento pendente ou aniversário encontrado.");
        return;
      }

      console.log(`>>> [JOB] Analisando ${snapshot.size} lançamentos...`);

      for (const document of snapshot.docs) {
        const data = document.data();
        
        // Skip paid expenses
        if (data.tipo === 'expense' && data.pago === true) continue;
        
        // 2. Parse vencimento (data is YYYY-MM-DD)
        const vencimento = new Date(data.data + "T12:00:00");

        // 3. Parse createdAt and adjust to Brazil Time
        const createdAtRaw = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.data);
        const createdAtBrazil = new Date(createdAtRaw.getTime() - (3 * 60 * 60 * 1000));
        const createdAtStr = createdAtBrazil.toISOString().split('T')[0];
        const createdAt = new Date(createdAtStr + "T12:00:00");

        // Rule: Only start notifying from the day after registration (Brazil time)
        if (today.getTime() < createdAt.getTime()) continue;

        // Rule: If created on the same day as the due date, do not notify today
        if (createdAt.getTime() === vencimento.getTime() && createdAt.getTime() === today.getTime()) continue;

        const diffTime = vencimento.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Fetch user phone number
        let telefone = data.telefone;
        if (!telefone) {
          try {
            const userSnap = await dbAdmin.collection("usuarios").doc(data.userId).get();
            const userData = userSnap.data();
            telefone = userData?.telefone;
          } catch (err) {}
        }

        if (!telefone) continue;

        const valorFormatado = data.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const dataVencimentoFormatada = vencimento.toLocaleDateString("pt-BR");

        // Birthday Notifications
        if (data.tipo === 'birthday') {
          if (diffDays === 1 && !data.notificadoAmanha) {
            const message = `👀 *LEMBRETE DE ANIVERSÁRIO*\n\nAmanhã é aniversário da *${data.estabelecimento || data.descricao}*! 🎉\n\nJá comprou o presente? 🎁`;
            const result = await sendWhatsApp(telefone, message);
            if (result.success) await document.ref.update({ notificadoAmanha: true });
          }
          if (diffDays === 0 && !data.notificadoNoDia) {
            const message = `🥳 *HOJE É O DIA!*\n\nHoje é aniversário da *${data.estabelecimento || data.descricao}*! 🎉✨\n\nNão esqueça de dar os parabéns! 🎂🎈`;
            const result = await sendWhatsApp(telefone, message);
            if (result.success) await document.ref.update({ notificadoNoDia: true });
          }
          continue;
        }

        // Expense Notifications
        if (diffDays === 5 && !data.notificado5dias) {
          const message = `⚠️ *AVISO DE VENCIMENTO*\n\nOlá! 👋 Você tem uma despesa próxima do vencimento:\n\n📄 *Descrição:* ${data.descricao || data.estabelecimento}\n💰 *Valor:* R$ ${valorFormatado}\n📅 *Vencimento:* ${dataVencimentoFormatada}\n\nNão esqueça de se programar para evitar atrasos.`;
          const result = await sendWhatsApp(telefone, message);
          if (result.success) await document.ref.update({ notificado5dias: true });
        }
        if (diffDays === 0 && !data.notificadoNoDia) {
          const message = `🚨 *VENCIMENTO HOJE*\n\nAtenção! ⚠️ Sua despesa vence hoje:\n\n📄 *Descrição:* ${data.descricao || data.estabelecimento}\n💰 *Valor:* R$ ${valorFormatado}\n📅 *Vencimento:* HOJE (${dataVencimentoFormatada})\n\nRealize o pagamento para evitar juros.`;
          const result = await sendWhatsApp(telefone, message);
          if (result.success) await document.ref.update({ notificadoNoDia: true });
        }
      }
    } catch (error) {
      console.error(">>> Erro no Job de Notificações:", error);
    }
  });

  if (dbAdmin) {
    setInterval(() => {
      console.log(`>>> [HEARTBEAT] Servidor ativo: ${new Date().toLocaleTimeString()}`);
    }, 60000);
  }
}

// Call initialization conditionally
if (!process.env.VERCEL) {
  initializeFirebaseAdmin().then(() => {
    startServer().catch(err => {
      console.error(">>> [SISTEMA] Erro ao iniciar servidor:", err);
    });
  }).catch(err => {
    console.error(">>> [SISTEMA] Erro ao inicializar Firebase Admin:", err);
  });
}

export default app;
