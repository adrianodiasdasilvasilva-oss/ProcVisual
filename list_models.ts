import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não encontrada.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    // The SDK doesn't have a direct listModels in the main class usually, 
    // but we can try to fetch it via the underlying API or just try a few known ones.
    // Actually, let's try to use the fetch API directly to list models to be sure.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Modelos disponíveis:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro ao listar modelos:", e);
  }
}

listModels();
