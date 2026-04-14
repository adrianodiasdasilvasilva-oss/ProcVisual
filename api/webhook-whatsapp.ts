import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Cache for Firebase Admin
let dbAdmin: admin.firestore.Firestore | null = null;

async function initializeFirebaseAdmin() {
  if (dbAdmin) return dbAdmin;
  
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error(">>> [WH-WA] Erro: firebase-applet-config.json não encontrado!");
    return null;
  }

  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  try {
    dbAdmin = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
    return dbAdmin;
  } catch (e: any) {
    console.error(">>> [WH-WA] Erro ao conectar Firestore Admin:", e.message);
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
    const db = await initializeFirebaseAdmin();

    if (!db) {
      console.error(">>> [WH-WA] Abortando: Admin DB não disponível.");
      return res.status(200).json({ ok: true });
    }

    // Normalize incoming number
    const rawNumero = numero.split('@')[0];
    const cleanIncoming = rawNumero.replace(/\D/g, "");
    const shortIncoming = cleanIncoming.startsWith('55') ? cleanIncoming.substring(2) : cleanIncoming;
    
    console.log(`>>> [WH-WA] Processando: ${cleanIncoming} (Short: ${shortIncoming})`);

    // Search for user with variations of the phone number
    let userDoc = null;
    let userData = null;

    // Try exact match first
    console.log(`>>> [WH-WA] Tentando busca exata por: ${cleanIncoming}`);
    const q1 = await db.collection("usuarios").where("telefone", "==", cleanIncoming).limit(1).get();
    if (!q1.empty) {
      console.log(`>>> [WH-WA] Encontrado por busca exata.`);
      userDoc = q1.docs[0];
    } else {
      // Try short match
      console.log(`>>> [WH-WA] Tentando busca curta por: ${shortIncoming}`);
      const q2 = await db.collection("usuarios").where("telefone", "==", shortIncoming).limit(1).get();
      if (!q2.empty) {
        console.log(`>>> [WH-WA] Encontrado por busca curta.`);
        userDoc = q2.docs[0];
      }
    }

    // If still not found, we might need to fetch all and filter (expensive but safer for small user base)
    if (!userDoc) {
       console.log(`>>> [WH-WA] Tentando busca por filtro manual em todos usuários ativos.`);
       const allUsers = await db.collection("usuarios").where("isActive", "==", true).get();
       console.log(`>>> [WH-WA] Analisando ${allUsers.size} usuários ativos.`);
       userDoc = allUsers.docs.find(doc => {
         const tel = (doc.data().telefone || "").replace(/\D/g, "");
         const shortTel = tel.startsWith('55') ? tel.substring(2) : tel;
         
         // Match exact, short, or handle the Brazilian "9" digit issue
         const match = tel === cleanIncoming || 
                       shortTel === shortIncoming || 
                       (shortTel.length === 11 && shortIncoming.length === 10 && shortTel.substring(0, 2) === shortIncoming.substring(0, 2) && shortTel.substring(3) === shortIncoming.substring(2)) ||
                       (shortTel.length === 10 && shortIncoming.length === 11 && shortIncoming.substring(0, 2) === shortTel.substring(0, 2) && shortIncoming.substring(3) === shortTel.substring(2));
         
         if (match) console.log(`>>> [WH-WA] Match manual encontrado: ${doc.data().email} (${tel})`);
         return match;
       });
    }

    userData = userDoc ? userDoc.data() : null;

    // Block if user not found or explicitly inactive
    if (!userData || userData.isActive === false) {
      console.log(`>>> [WH-WA] Bloqueio: ${cleanIncoming} | Ativo: ${userData?.isActive}`);
      const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
      if (WHAPI_TOKEN) {
        await fetch('https://gate.whapi.cloud/messages/text', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: numero,
            body: '⚠️ *Acesso Restrito*\n\nSeu número não está vinculado a uma conta ativa na ProcVisual. Por favor, verifique seu cadastro no site ou regularize seu pagamento.\n\nSe você acabou de pagar, aguarde alguns instantes ou use o botão "Ativar manualmente" no site.'
          })
        });
      }
      return res.status(200).json({ ok: true });
    }

    const userId = userDoc!.id;
    console.log(`>>> [WH-WA] Usuário identificado: ${userId} (${userData.email})`);

    if (type === 'text') {
      const texto = message.text?.body || message.body || "";
      await processText(db, userId, numero, texto, message.timestamp);
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

async function processText(db: any, userId: string, numero: string, texto: string, timestamp: number) {
  console.log(`>>> [WH-WA] Processando texto: "${texto}"`);
  const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn(">>> [WH-WA] GEMINI_API_KEY ausente.");
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];

    const prompt = `
      Analise a mensagem de texto abaixo e extraia as informações de despesa em formato JSON.
      Considere que HOJE é dia ${todayStr}.
      
      Campos do JSON:
      - descricao: O que foi pago (ex: Internet, Uber, Almoço).
      - valor: O valor unitário de cada parcela (apenas números, use ponto para decimais).
      - parcela: O número da parcela atual (se houver, ex: 1). Padrão: 1.
      - totalParcelas: O número total de parcelas (se houver, ex: 1). Padrão: 1.
      - data: A data de vencimento ou do gasto no formato YYYY-MM-DD. 
        Se o usuário disser "amanhã", "hoje", "ontem" ou um dia da semana, calcule a data correta baseada em ${todayStr}.
        Se não houver data explícita ou relativa, use null.
      
      Mensagem: "${texto}"
      Responda APENAS o JSON puro.
    `;

    const genResponse = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] }
    });

    const resText = genResponse.text;
    const cleanJson = resText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (result.valor && !isNaN(parseFloat(result.valor))) {
      const valor = parseFloat(result.valor);
      const descricao = result.descricao || "Despesa via WhatsApp";
      const p = parseInt(result.parcela) || 1;
      const tp = parseInt(result.totalParcelas) || 1;
      
      let customTimestamp = timestamp;
      if (result.data) {
        const [y, m, d] = result.data.split('-');
        const dateObj = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
        customTimestamp = Math.floor(dateObj.getTime() / 1000) + (3 * 3600);
      }

      await saveAndConfirm(db, userId, numero, descricao, valor, "whatsapp", customTimestamp, p, tp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro no processamento de texto:", err.message);
  }
}

async function processImage(db: any, userId: string, numero: string, imageUrl: string, timestamp: number) {
  console.log(`>>> [WH-WA] Processando imagem: ${imageUrl}`);
  const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Falha ao baixar imagem");
    
    const buffer = await imgResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    const prompt = `
      Analise este comprovante e extraia em JSON:
      - estabelecimento: Nome curto.
      - valor: Valor total (número).
      - descricao: Breve descrição.
      - parcela: Parcela atual (padrão 1).
      - totalParcelas: Total parcelas (padrão 1).
      Responda APENAS o JSON puro.
    `;

    const genResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
    });

    const text = genResponse.text;
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (result.valor && !isNaN(parseFloat(result.valor))) {
      const valor = parseFloat(result.valor);
      const descricao = result.estabelecimento || result.descricao || "Comprovante via WhatsApp";
      const p = parseInt(result.parcela) || 1;
      const tp = parseInt(result.totalParcelas) || 1;
      await saveAndConfirm(db, userId, numero, descricao, valor, "whatsapp_imagem", timestamp, p, tp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro no processamento de imagem:", err.message);
  }
}

async function processAudio(db: any, userId: string, numero: string, audioUrl: string, timestamp: number) {
  console.log(`>>> [WH-WA] Processando áudio: ${audioUrl}`);
  const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("Falha ao baixar áudio");
    
    const buffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');
    const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    const prompt = `
      Transcreva e extraia em JSON:
      - descricao: O que foi pago.
      - valor: Valor total (número).
      - parcela: Parcela atual (padrão 1).
      - totalParcelas: Total parcelas (padrão 1).
      Responda APENAS o JSON puro.
    `;

    const genResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Audio, mimeType } }
        ]
      }
    });

    const text = genResponse.text;
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (result.valor && !isNaN(parseFloat(result.valor))) {
      const valor = parseFloat(result.valor);
      const descricao = result.descricao || "Despesa via Áudio";
      const p = parseInt(result.parcela) || 1;
      const tp = parseInt(result.totalParcelas) || 1;
      await saveAndConfirm(db, userId, numero, descricao, valor, "whatsapp_audio", timestamp, p, tp);
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro no processamento de áudio:", err.message);
  }
}

async function categorize(description: string) {
  const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
  if (!apiKey) return 'Outros';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    const prompt = `Classifique em uma categoria: [Alimentação, Transporte, Moradia, Assinaturas, Saúde, Lazer, Educação, Outros]. Despesa: "${description}". Retorne apenas o nome.`;

    const genResponse = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] }
    });

    const category = genResponse.text.trim();
    const validCategories = ['Alimentação', 'Transporte', 'Moradia', 'Assinaturas', 'Saúde', 'Lazer', 'Educação', 'Outros'];
    return validCategories.find(v => category.toLowerCase().includes(v.toLowerCase())) || 'Outros';
  } catch {
    return 'Outros';
  }
}

async function saveAndConfirm(db: any, userId: string, numero: string, descricao: string, valor: number, origem: string, timestamp: number, parcela = 1, totalParcelas = 1) {
  try {
    const categoria = await categorize(descricao);
    
    let baseDate = new Date(timestamp * 1000);
    baseDate.setHours(baseDate.getHours() - 3); // Brazil Time

    const groupId = totalParcelas > 1 ? `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : null;
    
    for (let i = parcela; i <= totalParcelas; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - parcela));
      const dateStr = installmentDate.toISOString().split('T')[0];

      await db.collection("lancamentos").add({
        userId,
        tipo: 'expense',
        valor,
        categoria,
        data: dateStr,
        descricao: totalParcelas > 1 ? `${descricao} (${i}/${totalParcelas})` : descricao,
        estabelecimento: descricao,
        origem,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        pago: false,
        parcela: i,
        totalParcelas,
        groupId
      });
    }

    // Confirmation
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    if (WHAPI_TOKEN) {
      const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const confirmacao = `✅ *Lançamento Confirmado!*\n\n*Item:* ${descricao}\n*Valor:* R$ ${valorFormatado}\n*Data:* ${baseDate.toLocaleDateString('pt-BR')}${totalParcelas > 1 ? `\n*Parcelas:* ${parcela}/${totalParcelas}` : ''}\n\nSua despesa foi registrada com sucesso no Dashboard.`;
      
      await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: numero, body: confirmacao })
      });
    }
  } catch (error: any) {
    console.error(">>> [WH-WA] Erro ao salvar:", error.message);
  }
}
