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

    console.log(">>> [WH-WA] Executando query 1...");
    // Try exact match first
    const usersRef = collection(db, "usuarios");
    const q1 = query(usersRef, where("telefone", "==", cleanIncoming));
    const snap1 = await getDocs(q1);
    console.log(">>> [WH-WA] Query 1 concluída.");
    
    if (!snap1.empty) {
      userDoc = snap1.docs[0];
    } else {
      console.log(">>> [WH-WA] Executando query 2...");
      // Try short match
      const q2 = query(usersRef, where("telefone", "==", shortIncoming));
      const snap2 = await getDocs(q2);
      console.log(">>> [WH-WA] Query 2 concluída.");
      if (!snap2.empty) userDoc = snap2.docs[0];
    }

    // Fallback: search for users and manually check normalized phone (handling the "9" digit issue)
    if (!userDoc) {
       console.log(">>> [WH-WA] Executando fallback scan...");
       const snapAll = await getDocs(usersRef);
       console.log(">>> [WH-WA] Fallback scan concluído.");
       userDoc = snapAll.docs.find(doc => {
         const d = doc.data();
         if (!d.isActive) return false;
         const tel = (d.telefone || "").replace(/\D/g, "");
         const shortTel = tel.startsWith('55') ? tel.substring(2) : tel;
         
         return tel === cleanIncoming || 
                shortTel === shortIncoming || 
                (shortTel.length === 11 && shortIncoming.length === 10 && shortTel.substring(0, 2) === shortIncoming.substring(0, 2) && shortTel.substring(3) === shortIncoming.substring(2)) ||
                (shortTel.length === 10 && shortIncoming.length === 11 && shortIncoming.substring(0, 2) === shortTel.substring(0, 2) && shortIncoming.substring(3) === shortTel.substring(2));
       });
    }

    userData = userDoc ? userDoc.data() : null;

    // Block if user not found or explicitly inactive
    if (!userData || userData.isActive === false) {
      console.log(`>>> [WH-WA] Bloqueio: ${cleanIncoming} | Ativo: ${userData?.isActive}`);
      await sendWhatsAppMessage(numero, '⚠️ *Acesso Restrito*\n\nSeu número não está vinculado a uma conta ativa na ProcVisual. Por favor, verifique seu número nas configurações do site ou regularize seu pagamento.\n\nSe você acabou de pagar, aguarde alguns instantes para a ativação automática.');
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
    await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body })
    });
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

async function processText(db: any, userId: string, numero: string, texto: string, timestamp: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXPENSE_SCHEMA
      }
    });

    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];

    const result_ai = await model.generateContent(`Analise: "${texto}". Hoje é ${todayStr}. Extraia os dados da despesa.`);
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXPENSE_SCHEMA
      }
    });

    const result_ai = await model.generateContent([
      { text: "Extraia os dados deste comprovante." },
      { inlineData: { data: base64Image, mimeType } }
    ]);
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const audioResponse = await fetch(audioUrl);
    const buffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');
    const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXPENSE_SCHEMA
      }
    });

    const result_ai = await model.generateContent([
      { text: "Transcreva e extraia os dados da despesa." },
      { inlineData: { data: base64Audio, mimeType } }
    ]);
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
