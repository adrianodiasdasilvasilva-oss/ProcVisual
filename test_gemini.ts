import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

const EXPENSE_SCHEMA: any = {
  type: Type.OBJECT,
  properties: {
    descricao: { type: Type.STRING, description: "O que foi pago" },
    valor: { type: Type.NUMBER, description: "Valor numérico" },
    categoria: { type: Type.STRING, description: "Categoria da despesa" },
    parcela: { type: Type.INTEGER },
    totalParcelas: { type: Type.INTEGER },
    data: { type: Type.STRING },
    transcricao: { type: Type.STRING, description: "O que foi dito / lido exatamente" }
  },
  required: ["categoria", "parcela", "totalParcelas"]
};

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found!");
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  const texto = "Gastei 150.00 com churrasco hoje";
  const brazilTime = "2026-06-01";
  const prompt = `Analise a mensagem: "${texto}". Hoje é ${brazilTime}. 
  Extraia os dados para JSON. 
  CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Presentes, Outros.
  REGRAS: 
  - Se não houver VALOR numérico claro na mensagem (um valor monetário), deixe "valor" como null. 
  - NÃO confunda números de DATAS (ex: 15/05) com VALOR.
  - Se não houver descrição, deixe "descricao" como null.
  - Escolha a categoria mais adequada ao item identificado.`;
  
  const sysInst = "Você é um assistente financeiro rigoroso. Só extraia o 'valor' se ele for explicitamente mencionado como um preço ou quantia. Se o usuário só disse uma data e um item, 'valor' DEVE ser null. Jamais invente valores.";

  try {
    console.log("Calling gemini...");
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { systemInstruction: sysInst, responseMimeType: "application/json", responseSchema: EXPENSE_SCHEMA }
    });
    console.log("Raw Response text:", response.text);
  } catch (e: any) {
    console.error("Gemini Error:", e.message);
  }
}

run();
