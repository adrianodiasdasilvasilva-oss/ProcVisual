import { initializeFirebaseAdmin, admin, FieldValue } from "./firebase-admin.js";
import { isUserAdmin, isPhoneException } from "./index.js";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // 1. WhatsApp Webhook Verification (GET handshake)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "procvisual_verify_secret";

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('>>> [WH-WA] Webhook Verificado!');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).end();
      }
    }
    return res.status(404).end();
  }

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
    const userId = userDoc ? userDoc.id : null;

    // 1. Bloqueio para usuários não identificados (SEM CONTA)
    if (!userId) {
      const msg = `⚠️ *Conta não encontrada*
      
Olá! Identificamos que este número ainda não está vinculado a uma conta ativa na *ProcVisual*.

Para começar a registrar suas despesas por aqui, você precisa:
1️⃣ Acessar nosso site: *https://procvisual.vercel.app*
2️⃣ Criar sua conta e assinar um plano.
3️⃣ Vincular seu número de WhatsApp no seu perfil.

Esperamos por você! 🚀`;
      await sendWhatsAppMessage(numero, msg);
      return res.status(200).json({ ok: true });
    }

    // 2. Bloqueio para assinaturas inativas
    if (userData && userData.isActive === false && !isUserAdmin(userId, userData.email) && !isPhoneException(cleanIncoming)) {
      await sendWhatsAppMessage(numero, '⚠️ *Assinatura Inativa*\n\nIdentificamos que sua assinatura não está ativa. Por favor, acesse o site para regularizar seu plano e continuar usando o registro via WhatsApp.');
      return res.status(200).json({ ok: true });
    }

    const fullGuide = `👋 Olá! Eu sou o Guia ProcVisual no WhatsApp.

Estou aqui para te ajudar a registrar suas receitas, despesas e lembretes de forma rápida e prática 😊

📌 Você pode enviar:

1️⃣ Texto
Exemplos:
• "Almoço 35,00"
• "Aluguel vencimento 10/05 valor 1200"

2️⃣ Áudio
Basta falar o item e o valor.
Exemplo:
🎤 “Posto de gasolina, cem reais.”

3️⃣ Foto
Envie uma foto legível do comprovante, boleto ou cupom fiscal 📸

✅ Importante:
Se faltar alguma informação (como valor, data ou descrição), eu vou te perguntar automaticamente.

💡 *Pergunte para mim:*
Você também pode me perguntar sobre suas finanças! Exemplos:
• "Quanto gastei com mercado este mês?"
• "Qual foi meu maior gasto da semana?"
• "Estou gastando muito com delivery?"

⚡ Comandos disponíveis:

• "ajuda" → Exibe este guia
• "resumo" → Mostra Receitas, Despesas e Saldo
• "excluir" → Remove o último lançamento
• "corrigir valor 50" → Altera o valor do último lançamento
• "corrigir item Mercado" → Altera a descrição do último lançamento
• "corrigir data 10/05" → Altera a data/vencimento do último lançamento
• "contato" → Falar com o suporte
• "cancelar" → Cancela um lançamento pendente

🚀 ProcVisual — Sua gestão financeira de forma simples e inteligente.`;

    // Enviar guia automático para novos usuários (uma única vez)
    if (userDoc && userData && !userData.whatsappGuideSent) {
      await sendWhatsAppMessage(numero, fullGuide);
      await userDoc.ref.update({ whatsappGuideSent: true });
    }

    // Buscar pendências associadas a este número
    const pendingRef = db.collection("pendencias_whatsapp").doc(cleanIncoming);
    const pendingSnap = await pendingRef.get();
    const pendingExpense = pendingSnap.exists ? (pendingSnap.get("needsField") !== undefined ? pendingSnap.data() : null) : (userData?.pendingWhatsAppExpense || null);

    // 3. Checar se é resposta a uma pendência de recorrência
    const pendingRecurrenceRef = db.collection("pendencias_recorrencia_whatsapp").doc(cleanIncoming);
    const pendingRecurrenceSnap = await pendingRecurrenceRef.get();
    const pendingRecurrence = pendingRecurrenceSnap.exists ? pendingRecurrenceSnap.data() : null;

    if (type === 'text') {
      const texto = (message.text?.body || message.body || "").trim();
      const lowerText = texto.toLowerCase().trim();
      
      if (pendingRecurrence && (lowerText === 'sim' || lowerText === 'pode ser' || lowerText === 'ok' || lowerText === 'quero' || lowerText === 's' || lowerText === 'ss')) {
        await setupRecurrence(db, userId, numero, pendingRecurrence);
        await pendingRecurrenceRef.delete();
        return res.status(200).json({ ok: true });
      } else if (pendingRecurrence) {
        await pendingRecurrenceRef.delete();
        if (lowerText === 'não' || lowerText === 'n' || lowerText === 'nao') {
           await sendWhatsAppMessage(numero, "Entendido! Lançamento mantido como único. 👍");
           return res.status(200).json({ ok: true });
        }
        // Se for outra coisa, ignora a recorrência e processa o texto normalmente
      }

      if (lowerText === 'ajuda' || lowerText === 'me ajude' || lowerText === 'ajude me') {
        await sendWhatsAppMessage(numero, fullGuide);
      } else if (lowerText === 'resumo' || lowerText.includes('visão geral') || lowerText.includes('como estão minhas contas')) {
        await sendFinancialSummary(db, userId, numero);
      } else if (lowerText === 'contato' || lowerText.includes('falar com a procvisual') || lowerText.includes('suporte') || lowerText.includes('atendimento')) {
        const msg = `📧 *Atendimento ProcVisual*\n\nPara suporte, dúvidas ou sugestões, entre em contato através do nosso e-mail:\n\n👉 *procvisual.dashboard@gmail.com*\n\nNossa equipe terá prazer em te ajudar!`;
        await sendWhatsAppMessage(numero, msg);
      } else if (lowerText === 'excluir' || lowerText === 'desfazer' || lowerText === 'apagar') {
        await undoLastEntry(db, userId, numero);
      } else if (lowerText.startsWith('corrigir')) {
        await correctLastEntry(db, userId, numero, texto);
      } else if (lowerText === 'cancelar' && pendingExpense) {
        await pendingRef.delete();
        if (userDoc) await userDoc.ref.update({ pendingWhatsAppExpense: FieldValue.delete() });
        await sendWhatsAppMessage(numero, "❌ Cancelado. O que deseja registrar agora?");
      } else {
        // 4. Detecção de Pergunta para o Analista Financeiro IA
        const isQuestion = lowerText.endsWith('?') || 
                          /^(quanto|qual|quais|como|estou|cadê|mostra|me diga|onde|quem|gast|saldo|quanto|limite)/i.test(lowerText);
        
        if (isQuestion && lowerText.length > 5) {
          await handleFinancialQuery(db, userId, numero, texto);
        } else {
          await processText(db, userId, numero, texto, message.timestamp, userData, pendingExpense);
        }
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
    data: { type: Type.STRING },
    transcricao: { type: Type.STRING, description: "O que foi dito / lido exatamente" }
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
        await db.collection("usuarios").doc(userId).update({ pendingWhatsAppExpense: FieldValue.delete() });
        return;
      }
    } else if (pending.needsField === 'descricao') {
      if (input.length > 2 && !input.match(/^\d+([.]\d+)?$/)) {
        await saveAndConfirm(db, userId, numero, { ...pending, descricao: input }, "whatsapp", timestamp);
        await pendingRef.delete();
        await db.collection("usuarios").doc(userId).update({ pendingWhatsAppExpense: FieldValue.delete() });
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
  - Se não houver VALOR numérico claro na mensagem (um valor monetário), deixe "valor" como null. 
  - NÃO confunda números de DATAS (ex: 15/05) com VALOR.
  - Se não houver descrição, deixe "descricao" como null.
  - Escolha a categoria mais adequada ao item identificado.`;
  
  const sysInst = "Você é um assistente financeiro rigoroso. Só extraia o 'valor' se ele for explicitamente mencionado como um preço ou quantia. Se o usuário só disse uma data e um item, 'valor' DEVE ser null. Jamais invente valores.";
  try {
    const resp = await generateWithFallback(ai, prompt, sysInst);
    const result = extractJSON(resp.text);
    console.log(`>>> [WH-WA] IA Bruto para "${texto}":`, JSON.stringify(result));
    
    if (!result) return;

    // Validação rigorosa do valor
    const rawValor = result.valor;
    const parsedValor = parseFloat(String(rawValor || "").replace(',', '.'));
    
    // Safety: Tentar remover padrões de data para checar se sobra algum número
    const textWithoutDates = texto.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/, "").replace(/\d{1,2}-\d{1,2}(-\d{2,4})?/, "");
    const hasClearNumbers = /\d/.test(textWithoutDates) || /(um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|cem|mil|reais|real)/i.test(texto);
    
    // Adicional: verificar se o valor retornado pela IA (ou parte dele) existe no texto original
    const valorStr = String(rawValor || "");
    const valorNumStr = String(parsedValor);
    const valorCommaStr = valorNumStr.replace('.', ',');
    const hasValorInText = texto.includes(valorStr) || 
                          (parsedValor > 0 && (texto.includes(valorNumStr) || texto.includes(valorCommaStr) || texto.includes(String(Math.floor(parsedValor)))));
    
    // Se identificou palavras de valor (reais, cem, etc), damos um voto de confiança mesmo sem o número exato bater no texto (devido a escrita por extenso)
    const hasValueWords = /(um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|mil|reais|real)/i.test(texto);

    const isValidValor = (hasClearNumbers || hasValueWords) && (hasValorInText || hasValueWords) && !isNaN(parsedValor) && parsedValor > 0 && parsedValor < 1000000;
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
    const sysInst = "Extraia descrição, valor e melhor categoria desta imagem de despesa. CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Outros. Se não houver valor claro, retorne null.";
    const resp = await generateWithFallback(ai, [{ text: prompt }, { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'image/jpeg' } }], sysInst);
    const result = extractJSON(resp.text);

    if (result && result.valor && result.descricao) {
      const val = parseFloat(String(result.valor).replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 50000) {
        await saveAndConfirm(db, userId, numero, { ...result, valor: val }, "whatsapp_imagem", ts);
        await pendingRef.delete();
        return;
      }
    }

    if (result && (result.valor || result.descricao)) {
      const needs = !result.valor ? 'valor' : 'descricao';
      await pendingRef.set({ ...result, needsField: needs, timestamp: Date.now() });
      await sendWhatsAppMessage(numero, `📸 Identifiquei ${needs === 'valor' ? `*"${result.descricao}"*` : `R$ ${result.valor}`}, mas faltou o ${needs === 'valor' ? '*valor*' : '*item*'}. Qual seria?`);
    } else {
      await sendWhatsAppMessage(numero, "❌ Não consegui ler os dados desta imagem. Tente digitar o valor?");
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
    
    const brazilTime = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const prompt = `Transcreva a despesa do áudio e extraia os dados. Hoje é ${brazilTime}. CATEGORIAS: Alimentação, Moradia, Transporte, Lazer & Entretenimento, Saúde & Bem-estar, Educação, Vestuário & Compras, Cuidados Pessoais, Assinaturas & Serviços, Manutenção & Reparos, Presentes, Outros.`;
    const sysInst = "Extraia descrição, valor e categoria. Retorne também o texto falado no campo 'transcricao'. REGRA: Se o usuário NÃO disse um valor numérico explicitamente, coloque 'valor' como null. NÃO invente valores baseado no item falado.";
    
    const resp = await generateWithFallback(ai, [{ text: prompt }, { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'audio/ogg' } }], sysInst);
    const result = extractJSON(resp.text);
    console.log(`>>> [WH-WA] Áudio Bruto:`, JSON.stringify(result));

    if (!result) {
      await sendWhatsAppMessage(numero, "🎙️ Não consegui processar seu áudio. Pode repetir?");
      return;
    }

    const transcricao = result.transcricao || "";
    // Mesma lógica de validação de números/palavras de valor do texto
    const hasNumbers = /\d/.test(transcricao) || /(um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|reais|real)/i.test(transcricao);
    
    let currentValor = result.valor;
    if (currentValor && !hasNumbers) {
      console.log(">>> [WH-WA] Áudio: Valor detectado pela IA mas sem números na transcrição. Ignorando valor.");
      currentValor = null;
    }

    const val = currentValor ? parseFloat(String(currentValor).replace(',', '.')) : null;
    const isValidValor = val !== null && !isNaN(val) && val > 0 && val < 1000000;
    const hasDescricao = result.descricao && String(result.descricao).length > 2;

    if (isValidValor && hasDescricao) {
      await saveAndConfirm(db, userId, numero, { ...result, valor: val }, "whatsapp_audio", ts);
      await pendingRef.delete();
    } else if (hasDescricao || isValidValor) {
      const needs = !isValidValor ? 'valor' : 'descricao';
      await pendingRef.set({ ...result, valor: isValidValor ? val : null, needsField: needs, timestamp: Date.now() });
      
      const msg = needs === 'valor'
        ? `🎙️ Identifiquei *"${result.descricao}"*, mas não ouvi o *valor*.\n\n👉 *Qual o valor?* (Ex: 50.00)`
        : `🎙️ Identifiquei o valor de *R$ ${val}*, mas não entendi *o que foi pago*.\n\n👉 *Qual a descrição?*`;
      await sendWhatsAppMessage(numero, msg + '\n\n_(Para cancelar, digite "cancelar")_');
    } else {
      await sendWhatsAppMessage(numero, "🎙️ Não entendi claramente o item e o valor. Pode falar novamente?");
    }
  } catch (e: any) { 
    console.error(">>> [WH-WA] Erro Áudio:", e.message);
    await sendWhatsAppMessage(numero, "❌ Erro ao processar áudio.");
  }
}

async function saveAndConfirm(db: admin.firestore.Firestore, userId: string, numero: string, data: any, origem: string, timestamp: number) {
  try {
    let { descricao, valor, categoria, parcela, totalParcelas, data: customData } = data;
    valor = parseFloat(String(valor).replace(',', '.'));
    parcela = parseInt(String(parcela || 1));
    totalParcelas = parseInt(String(totalParcelas || 1));

    if (categoria) {
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

    let baseDate: Date;
    const safeTimestamp = parseInt(String(timestamp || ""));
    const validTimestamp = !isNaN(safeTimestamp) && safeTimestamp > 0;

    if (customData && typeof customData === 'string' && customData.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = customData.split('-');
      baseDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
    } else if (validTimestamp) {
      baseDate = new Date(safeTimestamp * 1000);
      baseDate.setHours(baseDate.getHours() - 3);
    } else {
      baseDate = new Date();
      baseDate.setHours(baseDate.getHours() - 3);
    }

    if (isNaN(baseDate.getTime())) {
      baseDate = new Date();
      baseDate.setHours(baseDate.getHours() - 3);
    }

    const groupId = totalParcelas > 1 ? `wa_${Date.now()}` : null;
    const batch = db.batch();
    let firstDocId = "";
    for (let i = parcela; i <= totalParcelas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + (i - parcela));
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const ref = db.collection("lancamentos").doc();
        if (i === parcela) firstDocId = ref.id;
        batch.set(ref, {
            userId, tipo: 'expense', valor, categoria: categoria || 'Outros', data: dateStr,
            descricao: totalParcelas > 1 ? `${descricao} (${i}/${totalParcelas})` : descricao,
            estabelecimento: descricao, origem, telefone: numero.split('@')[0].replace(/\D/g, ""),
            createdAt: FieldValue.serverTimestamp(), pago: false, parcela: i, totalParcelas, groupId,
            notificado5dias: false, notificadoNoDia: false, notificadoAmanha: false
        });
    }
    await batch.commit();
    
    // Check for recurrence suggestion (if it's a new single expense)
    if (totalParcelas === 1 && (origem === 'whatsapp' || origem === 'whatsapp_audio')) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 2);
      
      const historySnap = await db.collection("lancamentos")
        .where("userId", "==", userId)
        .where("descricao", "==", descricao)
        .where("data", ">=", lastMonth.toISOString().split('T')[0])
        .limit(5)
        .get();

      // Se já houver ao menos 1 registro com mesmo nome nos últimos 2 meses (além deste que acabamos de criar)
      if (historySnap.size >= 2) {
        const cleanIncoming = numero.split('@')[0].replace(/\D/g, "");
        await db.collection("pendencias_recorrencia_whatsapp").doc(cleanIncoming).set({
          lancamentoId: firstDocId,
          descricao,
          valor,
          categoria: categoria || 'Outros',
          data: baseDate.toISOString().split('T')[0],
          timestamp: Date.now()
        });

        const confirmMsg = `✅ *Lançamento Confirmado!*
  
*Item:* ${descricao}
*Valor:* R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
*Data:* ${baseDate.toLocaleDateString('pt-BR')}

💡 *Dica Inteligente:*
Percebi que você lançou *"${descricao}"* novamente. Deseja transformar em uma despesa recorrente mensal? (Responda *"Sim"* para repetir por 12 meses)`;
        await sendWhatsAppMessage(numero, confirmMsg);
        return;
      }
    }

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

async function setupRecurrence(db: any, userId: string, numero: string, data: any) {
  try {
    const { descricao, valor, categoria, data: dateStr } = data;
    const baseDate = new Date(dateStr + 'T12:00:00Z');
    const groupId = `recur_${Date.now()}`;
    const totalParcelas = 12;

    const batch = db.batch();
    // Já temos o primeiro (que foi o gatilho), vamos criar os outros 11
    for (let i = 2; i <= totalParcelas; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + (i - 1));
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ref = db.collection("lancamentos").doc();
      batch.set(ref, {
        userId, tipo: 'expense', valor, categoria, data: ds,
        descricao: `${descricao} (${i}/${totalParcelas})`,
        estabelecimento: descricao, origem: "whatsapp_recorrente", 
        telefone: numero.split('@')[0].replace(/\D/g, ""),
        createdAt: FieldValue.serverTimestamp(), pago: false, parcela: i, totalParcelas, groupId,
        notificado5dias: false, notificadoNoDia: false, notificadoAmanha: false
      });
    }

    // Atualizar o primeiro documento para refletir o grupo e as parcelas
    const firstRef = db.collection("lancamentos").doc(data.lancamentoId);
    batch.update(firstRef, { 
      groupId, 
      totalParcelas, 
      parcela: 1, 
      descricao: `${descricao} (1/${totalParcelas})` 
    });

    await batch.commit();

    await sendWhatsAppMessage(numero, `🚀 Perfeito! Agendei as próximas 11 parcelas mensais de *"${descricao}"* para você. Totalizando 12 meses.`);
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro setupRecurrence:", err.message);
    await sendWhatsAppMessage(numero, "❌ Ocorreu um erro ao configurar a recorrência.");
  }
}

async function undoLastEntry(db: any, userId: string, numero: string) {
  try {
    const snap = await db.collection("lancamentos")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      await sendWhatsAppMessage(numero, "🔍 Não encontrei nenhum lançamento recente para excluir.");
      return;
    }

    const lastDoc = snap.docs[0];
    const data = lastDoc.data();
    await lastDoc.ref.delete();

    const msg = `🗑️ *Lançamento Excluído!*
    
*Item:* ${data.descricao}
*Valor:* R$ ${parseFloat(data.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}

O último registro foi removido com sucesso.`;
    await sendWhatsAppMessage(numero, msg);
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro excluir:", err.message);
    await sendWhatsAppMessage(numero, "❌ Erro ao tentar excluir o lançamento.");
  }
}

async function handleFinancialQuery(db: any, userId: string, numero: string, query: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Buscar lançamentos recentes (últimos 60 dias) para contexto
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const snap = await db.collection("lancamentos")
      .where("userId", "==", userId)
      .where("data", ">=", sixtyDaysAgo.toISOString().split('T')[0])
      .get();

    const transactions = snap.docs.map((d: any) => {
      const data = d.data();
      return {
        data: data.data,
        tipo: data.tipo,
        valor: data.valor,
        descricao: data.descricao,
        categoria: data.categoria,
        pago: data.pago
      };
    });

    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const context = JSON.stringify(transactions);

    const prompt = `O usuário perguntou no WhatsApp: "${query}". 
    Hoje é ${brazilTime}. 
    
    Aqui está a lista de lançamentos dos últimos 60 dias dele em JSON:
    ${context}
    
    INSTRUÇÕES PARA RESPONDER:
    1. Seja um Analista Financeiro inteligente, amigável e conciso (Tom ProcVisual).
    2. Use os dados acima para responder de forma precisa. Se perguntar "Quanto gastei com X", some os valores.
    3. Se não houver dados sobre o que ele perguntou, diga educadamente.
    4. Formate a resposta com Emojis e Negritos para facilitar a leitura no celular.
    5. Se identificar uma tendência negativa (gastou mais que mês passado), dê uma dica construtiva curta.
    6. Jamais invente dados que não estão no JSON de contexto acima.
    7. Responda diretamente à pergunta.`;

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();

    if (answer) {
      await sendWhatsAppMessage(numero, answer);
    } else {
      await sendWhatsAppMessage(numero, "🤔 Desculpe, não consegui analisar suas informações agora.");
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro handleFinancialQuery:", err.message);
    await sendWhatsAppMessage(numero, "❌ Ocorreu um erro ao processar sua pergunta. Tente novamente mais tarde.");
  }
}

async function correctLastEntry(db: any, userId: string, numero: string, texto: string) {
  try {
    const lower = texto.toLowerCase();
    let field = "";
    let newVal: any = null;

    if (lower.includes("valor")) {
      field = "valor";
      const match = texto.match(/\d+([,.]\d+)?/);
      if (match) newVal = parseFloat(match[0].replace(',', '.'));
    } else if (lower.includes("item") || lower.includes("descrição") || lower.includes("descricao")) {
      field = "descricao";
      newVal = texto.replace(/corrigir (item|descrição|descricao) (para )?/i, "").trim();
    } else if (lower.includes("data") || lower.includes("vencimento")) {
      field = "data";
      const dateMatch = texto.match(/(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, '0');
        const m = dateMatch[2].padStart(2, '0');
        let y = dateMatch[4] || new Date().getFullYear().toString();
        if (y.length === 2) y = "20" + y;
        newVal = `${y}-${m}-${d}`;
      }
    }

    if (!field || newVal === null || newVal === "") {
      await sendWhatsAppMessage(numero, "🤔 Não entendi o que você quer corrigir. Tente:\n- *corrigir valor 50.00*\n- *corrigir item Almoço*\n- *corrigir data 10/05*");
      return;
    }

    const snap = await db.collection("lancamentos")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      await sendWhatsAppMessage(numero, "🔍 Não encontrei nenhum lançamento recente para corrigir.");
      return;
    }

    const lastDoc = snap.docs[0];
    const oldData = lastDoc.data();
    
    const updateObj: any = { 
      [field]: newVal, 
      updatedAt: FieldValue.serverTimestamp() 
    };
    if (field === "descricao") updateObj.estabelecimento = newVal;

    await lastDoc.ref.update(updateObj);

    let antesStr = "";
    let agoraStr = "";

    if (field === "valor") {
      antesStr = `R$ ${parseFloat(oldData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      agoraStr = `R$ ${newVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } else if (field === "data") {
      const [yA, mA, dA] = oldData.data.split('-');
      const [yN, mN, dN] = newVal.split('-');
      antesStr = `${dA}/${mA}/${yA}`;
      agoraStr = `${dN}/${mN}/${yN}`;
    } else {
      antesStr = oldData.descricao;
      agoraStr = newVal;
    }

    const msg = `✏️ *Lançamento Corrigido!*
    
*Antes:* ${antesStr}
*Agora:* ${agoraStr}

Informação atualizada com sucesso.`;
    await sendWhatsAppMessage(numero, msg);
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro corrigir:", err.message);
    await sendWhatsAppMessage(numero, "❌ Erro ao tentar corrigir o lançamento.");
  }
}
