import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

// Global Cache for Firebase Admin
let dbAdmin: admin.firestore.Firestore | null = null;

async function initializeFirebaseAdmin() {
  if (dbAdmin) return dbAdmin;
  
  console.log(">>> [WH-WA] Inicializando Firebase Admin...");
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error(">>> [WH-WA] Erro: firebase-applet-config.json não encontrado!");
    return null;
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId;

    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
    }
    
    dbAdmin = dbId && dbId !== '(default)' ? admin.firestore(dbId) : admin.firestore();
    console.log(`>>> [WH-WA] Firebase Admin inicializado no banco: ${dbId || '(default)'}`);
    return dbAdmin;
  } catch (e: any) {
    console.error(">>> [WH-WA] Erro ao inicializar Firebase Admin:", e.message);
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

    const db = await initializeFirebaseAdmin();

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
    let userDoc: any = null;
    let userData: any = null;

    // 1. Try exact match
    const snap1 = await db.collection("usuarios").where("telefone", "==", cleanIncoming).limit(5).get();
    
    if (!snap1.empty) {
      const activeUser = snap1.docs.find(d => d.data().isActive === true);
      userDoc = activeUser || snap1.docs[0];
    } else {
      // 2. Try short match
      const snap2 = await db.collection("usuarios").where("telefone", "==", shortIncoming).limit(5).get();
      if (!snap2.empty) {
        const activeUser = snap2.docs.find(d => d.data().isActive === true);
        userDoc = activeUser || snap2.docs[0];
      }
    }

    // 3. Fallback: scan
    if (!userDoc) {
       console.log(">>> [WH-WA] Usuário não encontrado em query direta. Iniciando scan...");
       const snapAll = await db.collection("usuarios").limit(500).get();
       userDoc = snapAll.docs.find(doc => {
         const d = doc.data();
         const tel = (d.telefone || "").replace(/\D/g, "");
         if (!tel) return false;
         
         const shortTel = tel.startsWith('55') ? tel.substring(2) : tel;
         
         const match = tel === cleanIncoming || 
                shortTel === shortIncoming || 
                (shortTel.length === 11 && shortIncoming.length === 10 && shortTel.substring(0, 2) === shortIncoming.substring(0, 2) && shortTel.substring(3) === shortIncoming.substring(2)) ||
                (shortTel.length === 10 && shortIncoming.length === 11 && shortIncoming.substring(0, 2) === shortTel.substring(0, 2) && shortIncoming.substring(3) === shortTel.substring(2));
         
         if (match) console.log(`>>> [WH-WA] Usuário encontrado via scan: ${d.email}`);
         return match;
       });
    }

    userData = userDoc ? userDoc.data() : null;

    if (!userData) {
      console.log(`>>> [WH-WA] Usuário NÃO cadastrado: ${cleanIncoming}`);
      await sendWhatsAppMessage(numero, '👋 *Olá! Bem-vindo à ProcVisual.*\n\nIdentificamos que seu número ainda não está vinculado a uma conta.\n\nPara usar o registro via WhatsApp, você precisa:\n1. Criar uma conta em nosso site.\n2. Cadastrar seu número de WhatsApp no seu perfil.\n3. Ter uma assinatura ativa.\n\nAcesse: https://ais-dev-7iis7a6rm3flvsuq5lpqy5-45020863239.us-east1.run.app para começar!');
      return res.status(200).json({ ok: true });
    }

    const userId = userDoc!.id;
    const isAdmin = (userData.email || "").toLowerCase() === "adrianodiasdasilva@yahoo.com.br" || 
                    (userData.email || "").toLowerCase() === "adrianodiasdasilva.silva@gmail.com" ||
                    userId === "24cC8kguY3X3IwSwfh6tTAKmJOK2" ||
                    userId === "o60eUYDOD6WD4o1j8YBZoOXqfiR2" ||
                    userId === "uCpsT3N8pAWWzAsP74qKqPTeYAt2";

    const isException = cleanIncoming.includes("19994792245") || (userData.telefone || "").replace(/\D/g, "").includes("19994792245");

    console.log(`>>> [WH-WA] Verificando Acesso: ${userData.email} (Admin: ${isAdmin}, Exception: ${isException})`);

    if (userData.isActive === false && !isAdmin && !isException) {
      console.log(`>>> [WH-WA] Usuário INATIVO: ${userData.email}`);
      await sendWhatsAppMessage(numero, '⚠️ *Assinatura Inativa*\n\nSua conta na ProcVisual está inativa. Para continuar registrando despesas via WhatsApp, por favor regularize sua assinatura no dashboard do site.');
      return res.status(200).json({ ok: true });
    }

    console.log(`>>> [WH-WA] Usuário identificado: ${userId} (${userData.email})`);

    if (type === 'text') {
      const texto = message.text?.body || message.body || "";
      if (texto.toLowerCase().trim() === 'ajuda') {
        const guide = '📖 *Guia de Uso - ProcVisual*\n\nVocê pode registrar despesas enviando:\n\n1️⃣ *Texto:* "Almoço 35.00" ou "Internet 120 amanhã"\n2️⃣ *Áudio:* Fale o que comprou e o valor.\n3️⃣ *Foto:* Envie uma foto do cupom fiscal ou comprovante.\n\n*Dica:* Para parcelas, diga algo como "Geladeira 2000 em 10x".';
        await sendWhatsAppMessage(numero, guide);
      } else {
        await processText(db, userId, numero, texto, message.timestamp, userData);
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
  
  // Clean number similar to robust sendWhatsApp in index.ts
  let cleanNumber = to.split('@')[0].replace(/\D/g, "");
  if (cleanNumber.length === 10 || cleanNumber.length === 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const recipient = `${cleanNumber}@s.whatsapp.net`;
  
  try {
    const response = await fetch('https://gate.whapi.cloud/messages/text', {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        to: recipient, 
        body,
        typing_delay: 2
      }),
    });
    if (!response.ok) {
      console.error(`>>> [WH-WA] Erro Whapi (${response.status}):`, await response.text());
    } else {
      console.log(`>>> [WH-WA] Mensagem enviada para ${recipient}`);
    }
  } catch (e: any) {
    console.error(">>> [WH-WA] Erro ao enviar mensagem:", e.message);
  }
}

const EXPENSE_SCHEMA: any = {
  type: Type.OBJECT,
  properties: {
    descricao: { type: Type.STRING, description: "O que foi pago" },
    valor: { type: Type.NUMBER, description: "Valor total ou da parcela" },
    categoria: { type: Type.STRING, description: "Categoria: Alimentação, Transporte, Moradia, Assinaturas, Saúde, Lazer, Educação, Outros" },
    parcela: { type: Type.INTEGER, description: "Parcela atual" },
    totalParcelas: { type: Type.INTEGER, description: "Total de parcelas" },
    data: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" }
  },
  required: ["descricao", "categoria", "parcela", "totalParcelas"]
};

function extractJSON(text: string) {
  try {
    // Tenta extrair JSON de blocos de código markdown se existirem
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const cleanText = match ? match[1] : text;
    return JSON.parse(cleanText.trim());
  } catch (e) {
    console.error(">>> [WH-WA] Erro ao extrair JSON:", e);
    // Tenta encontrar algo que pareça um objeto JSON { ... }
    const fallbackMatch = text.match(/\{[\s\S]*\}/);
    if (fallbackMatch) {
      try {
        return JSON.parse(fallbackMatch[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

async function generateWithFallback(ai: any, prompt: any, systemInstruction?: string) {
  const modelName = "gemini-3-flash-preview";
  
  try {
    console.log(`>>> [WH-WA] Tentando modelo: ${modelName}`);
    
    // Format contents correctly for the new SDK
    let contents: any;
    if (Array.isArray(prompt)) {
      contents = { parts: prompt };
    } else if (typeof prompt === 'string') {
      contents = prompt;
    } else {
      contents = prompt;
    }

    const response = await ai.models.generateContent({ 
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction || "Você é um assistente financeiro preciso.",
        responseMimeType: "application/json",
        responseSchema: EXPENSE_SCHEMA
      }
    });
    return response;
  } catch (e: any) {
    console.error(`>>> [WH-WA] Erro no modelo ${modelName}:`, e.message);
    
    // Fallback to gemini-3.1-pro-preview if flash fails
    try {
      console.log(`>>> [WH-WA] Tentando fallback: gemini-3.1-pro-preview`);
      const response = await ai.models.generateContent({ 
        model: "gemini-3.1-pro-preview",
        contents: typeof prompt === 'string' ? prompt : { parts: prompt },
        config: {
          systemInstruction: systemInstruction || "Você é um assistente financeiro preciso.",
          responseMimeType: "application/json",
          responseSchema: EXPENSE_SCHEMA
        }
      });
      return response;
    } catch (e2: any) {
      console.error(`>>> [WH-WA] Erro no fallback:`, e2.message);
      throw e;
    }
  }
}

async function processText(db: any, userId: string, numero: string, texto: string, timestamp: number, userData: any) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error(">>> [WH-WA] GEMINI_API_KEY não configurada!");
    return;
  }

  // 1. Verificar se é apenas um número e se há despesa pendente
  const cleanText = texto.trim().replace(',', '.');
  const isJustNumberMatch = cleanText.match(/^\d+([.]\d+)?$/);
  
  if (isJustNumberMatch && userData?.pendingWhatsAppExpense) {
    const valor = parseFloat(isJustNumberMatch[0]);
    if (valor > 0) {
      console.log(`>>> [WH-WA] Aplicando valor ${valor} à despesa pendente: ${userData.pendingWhatsAppExpense.descricao}`);
      const dataToSave = {
        ...userData.pendingWhatsAppExpense,
        valor: valor
      };
      await saveAndConfirm(db, userId, numero, dataToSave, "whatsapp", timestamp);
      
      // Limpar pendência
      await db.collection("usuarios").doc(userId).update({
        pendingWhatsAppExpense: admin.firestore.FieldValue.delete()
      });
      return;
    }
  }

  console.log(">>> [WH-WA] Usando API Key (prefixo):", apiKey.substring(0, 4) + "...");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brazilTime.toISOString().split('T')[0];

    const prompt = `Analise a mensagem do usuário: "${texto}". Hoje é ${todayStr}. 
    Extraia os dados da despesa para o formato JSON. 
    
    ATENÇÃO - REGRA DE OURO:
    - Se NÃO houver um valor monetário explícito na mensagem (ex: "50", "R$ 10", "vinte reais"), o campo "valor" DEVE ser obrigatoriamente null.
    - NUNCA invente um valor. Se a mensagem for "Água vence dia 16/04", o valor é null.
    - Se a mensagem for "Paguei a conta de luz", o valor é null.
    - SOMENTE preencha o valor se o usuário escreveu o número na mensagem.`;
    
    const sysInst = "Você é um extrator de despesas financeiras. Sua prioridade máxima é a precisão. Se um valor não for mencionado explicitamente, você deve retornar null para o campo 'valor'. Nunca invente dados.";
    const response = await generateWithFallback(ai, prompt, sysInst);
    const result = extractJSON(response.text);
    console.log(`>>> [WH-WA] Resultado IA para "${texto}":`, JSON.stringify(result));
    
    // Tratar valor 0 como nulo para forçar a pergunta
    if (result && (result.valor === 0 || result.valor === "0")) {
      result.valor = null;
    }

    if (result && result.valor !== null && result.valor !== undefined) {
      // Garantir que valor seja número
      result.valor = parseFloat(String(result.valor).replace(',', '.'));
      if (!isNaN(result.valor) && result.valor > 0) {
        await saveAndConfirm(db, userId, numero, result, "whatsapp", timestamp);
        // Limpar pendência se houver uma nova despesa completa
        if (userData?.pendingWhatsAppExpense) {
          await db.collection("usuarios").doc(userId).update({
            pendingWhatsAppExpense: admin.firestore.FieldValue.delete()
          });
        }
      } else {
        result.valor = null;
      }
    } 
    
    if (!result || result.valor === null || result.valor === undefined || result.valor <= 0) {
      if (result && result.descricao) {
        // Salvar pendência no usuário
        await db.collection("usuarios").doc(userId).update({
          pendingWhatsAppExpense: {
            descricao: result.descricao,
            categoria: result.categoria,
            data: result.data || null,
            parcela: result.parcela || 1,
            totalParcelas: result.totalParcelas || 1
          }
        });

        const msg = `📝 Identifiquei que você quer registrar *"${result.descricao}"*${result.data ? ` para o dia ${new Date(result.data).toLocaleDateString('pt-BR')}` : ''}, mas não encontrei o valor.\n\n*Qual o valor desta despesa?* (Ex: 50.00)`;
        await sendWhatsAppMessage(numero, msg);
      } else {
        await sendWhatsAppMessage(numero, "🤔 Não consegui entender os detalhes da despesa. Pode repetir informando o item e o valor? (Ex: Almoço 35.00)");
      }
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro texto:", err.message);
  }
}

async function processImage(db: admin.firestore.Firestore, userId: string, numero: string, imageUrl: string, timestamp: number) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return;

  try {
    await sendWhatsAppMessage(numero, '📸 *Processando imagem...* Aguarde um instante enquanto nossa IA analisa seu comprovante.');
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
      { text: "Extraia os dados deste comprovante." },
      { inlineData: { data: base64Image, mimeType } }
    ];

    const sysInst = "Você é um extrator de dados de comprovantes fiscais. Extraia apenas o que for visível. Se o valor total não estiver claro ou visível, retorne null para o campo 'valor'. NUNCA invente valores.";
    const response = await generateWithFallback(ai, prompt, sysInst);
    const result = extractJSON(response.text);

    // Tratar valor 0 como nulo para forçar a pergunta
    if (result && (result.valor === 0 || result.valor === "0")) {
      result.valor = null;
    }

    if (result && result.valor !== null && result.valor !== undefined && result.valor > 0) {
      result.valor = parseFloat(String(result.valor).replace(',', '.'));
      await saveAndConfirm(db, userId, numero, result, "whatsapp_imagem", timestamp);
      await db.collection("usuarios").doc(userId).update({
        pendingWhatsAppExpense: admin.firestore.FieldValue.delete()
      });
    } else if (result && result.descricao) {
      await db.collection("usuarios").doc(userId).update({
        pendingWhatsAppExpense: {
          descricao: result.descricao,
          categoria: result.categoria,
          data: result.data || null,
          parcela: result.parcela || 1,
          totalParcelas: result.totalParcelas || 1
        }
      });
      await sendWhatsAppMessage(numero, `📝 Identifiquei a despesa *"${result.descricao}"* na imagem, mas o valor não ficou claro. Poderia me informar o valor?`);
    } else {
      await sendWhatsAppMessage(numero, "❌ Não consegui ler os dados deste comprovante. Pode tentar tirar uma foto mais nítida ou digitar o valor?");
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro imagem:", err.message);
  }
}

async function processAudio(db: admin.firestore.Firestore, userId: string, numero: string, audioUrl: string, timestamp: number) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return;

  try {
    await sendWhatsAppMessage(numero, '🎙️ *Processando áudio...* Aguarde um instante enquanto transcrevemos sua despesa.');
    const audioResponse = await fetch(audioUrl);
    const buffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');
    const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';

    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
      { text: "Transcreva e extraia os dados da despesa." },
      { inlineData: { data: base64Audio, mimeType } }
    ];

    const sysInst = "Você é um assistente que transcreve áudios de despesas. Sua tarefa é extrair a descrição e o valor. Se o usuário não falar um valor numérico, o campo 'valor' DEVE ser null. NUNCA invente valores.";
    const response = await generateWithFallback(ai, prompt, sysInst);
    const result = extractJSON(response.text);

    // Tratar valor 0 como nulo para forçar a pergunta
    if (result && (result.valor === 0 || result.valor === "0")) {
      result.valor = null;
    }

    if (result && result.valor !== null && result.valor !== undefined && result.valor > 0) {
      result.valor = parseFloat(String(result.valor).replace(',', '.'));
      await saveAndConfirm(db, userId, numero, result, "whatsapp_audio", timestamp);
      await db.collection("usuarios").doc(userId).update({
        pendingWhatsAppExpense: admin.firestore.FieldValue.delete()
      });
    } else if (result && result.descricao) {
      await db.collection("usuarios").doc(userId).update({
        pendingWhatsAppExpense: {
          descricao: result.descricao,
          categoria: result.categoria,
          data: result.data || null,
          parcela: result.parcela || 1,
          totalParcelas: result.totalParcelas || 1
        }
      });
      await sendWhatsAppMessage(numero, `📝 Entendi que você falou sobre *"${result.descricao}"*, mas não identifiquei o valor. Qual seria o valor?`);
    } else {
      await sendWhatsAppMessage(numero, "🎙️ Não consegui entender o áudio. Pode repetir de forma mais clara ou digitar a despesa?");
    }
  } catch (err: any) {
    console.error(">>> [WH-WA] Erro áudio:", err.message);
  }
}

async function saveAndConfirm(db: admin.firestore.Firestore, userId: string, numero: string, data: any, origem: string, timestamp: number) {
  try {
    console.log(`>>> [WH-WA] Iniciando salvamento para usuário ${userId}...`);
    let { descricao, valor, categoria, parcela, totalParcelas, data: customData } = data;
    
    valor = parseFloat(String(valor).replace(',', '.'));
    parcela = parseInt(String(parcela || 1));
    totalParcelas = parseInt(String(totalParcelas || 1));

    if (isNaN(valor)) throw new Error("Valor inválido após conversão.");

    if (categoria) {
      const predefined = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros', 'Aniversário'];
      if (!predefined.includes(categoria)) {
        const catSnap = await db.collection("categorias")
          .where("userId", "==", userId)
          .where("nome", "==", categoria)
          .get();
        
        if (catSnap.empty) {
          await db.collection("categorias").add({
            userId,
            nome: categoria,
            origem: origem,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    let baseDate = new Date(timestamp * 1000);
    if (customData) {
      const [y, m, d] = customData.split('-');
      baseDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
    }
    baseDate.setHours(baseDate.getHours() - 3);

    const groupId = totalParcelas > 1 ? `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : null;
    
    const batch = db.batch();
    for (let i = parcela; i <= totalParcelas; i++) {
      const installmentDate = new Date(baseDate);
      installmentDate.setMonth(installmentDate.getMonth() + (i - parcela));
      const dateStr = installmentDate.toISOString().split('T')[0];

      const ref = db.collection("lancamentos").doc();
      batch.set(ref, {
        userId,
        tipo: 'expense',
        valor,
        categoria: categoria || 'Outros',
        data: dateStr,
        descricao: totalParcelas > 1 ? `${descricao} (${i}/${totalParcelas})` : descricao,
        estabelecimento: descricao,
        origem,
        telefone: numero.split('@')[0].replace(/\D/g, ""),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        pago: false,
        parcela: i,
        totalParcelas,
        groupId,
        notificado5dias: false,
        notificadoNoDia: false,
        notificadoAmanha: false
      });
    }
    await batch.commit();

    const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const confirmacao = `✅ *Lançamento Confirmado!*\n\n*Item:* ${descricao}\n*Valor:* R$ ${valorFormatado}\n*Categoria:* ${categoria}\n*Data:* ${baseDate.toLocaleDateString('pt-BR')}${totalParcelas > 1 ? `\n*Parcelas:* ${parcela}/${totalParcelas}` : ''}\n\nSua despesa foi registrada com sucesso.`;
    
    await sendWhatsAppMessage(numero, confirmacao);
  } catch (error: any) {
    console.error(">>> [WH-WA] Erro ao salvar:", error.message);
    await sendWhatsAppMessage(numero, '❌ *Erro ao processar*\n\nDesculpe, ocorreu um erro ao salvar sua despesa. Por favor, tente novamente em instantes.');
  }
}
