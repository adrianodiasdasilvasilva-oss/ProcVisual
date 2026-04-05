import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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
    console.log(">>> Body keys:", Object.keys(req.body || {}));
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64 || !mimeType) {
        console.error(">>> Erro: Dados ausentes no body");
        return res.status(400).json({ error: "Imagem ou tipo MIME ausente no corpo da requisição." });
      }

      // Check for API key in environment
      const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          error: "Chave de API não configurada no servidor. Por favor, adicione GEMINI_API_KEY_ nos Segredos (Secrets) do AI Studio." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";

      const prompt = `
        Analise este comprovante de pagamento ou nota fiscal e extraia as seguintes informações em formato JSON:
        - descricao: Uma descrição curta do que foi pago ou comprado.
        - valor: O valor total (apenas números, use ponto para decimais).
        - categoria: Uma das seguintes: Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Outros.
        - data: A data no formato YYYY-MM-DD.
        - tipo: 'despesa' (sempre despesa para comprovantes).

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
      if (!text) {
        throw new Error("Resposta vazia do Gemini.");
      }

      // Clean the response text (remove markdown if present)
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);

      res.json(result);
    } catch (error: any) {
      console.error("Erro no processamento Gemini:", error);
      res.status(500).json({ 
        error: "Erro ao processar o comprovante.",
        details: error.message 
      });
    }
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
}

startServer();
