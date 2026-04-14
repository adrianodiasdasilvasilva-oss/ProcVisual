import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Cache for Firebase Client
let dbClient: any = null;

async function initializeFirebaseClient() {
  if (dbClient) return dbClient;
  
  console.log(">>> [WH-WA] Inicializando Firebase Client...");
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error(">>> [WH-WA] Erro: firebase-applet-config.json não encontrado!");
    return null;
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log(">>> [WH-WA] Config lida para o projeto:", firebaseConfig.projectId);
    const app = initializeApp(firebaseConfig);
    dbClient = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    return dbClient;
  } catch (e: any) {
    console.error(">>> [WH-WA] Erro ao inicializar Firebase Client:", e.message);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  console.log(`>>> [WH-WA] Request recebida: ${req.method} ${req.url}`);
  
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const data = req.body;
    const message = data?.messages?.[0];

    if (!message || message.from_me) {
      return res.status(200).json({ ok: true });
    }

    const numero = message.from; 
    const type = message.type;
    console.log(`>>> [WH-WA] Mensagem de ${numero} tipo ${type}`);

    const db = await initializeFirebaseClient();

    if (!db) {
      console.error(">>> [WH-WA] Abortando: DB não disponível.");
      return res.status(200).json({ ok: true });
    }

    console.log(">>> [WH-WA] Buscando usuário...");
    // Normalize incoming number
    const rawNumero = numero.split('@')[0];
    const cleanIncoming = rawNumero.replace(/\D/g, "");
    const shortIncoming = cleanIncoming.startsWith('55') ? cleanIncoming.substring(2) : cleanIncoming;
    
    console.log(`>>> [WH-WA] Processando: ${cleanIncoming} (Short: ${shortIncoming})`);

    // Search for user
    let userDoc = null;
    let userData = null;

    const usersRef = collection(db, "usuarios");
    
    // 1. Try exact match with clean incoming
    const q1 = query(usersRef, where("telefone", "==", cleanIncoming));
    const snap1 = await getDocs(q1);
    
    if (!snap1.empty) {
      // Prefer active user if multiple found
      const activeUser = snap1.docs.find(d => d.data().isActive === true);
      userDoc = activeUser || snap1.docs[0];
    } else {
      // 2. Try short match
      const q2 = query(usersRef, where("telefone", "==", shortIncoming));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const activeUser = snap2.docs.find(d => d.data().isActive === true);
        userDoc = activeUser || snap2.docs[0];
      }
    }

    // 3. Fallback: scan active users for normalized match
    if (!userDoc) {
       console.log(">>> [WH-WA] Usuário não encontrado em query direta. Iniciando scan...");
       const snapAll = await getDocs(usersRef);
       userDoc = snapAll.docs.find(doc => {
         const d = doc.data();
         const tel = (d.telefone || "").replace(/\D/g, "");
         if (!tel) return false;
         
         const shortTel = tel.startsWith('55') ? tel.substring(2) : tel;
         
         // Match clean full, short, or 9-digit variations
         return tel === cleanIncoming || 
                shortTel === shortIncoming || 
                (shortTel.length === 11 && shortIncoming.length === 10 && shortTel.substring(0, 2) === shortIncoming.substring(0, 2) && shortTel.substring(3) === shortIncoming.substring(2)) ||
                (shortTel.length === 10 && shortIncoming.length === 11 && shortIncoming.substring(0, 2) === shortTel.substring(0, 2) && shortIncoming.substring(3) === shortTel.substring(2));
       });
    }

    userData = userDoc ? userDoc.data() : null;

    // Block if user not found or explicitly inactive
    if (!userData) {
      console.log(`>>> [WH-WA] Usuário NÃO cadastrado: ${cleanIncoming}`);
      await sendWhatsAppMessage(numero, '👋 *Olá! Bem-vindo à ProcVisual.*\n\nIdentificamos que seu número ainda não está vinculado a uma conta.\n\nPara usar o registro via WhatsApp, você precisa:\n1. Criar uma conta em nosso site.\n2. Cadastrar seu número de WhatsApp no seu perfil.\n3. Ter uma assinatura ativa.\n\nAcesse: ' + (req.headers.origin || 'nosso site') + ' para começar!');
      return res.status(200).json({ ok: true });
    }

    if (userData.isActive === false) {
      console.log(`>>> [WH-WA] Usuário INATIVO: ${userData.email}`);
      await sendWhatsAppMessage(numero, '⚠️ *Assinatura Inativa*\n\nSua conta na ProcVisual está inativa. Para continuar registrando despesas via WhatsApp, por favor regularize sua assinatura no dashboard do site.');
      return res.status(200).json({ ok: true });
    }

    const userId = userDoc!.id;
    console.log(`>>> [WH-WA] Usuário identificado: ${userId} (${userData.email})`);

    if (type === 'text') {
      const texto = message.text?.body || message.body || "";
      if (texto.toLowerCase().trim() === 'ajuda') {
        await sendWhatsAppMessage(numero, '📖 *Guia de Uso - ProcVisual*\n\nVocê pode registrar despesas enviando:\n\n1️⃣ *Texto:* "Almoço 35.00" ou "Internet 120 amanhã"\n2️⃣ *Áudio:* Fale o que comprou e o valor.\n3️⃣ *Foto:* Envie uma foto do cupom fiscal ou comprovante.\n\n*Dica:* Para parcelas, diga algo como "Geladeira 2000 em 10x".');
      } else {
        await processText(db, userId, numero, texto, message.timestamp);
      }
    } else if (type === 'image') {
      const imageUrl = message.image?.link;
      if (imageUrl) await processImage(db, userId, numero, imageUrl, message.timestamp);
    } else if (type === 'audio' || type === 'voice') {
      const audioUrl = message.audio?.link || message.voice?.link;
      if (audioUrl) await processAudio(db, userId, numero, audioUrl, message.timestamp);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error(">>> [WH-WA] Erro crítico:", error.message);
    return res.status(200).json({ ok: true });
  }
}

async function sendWhatsAppMessage(to: string, body: string) {
  const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
  if (!WHAPI_TOKEN) return;
  try {
    const response = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`>>> [WH-WA] Erro Whapi (${response.status}):`, errText);
    } else {
      console.log(`>>> [WH-WA] Mensagem enviada com sucesso para ${to}`);
    }
  } catch (e) {
    console.error(">>> [WH-WA] Erro ao enviar mensagem:", e);
  }
}

const EXPENSE_SCHEMA: any = {
  type: SchemaType.OBJECT,
  properties: {
    descricao: { type: SchemaType.STRING, description: "O que foi pago" },
    valor: { type: SchemaType.NUMBER, description: "Valor total ou da parcela" },
    categoria: { type: SchemaType.STRING, description: "Categoria: Alimentação, Transporte, Moradia, Assinaturas, Saúde, Lazer, Educação, Outros" },
    parcela: { type: SchemaType.INTEGER, description: "Parcela atual" },
    totalParcelas: { type: SchemaType.INTEGER, description: "Total de parcelas" },
    data: { type: SchemaType.STRING, description: "Data no formato YYYY-MM-DD" }
  },
  required: ["descricao", "valor", "categoria", "parcela", "totalParcelas"]
};

async function generateWithFallback(genAI: any, prompt: any) {
  const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
  let lastError = null;

  for (const modelName of models) {
    try {
      console.log(`>>> [WH-WA] Tentando modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: EXPENSE_SCHEMA
        }
      }, { apiVersion: 'v1' });
      const result = await model.generateContent(prompt);
      return result;
    } catch (e: any) {
      console.error(`>>> [WH-WA] Erro no modelo ${modelName} (v1):`, e.message);
      lastError = e;
      
      // Try v1beta as fallback for this model
      try {
        console.log(`>>> [WH-WA] Tentando modelo: ${modelName} (v1beta)`);
        const modelBeta = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: EXPENSE_SCHEMA
          }
        });
        const resultBeta = await modelBeta.generateContent(prompt);
        return resultBeta;
      } catch (e2: any) {
        console.error(`>>> [WH-WA] Erro no modelo ${modelName} (v1beta):`, e2.message);
        lastError = e2;
      }
      
      continue;
    }
  }
  throw lastError;
}

async function processText(db: any, userId: string, numero: string, texto: string, timestamp: number) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error(">>> [WH-WA] GEMINI_API_KEY não configurada!");
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];

    const prompt = `Analise: "${texto}". Hoje é ${todayStr}. Extraia os dados da despesa.`;
    const result_ai = await generateWithFallback(genAI, prompt);

    const response = await result_ai.response;
    const result = JSON.parse(response.text() || "{}");
    
    if (result.valor) {
      await saveAndConfirm(db, userId, numero, result, "whatsapp", timestamp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro texto:", err.message);
  }
}

async function processImage(db: any, userId: string, numero: string, imageUrl: string, timestamp: number) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return;

  try {
    await sendWhatsAppMessage(numero, '📸 *Processando imagem...* Aguarde um instante enquanto nossa IA analisa seu comprovante.');
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = [
      { text: "Extraia os dados deste comprovante." },
      { inlineData: { data: base64Image, mimeType } }
    ];

    const result_ai = await generateWithFallback(genAI, prompt);
    const response = await result_ai.response;
    const result = JSON.parse(response.text() || "{}");

    if (result.valor) {
      await saveAndConfirm(db, userId, numero, result, "whatsapp_imagem", timestamp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro imagem:", err.message);
  }
}

async function processAudio(db: any, userId: string, numero: string, audioUrl: string, timestamp: number) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return;

  try {
    await sendWhatsAppMessage(numero, '🎙️ *Processando áudio...* Aguarde um instante enquanto transcrevemos sua despesa.');
    const audioResponse = await fetch(audioUrl);
    const buffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');
    const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = [
      { text: "Transcreva e extraia os dados da despesa." },
      { inlineData: { data: base64Audio, mimeType } }
    ];

    const result_ai = await generateWithFallback(genAI, prompt);
    const response = await result_ai.response;
    const result = JSON.parse(response.text() || "{}");

    if (result.valor) {
      await saveAndConfirm(db, userId, numero, result, "whatsapp_audio", timestamp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro áudio:", err.message);
  }
}

async function saveAndConfirm(db: any, userId: string, numero: string, data: any, origem: string, timestamp: number) {
  try {
    const { descricao, valor, categoria, parcela, totalParcelas, data: customData } = data;
    
    let baseDate = new Date(timestamp * 1000);
    if (customData) {
      const [y, m, d] = customData.split('-');
      baseDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
    }
    baseDate.setHours(baseDate.getHours() - 3); // Adjust for Brazil

    const groupId = totalParcelas > 1 ? `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : null;
    
    for (let i = parcela; i <= totalParcelas; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - parcela));
      const dateStr = installmentDate.toISOString().split('T')[0];

      await addDoc(collection(db, "lancamentos"), {
        userId,
        tipo: 'expense',
        valor,
        categoria: categoria || 'Outros',
        data: dateStr,
        descricao: totalParcelas > 1 ? `${descricao} (${i}/${totalParcelas})` : descricao,
        estabelecimento: descricao,
        origem,
        createdAt: serverTimestamp(),
        pago: false,
        parcela: i,
        totalParcelas,
        groupId
      });
    }

    const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const confirmacao = `✅ *Lançamento Confirmado!*\n\n*Item:* ${descricao}\n*Valor:* R$ ${valorFormatado}\n*Categoria:* ${categoria}\n*Data:* ${baseDate.toLocaleDateString('pt-BR')}${totalParcelas > 1 ? `\n*Parcelas:* ${parcela}/${totalParcelas}` : ''}\n\nSua despesa foi registrada com sucesso.`;
    
    await sendWhatsAppMessage(numero, confirmacao);
  } catch (error: any) {
    console.error(">>> [WH-WA] Erro ao salvar:", error.message);
    await sendWhatsAppMessage(numero, '❌ *Erro ao processar*\n\nDesculpe, ocorreu um erro ao salvar sua despesa. Por favor, tente novamente em instantes.');
  }
}
