import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, onSnapshot } from "firebase/firestore";
import fs from "fs";

dotenv.config();

// Read Firebase configuration
let db: any;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

  // Initialize Firebase Client SDK (works in Node.js)
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  
  console.log(">>> Firebase Backend inicializado com sucesso.");
} catch (error) {
  console.error(">>> Erro ao inicializar Firebase Backend:", error);
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
    res.json({ status: "ok", message: "API is reachable" });
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
      console.error(">>> Erro: WHAPI_TOKEN não configurado.");
      return;
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
          to: to.includes("@") ? to : `${to}@s.whatsapp.net`,
          body: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(">>> Erro ao enviar WhatsApp via Whapi:", errorData);
      } else {
        console.log(`>>> WhatsApp enviado com sucesso para ${to}`);
      }
    } catch (error) {
      console.error(">>> Erro na requisição Whapi:", error);
    }
  }

  // Cron Job: Every day at 08:00
  cron.schedule("0 8 * * *", async () => {
    console.log(">>> Iniciando Job de Notificações WhatsApp (08:00)...");
    
    if (!db) {
      console.error(">>> Erro: Banco de dados não inicializado.");
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all unpaid expenses
      const lancamentosRef = collection(db, "lancamentos");
      const q = query(
        lancamentosRef,
        where("tipo", "==", "expense"),
        where("pago", "==", false)
      );
      const snapshot = await getDocs(q);

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
        const userSnap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", data.userId)));
        const userData = userSnap.docs[0]?.data();
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
          await updateDoc(doc(db, "lancamentos", document.id), { notificado5dias: true });
        }

        // Rule: On the due date
        if (diffDays === 0 && !data.notificadoNoDia) {
          const message = `Atenção! ⚠️ Sua despesa vence hoje.\n📄 ${data.descricao || data.estabelecimento}\n💰 R$ ${valorFormatado}\n📅 Vence hoje\nEvite atrasos.`;
          await sendWhatsApp(telefone, message);
          await updateDoc(doc(db, "lancamentos", document.id), { notificadoNoDia: true });
        }
      }
    } catch (error) {
      console.error(">>> Erro no Job de Notificações:", error);
    }
  });

  // --- WhatsApp Notification System (IMMEDIATE TEST MODE) ---
  // This listener will send a notification as soon as a new expense is registered.
  
  if (db) {
    const lancamentosRef = collection(db, "lancamentos");
    let isInitialSnapshot = true;

    onSnapshot(lancamentosRef, async (snapshot) => {
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        console.log(">>> Listener de Notificações Imediatas (TESTE) inicializado (ignorando snapshot inicial).");
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const data = change.doc.data();
          
          // Only notify expenses that haven't been notified immediately yet
          if (data.tipo === "expense" && !data.notificadoImediato) {
            console.log(`>>> Nova despesa detectada: ${change.doc.id}. Enviando notificação imediata...`);
            
            // Fetch user phone number
            const userRef = doc(db, "usuarios", data.userId);
            const userSnap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", data.userId)));
            const userData = userSnap.docs[0]?.data();
            const telefone = userData?.telefone;

            if (telefone) {
              const valorFormatado = data.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
              const message = `🔔 *TESTE DE NOTIFICAÇÃO IMEDIATA*\n\n📄 ${data.descricao || data.estabelecimento}\n💰 R$ ${valorFormatado}\n📅 Vencimento: ${new Date(data.data).toLocaleDateString("pt-BR")}\n\nEsta é uma notificação de teste enviada imediatamente após o cadastro.`;
              
              await sendWhatsApp(telefone, message);
              await updateDoc(doc(db, "lancamentos", change.doc.id), { notificadoImediato: true });
            } else {
              console.warn(`>>> Usuário ${data.userId} não possui telefone para notificação imediata.`);
            }
          }
        }
      }
    }, (error) => {
      console.error(">>> Erro no Listener de Notificações Imediatas:", error);
    });
  }
}

startServer();
