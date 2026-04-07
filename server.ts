import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

const serverStartTime = new Date();
console.log(`>>> [SISTEMA] Servidor iniciado em: ${serverStartTime.toISOString()}`);

// Initialize Firebase Admin SDK
let dbAdmin: admin.firestore.Firestore;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  
  // Correct way to initialize with a specific database ID in Admin SDK
  const dbId = firebaseConfig.firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    dbAdmin = admin.firestore(dbId);
    console.log(`>>> [SISTEMA] Firebase Admin SDK inicializado para Database: ${dbId}`);
  } else {
    dbAdmin = admin.firestore();
    console.log(">>> [SISTEMA] Firebase Admin SDK inicializado para Database: (default)");
  }
  
} catch (error) {
  console.error(">>> [SISTEMA] Erro ao inicializar Firebase Admin SDK:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size for images
  app.use(express.json({ limit: '10mb' }));

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
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

  // Diagnostic endpoint to test WhatsApp
  app.post("/api/test-whatsapp", async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: "Número de telefone ausente." });
    }

    if (!WHAPI_TOKEN) {
      return res.status(500).json({ error: "WHAPI_TOKEN não configurado nos Segredos (Secrets)." });
    }

    console.log(`>>> [DIAGNÓSTICO] Testando WhatsApp para ${phone}...`);
    
    // Clean phone number: remove non-digits
    let cleanNumber = phone.replace(/\D/g, "");
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = "55" + cleanNumber;
    }

    try {
      const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHAPI_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          typing_confirm: true,
          to: `${cleanNumber}@s.whatsapp.net`,
          body: message || "Teste de conexão ProcVisual",
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(">>> [DIAGNÓSTICO] Erro Whapi:", JSON.stringify(data));
        return res.status(response.status).json({ 
          success: false, 
          error: "Erro na API do Whapi", 
          details: data 
        });
      }

      console.log(`>>> [DIAGNÓSTICO] Sucesso para ${cleanNumber}`);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(">>> [DIAGNÓSTICO] Erro de rede:", error);
      res.status(500).json({ success: false, error: error.message });
    }
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

  // Catch-all for other /api routes to prevent HTML fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });

  // --- WhatsApp Notification System ---

  const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
  const WHAPI_BASE_URL = "https://gate.whapi.cloud";

  async function sendWhatsApp(to: string, message: string) {
    if (!WHAPI_TOKEN) {
      console.error(">>> Erro: WHAPI_TOKEN não configurado nos Segredos (Secrets).");
      return;
    }

    // Clean phone number: remove non-digits
    let cleanNumber = to.replace(/\D/g, "");
    
    // Ensure it has country code 55 (Brazil) if it looks like a local number
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = "55" + cleanNumber;
    }

    console.log(`>>> Tentando enviar WhatsApp para: ${cleanNumber}`);

    try {
      const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHAPI_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          typing_confirm: true,
          to: `${cleanNumber}@s.whatsapp.net`,
          body: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(">>> Erro Whapi (API):", JSON.stringify(errorData));
      } else {
        console.log(`>>> WhatsApp enviado com sucesso para ${cleanNumber}`);
      }
    } catch (error) {
      console.error(">>> Erro na requisição Whapi (Network):", error);
    }
  }

  // Cron Job: Every day at 08:00
  cron.schedule("0 8 * * *", async () => {
    console.log(">>> Iniciando Job de Notificações WhatsApp (08:00)...");
    
    if (!dbAdmin) {
      console.error(">>> Erro: Banco de dados não inicializado.");
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all unpaid expenses
      const snapshot = await dbAdmin.collection("lancamentos")
        .where("tipo", "==", "expense")
        .where("pago", "==", false)
        .get();

      if (snapshot.empty) {
        console.log(">>> Nenhuma despesa pendente encontrada.");
        return;
      }

      for (const document of snapshot.docs) {
        const data = document.data();
        const vencimento = new Date(data.data);
        vencimento.setHours(0, 0, 0, 0);

        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.data);
        createdAt.setHours(0, 0, 0, 0);

        // Rule: Only start notifying from the day after registration
        if (today.getTime() <= createdAt.getTime()) {
          continue;
        }

        // Rule: If created on the same day as the due date, do not notify
        if (createdAt.getTime() === vencimento.getTime()) {
          continue;
        }

        const diffTime = vencimento.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Fetch user phone number
        const userSnap = await dbAdmin.collection("usuarios").doc(data.userId).get();
        const userData = userSnap.data();
        const telefone = userData?.telefone;

        if (!telefone) {
          console.warn(`>>> Usuário ${data.userId} não possui telefone cadastrado.`);
          continue;
        }

        const valorFormatado = data.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const dataVencimentoFormatada = vencimento.toLocaleDateString("pt-BR");

        // Rule: 5 days before
        if (diffDays === 5 && !data.notificado5dias) {
          const message = `Olá! 👋 Você tem uma despesa próxima do vencimento.\n📄 ${data.descricao || data.estabelecimento}\n💰 R$ ${valorFormatado}\n📅 Vence em ${dataVencimentoFormatada}\nNão esqueça de se programar.`;
          await sendWhatsApp(telefone, message);
          await document.ref.update({ notificado5dias: true });
        }

        // Rule: On the due date
        if (diffDays === 0 && !data.notificadoNoDia) {
          const message = `Atenção! ⚠️ Sua despesa vence hoje.\n📄 ${data.descricao || data.estabelecimento}\n💰 R$ ${valorFormatado}\n📅 Vence hoje\nEvite atrasos.`;
          await sendWhatsApp(telefone, message);
          await document.ref.update({ notificadoNoDia: true });
        }
      }
    } catch (error) {
      console.error(">>> Erro no Job de Notificações:", error);
    }
  });

  // --- WhatsApp Notification System (IMMEDIATE TEST MODE) ---
  // This listener will send a notification as soon as a new expense is registered.
  
  if (dbAdmin) {
    let isInitialSnapshot = true;
    const serverStartTime = Date.now();

    console.log(">>> [SISTEMA] Configurando Listener de Notificações Imediatas (Admin SDK)...");

    // Diagnostic: Check connection
    dbAdmin.collection("lancamentos").limit(1).get()
      .then(snap => {
        console.log(`>>> [DIAGNÓSTICO] Conexão Firestore: ${snap.empty ? "Vazia (mas conectada)" : "OK (documentos encontrados)"}`);
      })
      .catch(err => {
        console.error(">>> [DIAGNÓSTICO] Erro de conexão Firestore:", err.message);
      });

    dbAdmin.collection("lancamentos").onSnapshot(async (snapshot) => {
      // In Admin SDK, the first snapshot contains all existing documents.
      // We want to ignore documents that were created BEFORE the server started.
      
      console.log(`>>> [NOTIFICAÇÃO] Snapshot recebido: ${snapshot.docChanges().length} mudanças detectadas.`);

      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id;
        const data = change.doc.data();
        
        // We only care about NEW documents (added)
        if (change.type !== "added") continue;

        // Check if the document is actually new (created after server start)
        // or if it hasn't been notified yet.
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
        
        // If it's the initial snapshot, we only process documents that are VERY recent (last 10 seconds)
        // and haven't been notified.
        if (isInitialSnapshot && createdAt < (serverStartTime - 10000)) {
          continue;
        }

        console.log(`>>> [NOTIFICAÇÃO] Processando documento: ${docId} (Tipo: ${data.tipo})`);

        if (data.tipo === "expense" && !data.notificadoImediato) {
          console.log(`>>> [NOTIFICAÇÃO] Nova despesa qualificada: ${docId}`);
          
          if (!data.userId) {
            console.warn(`>>> [NOTIFICAÇÃO] Erro: Lançamento ${docId} não possui userId.`);
            continue;
          }

          try {
            // Fetch user document directly by ID
            const userSnap = await dbAdmin.collection("usuarios").doc(data.userId).get();
            
            if (!userSnap.exists) {
              console.warn(`>>> [NOTIFICAÇÃO] Erro: Usuário ${data.userId} não encontrado no Firestore.`);
              continue;
            }

            const userData = userSnap.data();
            const telefone = userData?.telefone;

            if (telefone) {
              console.log(`>>> [NOTIFICAÇÃO] Enviando para ${userData.nome || data.userId}: ${telefone}`);
              
              const valorFormatado = data.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
              const message = `🔔 *NOTIFICAÇÃO DE DESPESA*\n\n📄 ${data.descricao || data.estabelecimento}\n💰 R$ ${valorFormatado}\n📅 Vencimento: ${new Date(data.data).toLocaleDateString("pt-BR")}\n\nLançamento registrado com sucesso no ProcVisual.`;
              
              await sendWhatsApp(telefone, message);
              
              // Mark as notified
              await change.doc.ref.update({ notificadoImediato: true });
              console.log(`>>> [NOTIFICAÇÃO] Sucesso: Documento ${docId} marcado como notificado.`);
            } else {
              console.warn(`>>> [NOTIFICAÇÃO] Erro: Usuário ${data.userId} (${userData?.nome}) não possui telefone cadastrado.`);
            }
          } catch (err) {
            console.error(`>>> [NOTIFICAÇÃO] Erro crítico ao processar ${docId}:`, err);
          }
        }
      }
      
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        console.log(">>> [SISTEMA] Carga inicial concluída. Monitorando novos lançamentos...");
      }
    }, (error: any) => {
      console.error(">>> [SISTEMA] Erro fatal no Listener de Notificações:", error);
    });
  }
}

startServer();
