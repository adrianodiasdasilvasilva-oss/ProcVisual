import { initializeFirebaseAdmin, admin, FieldValue } from "./firebase-admin.js";
import { isUserAdmin, isPhoneException } from "./index.js";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  const bodyString = JSON.stringify(req.body);
  console.log(`>>> [WH-WA] Request recebida: ${req.method} ${req.url} | BodyLength: ${bodyString.length}`);
  
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const data = req.body;
    
    if (!data?.messages) {
      console.log(">>> [WH-WA] Payload sem mensagens detectado.");
      return res.status(200).json({ ok: true });
    }

    const message = data?.messages?.[0];

    if (!message || message.from_me) {
      return res.status(200).json({ ok: true });
    }

    const numero = message.from; 
    const type = message.type;
    const db = await initializeFirebaseAdmin();

    if (!db) {
      console.error(">>> [WH-WA] Abortando: DB não disponível.");
      return res.status(200).json({ ok: true });
    }

    // Normalize incoming number
    const rawNumero = String(numero || "").split('@')[0];
    const cleanIncoming = rawNumero.replace(/\D/g, "");
    
    // Brazilian normalization
    let shortIncoming = cleanIncoming;
    if (cleanIncoming.startsWith('55')) {
      shortIncoming = cleanIncoming.substring(2);
    }
    
    console.log(`>>> [WH-WA] Raw: ${numero} -> Clean: ${cleanIncoming}`);

    // Search for user
    let userDoc: any = null;
    const possibleMatches = [cleanIncoming, shortIncoming];
    
    if (shortIncoming.length === 11 && parseInt(shortIncoming.substring(0, 2)) >= 11) {
      possibleMatches.push(shortIncoming.substring(0, 2) + shortIncoming.substring(3));
    } else if (shortIncoming.length === 10 && parseInt(shortIncoming.substring(0, 2)) >= 11) {
      possibleMatches.push(shortIncoming.substring(0, 2) + "9" + shortIncoming.substring(2));
    }

    for (const telToTry of possibleMatches) {
      if (!userDoc) {
        const snap = await db.collection("usuarios").where("telefone", "==", telToTry).get();
        if (!snap.empty) {
          userDoc = snap.docs.find(d => d.data().isActive === true) || snap.docs[0];
        }
      }
    }

    if (!userDoc) {
       console.log(">>> [WH-WA] Scan profundo...");
       const snapAll = await db.collection("usuarios").limit(1000).get();
       userDoc = snapAll.docs.find(doc => {
         const d = doc.data();
         let tel = String(d.telefone || "").replace(/\D/g, "");
         if (!tel) return false;
         const sTel = tel.startsWith('55') ? tel.substring(2) : tel;
         if (tel === cleanIncoming || sTel === shortIncoming) return true;
         // 9th digit flexibility
         const isUserNinth = sTel.length === 11 && parseInt(sTel.substring(0, 2)) >= 11;
         const isIncomingNinth = shortIncoming.length === 11 && parseInt(shortIncoming.substring(0, 2)) >= 11;
         if (isUserNinth && !isIncomingNinth && shortIncoming.length === 10) return (sTel.substring(0, 2) + sTel.substring(3)) === shortIncoming;
         if (!isUserNinth && isIncomingNinth && sTel.length === 10) return (shortIncoming.substring(0, 2) + shortIncoming.substring(3)) === sTel;
         return false;
       });
    }

    let userData = userDoc ? userDoc.data() : null;
    const userId = userDoc ? userDoc.id : "whatsapp_pending";

    const fullGuide = `👋 *Olá! Este é o Guia ProcVisual no WhatsApp!*

Veja como posso te ajudar:

1️⃣ *Texto:* "Almoço 35.00" ou "Aluguel vencimento 10/05 valor 1200"
2️⃣ *Áudio:* Fale o item e o valor (ex: "Posto de gasolina, cem reais").
3️⃣ *Foto:* Envie uma foto legível do seu comprovante ou cupom fiscal.

✅ *Dica:* Se faltar alguma informação (como o valor ou o que foi pago), eu te perguntarei em seguida!

*Comandos:*
- "ajuda": Ver este guia.
- "resumo": Ver visão geral das suas contas (Receitas, Despesas e Saldo).
- "contato": Falar com nosso suporte.
- "cancelar": Limpar uma despesa que ficou pendente de informação.`;

    // Enviar guia automático para novos usuários (uma única vez)
    if (userDoc && userData && !userData.whatsappGuideSent) {
      await sendWhatsAppMessage(numero, fullGuide);
      await userDoc.ref.update({ whatsappGuideSent: true });
    }

    // Buscar pendências associadas a este número
    const pendingRef = db.collection("pendencias_whatsapp").doc(cleanIncoming);
    const pendingSnap = await pendingRef.get();
    const pendingExpense = pendingSnap.exists ? pendingSnap.get("needsField") !== undefined ? pendingSnap.data() : null : (userData?.pendingWhatsAppExpense || null);

    if (userData && userData.isActive === false && !isUserAdmin(userId, userData.email) && !isPhoneException(cleanIncoming)) {
      await sendWhatsAppMessage(numero, '⚠️ *Assinatura Inativa*\n\nPor favor regularize sua assinatura no site.');
      return res.status(200).json({ ok: true });
    }

    if (type === 'text') {
      const texto = (message.text?.body || message.body || "").trim();
      const lowerText = texto.toLowerCase().trim();
      if (lowerText === 'ajuda' || lowerText === 'me ajude' || lowerText === 'ajude me') {
        await sendWhatsAppMessage(numero, fullGuide);
      } else if (lowerText === 'resumo' || lowerText.includes('visão geral') || lowerText.includes('como estão minhas contas')) {
        await sendFinancialSummary(db, userId, numero);
      } else if (lowerText === 'contato' || lowerText.includes('falar com a procvisual') || lowerText.includes('suporte') || lowerText.includes('atendimento')) {
        const msg = `📧 *Atendimento ProcVisual*\n\nPara suporte, dúvidas ou sugestões, entre em contato através do nosso e-mail:\n\n👉 *procvisual.dashboard@gmail.com*\n\nNossa equipe terá prazer em te ajudar!`;
        await sendWhatsAppMessage(numero, msg);
      } else if (lowerText === 'cancelar' && pendingExpense) {
        await pendingRef.delete();
        if (userDoc) await userDoc.ref.update({ pendingWhatsAppExpense: FieldValue.delete() });
        await sendWhatsAppMessage(numero, "❌ Cancelado. O que deseja registrar agora?");
      } else {
        await processText(db, userId, numero, texto, message.timestamp, userData, pendingExpense);
      }
    } else if (type === 'image') {
      const imageUrl = message.image?.link;
      if (imageUrl) await processImage(db, userId, numero, imageUrl, message.timestamp, pendingExpense);
    } else if (type === 'audio' || type === 'voice') {
      const audioUrl = message.audio?.link || message.voice?.link;
      if (audioUrl) await processAudio(db, userId, numero, audioUrl, message.timestamp, pendingExpense);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error(">>> [WH-WA] Erro:", error.message);
    return res.status(200).json({ ok: true });
  }
}

async function sendWhatsAppMessage(to: string, body: string) {
  const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
  if (!WHAPI_TOKEN) return;
  let cleanNumber = to.split('@')[0].replace(/\D/g, "");
  if (cleanNumber.length === 10 || cleanNumber.length === 11) cleanNumber = "55" + cleanNumber;
  const recipient = `${cleanNumber}@s.whatsapp.net`;
  try {
    await fetch('https://gate.whapi.cloud/messages/text', {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, body, typing_delay: 2 }),
    });
  } catch (e: any) {
    console.error(">>> [WH-WA] Erro envio:", e.message);
  }
}

const EXPENSE_SCHEMA: any = {
  type: Type.OBJECT,
  properties: {
    descricao: { type: Type.STRING, description: "O que foi pago" },
    valor: { type: Type.NUMBER, description: "Valor numérico" },
    categoria: { type: Type.STRING, description: "Categoria da despesa" },
    parcela: { type: Type.INTEGER },
    totalParcelas: { type: Type.INTEGER },
    data: { type: Type.STRING }
  },
  required: ["categoria", "parcela", "totalParcelas"]
};

function extractJSON(text: string) {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? (match[1] || match[0]) : text);
  } catch (e) { return null; }
}

async function generateWithFallback(ai: any, prompt: any, sysInst: string) {
  try {
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: Array.isArray(prompt) ? { parts: prompt } : prompt,
      config: { systemInstruction: sysInst, responseMimeType: "application/json", responseSchema: EXPENSE_SCHEMA }
    });
    return response;
  } catch (e) {
    return await ai.models.generateContent({ 
      model: "gemini-3.1-pro-preview",
      contents: Array.isArray(prompt) ? { parts: prompt } : prompt,
      config: { systemInstruction: sysInst, responseMimeType: "application/json", responseSchema: EXPENSE_SCHEMA }
    });
  }
}

async function processText(db: any, userId: string, numero: string, texto: string, timestamp: number, userData: any, pending: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });
  const cleanIncoming = numero.split('@')[0].replace(/\D/g, "");
  const pendingRef = db.collection("pendencias_whatsapp").doc(cleanIncoming);

  // 1. Checar se é resposta a uma pendência
  if (pending) {
    const input = texto.trim().replace(',', '.');
    if (pending.needsField === 'valor') {
      const match = input.match(/^\d+([.]\d+)?$/);
      if (match) {
        const val = parseFloat(match[0]);
        await saveAndConfirm(db, userId, numero, { ...pending, valor: val }, "whatsapp", timestamp);
        await pendingRef.delete();
        if (userId !== "whatsapp_pending") await db.collection("usuarios").doc(userId).update({ pendingWhatsAppExpense: FieldValue.delete() });
        return;
      }
    } else if (pending.needsField === 'descricao') {
      if (input.length > 2 && !input.match(/^\d+([.]\d+)?$/)) {
        await saveAndConfirm(db, userId, numero, { ...pending, descricao: input }, "whatsapp", timestamp);
        await pendingRef.delete();
        if (userId !== "whatsapp_pending") await db.collection("usuarios").doc(userId).update({ pendingWhatsAppExpense: FieldValue.delete() });
        return;
      }
    }
  }

  // 2. Extração normal
  const brazilTime = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const prompt = `Analise a mensagem: "${texto}". Hoje é ${brazilTime}. 
  Extraia os dados para JSON. 
  CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Presentes, Outros.
  REGRAS: 
  - Se não houver VALOR numérico claro na mensagem, deixe "valor" como null.
  - Se não houver descrição, deixe "descricao" como null.
  - Escolha a categoria mais adequada ao item identificado (ex: iFood -> Alimentação, Uber -> Transporte, Netflix -> Assinaturas).`;
  
  const sysInst = "Você é um assistente financeiro inteligente. Extraia descrição, valor e a categoria mais adequada ao contexto. Se o valor não for mencionado explicitamente como um número, retorne null no campo 'valor'.";
  try {
    const resp = await generateWithFallback(ai, prompt, sysInst);
    const result = extractJSON(resp.text);
    console.log(`>>> [WH-WA] IA Bruto para "${texto}":`, JSON.stringify(result));
    
    if (!result) return;

    // Validação rigorosa do valor
    const rawValor = result.valor;
    const parsedValor = parseFloat(String(rawValor || "").replace(',', '.'));
    
    // Safety: Se não há números nem palavras de valor no texto original, não aceitar valor da IA
    const hasNumbers = /\d/.test(texto) || /(um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|cem|mil|reais|real)/i.test(texto);
    
    const isValidValor = hasNumbers && !isNaN(parsedValor) && parsedValor > 0 && parsedValor < 1000000;
    const hasDescricao = result.descricao && String(result.descricao).length > 2;

    if (isValidValor && hasDescricao) {
      result.valor = parsedValor;
      await saveAndConfirm(db, userId, numero, result, "whatsapp", timestamp);
      await pendingRef.delete();
    } else if (hasDescricao || isValidValor) {
      // Falta alguma info
      const needs = !isValidValor ? 'valor' : 'descricao';
      const pendingData = {
        ...result,
        valor: isValidValor ? parsedValor : null,
        needsField: needs,
        timestamp: Date.now()
      };
      await pendingRef.set(pendingData);
      
      const msg = needs === 'valor' 
        ? `🔍 Identifiquei *"${result.descricao}"*, mas faltou o *valor*.\n\n👉 *Qual o valor de hoje?* (Ex: 50.00)`
        : `🔍 Identifiquei o valor de *R$ ${parsedValor}*, mas não entendi *o que foi pago*.\n\n👉 *Qual a descrição?*`;
      await sendWhatsAppMessage(numero, msg + '\n\n_(Para cancelar, digite "cancelar")_');
    } else {
      await sendWhatsAppMessage(numero, "🤔 Não consegui entender os detalhes. Pode repetir informando o item e o valor? (Ex: Almoço 35.00)");
    }
  } catch (e: any) { console.error(">>> [WH-WA] Erro extração:", e.message); }
}

async function processImage(db: any, userId: string, numero: string, url: string, ts: number, pending: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const cleanIncoming = numero.split('@')[0].replace(/\D/g, "");
  const pendingRef = db.collection("pendencias_whatsapp").doc(cleanIncoming);
  try {
    await sendWhatsAppMessage(numero, '📸 Analisando imagem...');
    const buf = await (await fetch(url)).arrayBuffer();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = "Extraia dados de despesas desta imagem. CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Outros.";
    const resp = await generateWithFallback(ai, [{ text: prompt }, { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'image/jpeg' } }], "Extraia descrição, valor e a melhor categoria. Se faltar valor, retorne null.");
    const result = extractJSON(resp.text);
    if (result?.valor && result?.descricao) {
      await saveAndConfirm(db, userId, numero, result, "whatsapp_imagem", ts);
      await pendingRef.delete();
    } else if (result?.valor || result?.descricao) {
      const needs = !result.valor ? 'valor' : 'descricao';
      await pendingRef.set({ ...result, needsField: needs, timestamp: Date.now() });
      await sendWhatsAppMessage(numero, `📝 Identifiquei ${needs === 'valor' ? `*"${result.descricao}"*` : `R$ ${result.valor}`}, mas faltou o ${needs === 'valor' ? '*valor*' : '*item*'}. Qual seria?`);
    } else {
      await sendWhatsAppMessage(numero, "❌ Não consegui ler os dados. Tente digitar?");
    }
  } catch (e) { console.error(e); }
}

async function processAudio(db: any, userId: string, numero: string, url: string, ts: number, pending: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const cleanIncoming = numero.split('@')[0].replace(/\D/g, "");
  const pendingRef = db.collection("pendencias_whatsapp").doc(cleanIncoming);
  try {
    await sendWhatsAppMessage(numero, '🎙️ Transcrevendo...');
    const buf = await (await fetch(url)).arrayBuffer();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = "Transcreva a despesa do áudio e extraia os dados. CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Outros.";
    const resp = await generateWithFallback(ai, [{ text: prompt }, { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'audio/ogg' } }], "Extraia descrição, valor e a categoria mais adequada. Se faltar valor, retorne null.");
    const result = extractJSON(resp.text);
    if (result?.valor && result?.descricao) {
      await saveAndConfirm(db, userId, numero, result, "whatsapp_audio", ts);
      await pendingRef.delete();
    } else if (result?.valor || result?.descricao) {
      const needs = !result.valor ? 'valor' : 'descricao';
      await pendingRef.set({ ...result, needsField: needs, timestamp: Date.now() });
      await sendWhatsAppMessage(numero, `🎙️ Entendi ${needs === 'valor' ? `*"${result.descricao}"*` : `R$ ${result.valor}`}, mas faltou o ${needs === 'valor' ? '*valor*' : '*item*'}. Qual seria?`);
    } else {
      await sendWhatsAppMessage(numero, "🎙️ Não entendi. Pode repetir?");
    }
  } catch (e) { console.error(e); }
}

async function saveAndConfirm(db: admin.firestore.Firestore, userId: string, numero: string, data: any, origem: string, timestamp: number) {
  try {
    let { descricao, valor, categoria, parcela, totalParcelas, data: customData } = data;
    valor = parseFloat(String(valor).replace(',', '.'));
    parcela = parseInt(String(parcela || 1));
    totalParcelas = parseInt(String(totalParcelas || 1));

    if (categoria && userId !== "whatsapp_pending") {
      const predefined = [
        'Moradia', 'Alimentação', 'Transporte', 'Lazer & Entretenimento', 
        'Saúde & Bem-estar', 'Educação', 'Vestuário & Compras', 
        'Cuidados Pessoais', 'Assinaturas & Serviços', 
        'Manutenção & Reparos', 'Presentes', 'Outros', 'Aniversário'
      ];
      if (!predefined.includes(categoria)) {
        const snap = await db.collection("categorias").where("userId", "==", userId).where("nome", "==", categoria).get();
        if (snap.empty) await db.collection("categorias").add({ userId, nome: categoria, origem, createdAt: FieldValue.serverTimestamp() });
      }
    }

    let baseDate = new Date(timestamp * 1000);
    if (customData) {
      const [y, m, d] = customData.split('-');
      baseDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
    }
    baseDate.setHours(baseDate.getHours() - 3);

    const groupId = totalParcelas > 1 ? `wa_${Date.now()}` : null;
    const batch = db.batch();
    for (let i = parcela; i <= totalParcelas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + (i - parcela));
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const ref = db.collection("lancamentos").doc();
        batch.set(ref, {
            userId, tipo: 'expense', valor, categoria: categoria || 'Outros', data: dateStr,
            descricao: totalParcelas > 1 ? `${descricao} (${i}/${totalParcelas})` : descricao,
            estabelecimento: descricao, origem, telefone: numero.split('@')[0].replace(/\D/g, ""),
            createdAt: FieldValue.serverTimestamp(), pago: false, parcela: i, totalParcelas, groupId,
            notificado5dias: false, notificadoNoDia: false, notificadoAmanha: false
        });
    }
    await batch.commit();
    
    const confirmMsg = `✅ *Lançamento Confirmado!*

*Item:* ${descricao}
*Valor:* R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
*Categoria:* ${categoria || 'Outros'}
*Data:* ${baseDate.toLocaleDateString('pt-BR')}

Sua despesa foi registrada com sucesso.`;

    await sendWhatsAppMessage(numero, confirmMsg);
  } catch (error: any) {
    await sendWhatsAppMessage(numero, '❌ Erro ao salvar despesa.');
  }
}

async function sendFinancialSummary(db: any, userId: string, numero: string) {
  if (userId === "whatsapp_pending") {
    await sendWhatsAppMessage(numero, "⚠️ Você precisa vincular seu número à sua conta no site para ver seu resumo financeiro.");
    return;
  }

  try {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const year = brazilTime.getFullYear();
    const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const periodStr = `${month}/${String(year).substring(2)}`;
    const monthName = brazilTime.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();

    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-31`;

    const snap = await db.collection("lancamentos")
      .where("userId", "==", userId)
      .where("data", ">=", startOfMonth)
      .where("data", "<=", endOfMonth)
      .get();

    let totalIncome = 0;
    let totalExpense = 0;
    let categoryMap: Record<string, number> = {};
    let dayMap: Record<string, number> = {};

    snap.forEach((doc: any) => {
      const d = doc.data();
      const val = parseFloat(String(d.valor || 0));
      if (d.tipo === 'income') {
        totalIncome += val;
      } else {
        totalExpense += val;
        const cat = d.categoria || 'Outros';
        categoryMap[cat] = (categoryMap[cat] || 0) + val;
        
        const date = d.data;
        dayMap[date] = (dayMap[date] || 0) + val;
      }
    });

    // Encontrar maior gasto
    let majorCat = "Nenhum";
    let majorCatVal = 0;
    Object.entries(categoryMap).forEach(([cat, val]) => {
      if (val > majorCatVal) {
        majorCatVal = val;
        majorCat = cat;
      }
    });

    // Encontrar dia mais caro
    let mostExpensiveDay = "Nenhum";
    let mostExpensiveDayVal = 0;
    Object.entries(dayMap).forEach(([day, val]) => {
      if (val > mostExpensiveDayVal) {
        mostExpensiveDayVal = val;
        mostExpensiveDay = day;
      }
    });

    if (mostExpensiveDay !== "Nenhum") {
      const [y, m, d] = mostExpensiveDay.split('-');
      mostExpensiveDay = `${d}/${m}/${y}`;
    }

    const summary = `*Resumo financeiro - ProcVisual*

Período: ${monthName}_${String(year).substring(2)}

Receitas: R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Despesas: R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Saldo: R$ ${(totalIncome - totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

Maior gasto: ${majorCat}${majorCatVal > 0 ? ` (R$ ${majorCatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}
Dia mais caro: ${mostExpensiveDay}`;

    await sendWhatsAppMessage(numero, summary);
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro resumo:", err.message);
    await sendWhatsAppMessage(numero, "❌ Não consegui gerar seu resumo no momento.");
  }
}
