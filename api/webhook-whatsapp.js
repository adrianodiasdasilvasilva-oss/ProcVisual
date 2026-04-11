import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  doc,
  getDoc
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Cache for Firebase instance
let firebaseApp = null;
let firestoreDb = null;

function getFirebase() {
  if (firestoreDb) return { app: firebaseApp, db: firestoreDb };

  console.log(">>> [WEBHOOK] Inicializando Firebase Client SDK...");
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  
  let config;
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log(">>> [WEBHOOK] Configuração lida do arquivo.");
  } else {
    // Fallback for environment variables
    config = {
      apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID
    };
    console.log(">>> [WEBHOOK] Usando variáveis de ambiente para configuração.");
  }

  if (!config.apiKey || !config.projectId) {
    console.error(">>> [WEBHOOK] Erro: Configuração do Firebase incompleta!");
    return { app: null, db: null };
  }

  firebaseApp = initializeApp(config);
  // Respect named database if present
  firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId || '(default)');
  
  return { app: firebaseApp, db: firestoreDb };
}

export default async function handler(req, res) {
  console.log(`>>> [WEBHOOK] Request recebida: ${req.method} ${req.url}`);
  
  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log(">>> [WEBHOOK] Payload:", JSON.stringify(data));

      const message = data?.messages?.[0];

      if (!message) {
        if (data?.statuses) {
          console.log(">>> [WEBHOOK] Recebida atualização de status (lido/entregue). Ignorando para evitar duplicidade.");
        } else {
          console.log(">>> [WEBHOOK] Payload recebido sem mensagens reconhecidas.");
        }
        return res.status(200).json({ ok: true });
      }

      // Only process incoming messages (not sent by the bot itself)
      if (message.from_me) {
        console.log(">>> [WEBHOOK] Ignorando mensagem enviada pelo próprio bot.");
        return res.status(200).json({ ok: true });
      }

      console.log(">>> [WEBHOOK] Processando nova mensagem de:", message.from);
      const numero = message.from; 
      const type = message.type;

      const { db } = getFirebase();
      if (!db) {
        console.error(">>> [WEBHOOK] Abortando: Banco de dados não disponível.");
        return res.status(200).json({ ok: true });
      }

        if (type === 'text') {
          const texto = message.text?.body || message.body || "";
          console.log(`>>> [WEBHOOK] Texto extraído: "${texto}"`);
          console.log("Processando texto de:", numero, "Texto:", texto);
          console.log("Extraindo valor");

          // Basic parsing: "Description Value"
          const parts = texto.trim().split(/\s+/);
          
          if (parts.length >= 2) {
            const valorStr = parts.pop();
            const valor = parseFloat(valorStr.replace(',', '.'));
            const descricao = parts.join(' ');

            if (!isNaN(valor)) {
              await saveAndConfirm(db, numero, descricao, valor, "whatsapp", message.timestamp);
            }
          }
        } else if (type === 'image') {
          const imageUrl = message.image?.link;
          console.log("Processando imagem de:", numero, "URL:", imageUrl);

          if (imageUrl) {
            console.log("Extraindo valor");
            try {
              // Download image
              const imgResponse = await fetch(imageUrl);
              if (!imgResponse.ok) throw new Error("Falha ao baixar imagem do Whapi");
              
              const buffer = await imgResponse.arrayBuffer();
              const base64Image = Buffer.from(buffer).toString('base64');
              const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

              // Gemini Analysis
              const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
              if (apiKey) {
                const ai = new GoogleGenAI({ apiKey });
                const model = "gemini-3-flash-preview";
                const prompt = `
                  Analise este comprovante de pagamento ou nota fiscal e extraia as seguintes informações em formato JSON:
                  - estabelecimento: O nome curto e direto do estabelecimento ou emissor (ex: Lojas Cem).
                  - valor: O valor total (apenas números, use ponto para decimais).
                  - descricao: Uma breve descrição do que foi pago.
                  Responda APENAS o JSON puro, sem blocos de código markdown.
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
                console.log(">>> Gemini Resposta:", text);
                
                const cleanJson = text.replace(/```json|```/g, '').trim();
                const result = JSON.parse(cleanJson);

                if (result.valor && !isNaN(parseFloat(result.valor))) {
                  const valor = parseFloat(result.valor);
                  const descricao = result.estabelecimento || result.descricao || "Comprovante via WhatsApp";
                  await saveAndConfirm(db, numero, descricao, valor, "whatsapp_imagem", message.timestamp);
                } else {
                  console.log(">>> [WHATSAPP] Gemini não encontrou valor numérico na imagem.");
                }
              } else {
                console.error(">>> [WHATSAPP] GEMINI_API_KEY não configurada.");
              }
            } catch (err) {
              console.error(">>> [WHATSAPP] Erro no processamento de imagem:", err);
            }
          }
        } else if (type === 'audio' || type === 'voice') {
          const audioUrl = message.audio?.link || message.voice?.link;
          console.log("Processando áudio de:", numero, "URL:", audioUrl);

          if (audioUrl) {
            console.log("Extraindo valor");
            try {
              // Download audio
              const audioResponse = await fetch(audioUrl);
              if (!audioResponse.ok) throw new Error("Falha ao baixar áudio do Whapi");
              
              const buffer = await audioResponse.arrayBuffer();
              const base64Audio = Buffer.from(buffer).toString('base64');
              const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';

              // Gemini Analysis (Transcription + Extraction)
              const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
              if (apiKey) {
                const ai = new GoogleGenAI({ apiKey });
                const model = "gemini-3-flash-preview";
                const prompt = `
                  Transcreva este áudio e extraia as informações de despesa em formato JSON:
                  - descricao: O que foi pago (ex: Uber, Mercado, Almoço).
                  - valor: O valor total (apenas números, use ponto para decimais).
                  
                  Exemplo de áudio: "Gastei 25 reais no Uber"
                  Resposta: {"descricao": "Uber", "valor": 25}
                  
                  Responda APENAS o JSON puro, sem blocos de código markdown.
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
                console.log(">>> Gemini Resposta (Áudio):", text);
                
                const cleanJson = text.replace(/```json|```/g, '').trim();
                const result = JSON.parse(cleanJson);

                if (result.valor && !isNaN(parseFloat(result.valor))) {
                  const valor = parseFloat(result.valor);
                  const descricao = result.descricao || "Despesa via Áudio";
                  await saveAndConfirm(db, numero, descricao, valor, "whatsapp_audio", message.timestamp);
                } else {
                  console.log(">>> [WHATSAPP] Gemini não encontrou valor numérico no áudio.");
                }
              } else {
                console.error(">>> [WHATSAPP] GEMINI_API_KEY não configurada.");
              }
            } catch (err) {
              console.error(">>> [WHATSAPP] Erro no processamento de áudio:", err);
            }
          }
        }
    } catch (error) {
      console.error("Erro ao processar:", error);
    }

    return res.status(200).json({ ok: true });
  } else {
    res.status(405).end();
  }
}

async function categorize(description) {
  const apiKey = process.env.GEMINI_API_KEY_ || process.env.GEMINI_API_KEY;
  if (!apiKey) return 'Outros';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    const prompt = `Classifique a despesa abaixo em apenas uma categoria da lista:
[Alimentação, Transporte, Moradia, Assinaturas, Saúde, Lazer, Educação, Outros]

Despesa: "${description}"

Retorne apenas o nome da categoria.`;

    const genResponse = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] }
    });

    const category = genResponse.text.trim();
    const validCategories = ['Alimentação', 'Transporte', 'Moradia', 'Assinaturas', 'Saúde', 'Lazer', 'Educação', 'Outros'];
    
    // Check if the exact category was returned
    if (validCategories.includes(category)) {
      return category;
    }
    
    // Fallback: search for category name in the response
    for (const valid of validCategories) {
      if (category.toLowerCase().includes(valid.toLowerCase())) {
        return valid;
      }
    }

    return 'Outros';
  } catch (error) {
    console.error(">>> [WHATSAPP] Erro na categorização por IA:", error);
    return 'Outros';
  }
}

async function saveAndConfirm(db, numero, descricao, valor, origem, timestamp = null) {
  try {
    console.log(`>>> [WHATSAPP] Iniciando salvamento: ${descricao} | R$ ${valor}`);
    
    // 1. Clean phone number
    const rawNumero = numero.split('@')[0];
    const cleanNumero = rawNumero.replace(/\D/g, "");
    console.log(`>>> [WHATSAPP] Telefone do remetente: ${cleanNumero}`);
    
    // 2. Use a "pending" userId
    const userId = "whatsapp_pending"; 

    // 3. Categorize automatically using AI
    console.log(">>> [WHATSAPP] Definindo categoria...");
    const categoria = await categorize(descricao);
    console.log(`>>> [WHATSAPP] Categoria definida: ${categoria}`);

    console.log(">>> [WHATSAPP] Salvando no Firebase (lancamentos)...");
    
    // 4. Prepare data for "lancamentos" collection
    // Use message timestamp adjusted for Brazil (UTC-3)
    let today;
    if (timestamp) {
      const date = new Date(timestamp * 1000);
      // Adjust for Brazil (UTC-3)
      date.setHours(date.getHours() - 3);
      today = date.toISOString().split('T')[0];
    } else {
      // Fallback to current time adjusted for Brazil
      const now = new Date();
      now.setHours(now.getHours() - 3);
      today = now.toISOString().split('T')[0];
    }
    
    const transactionData = {
      userId,
      telefone: cleanNumero,
      tipo: 'expense',
      valor,
      categoria,
      data: today,
      descricao: descricao,
      estabelecimento: descricao,
      origem,
      createdAt: serverTimestamp(),
      pago: true
    };

    const docRef = await addDoc(collection(db, "lancamentos"), transactionData);
    console.log(`>>> [WHATSAPP] Despesa salva como PENDENTE! ID: ${docRef.id}`);
    console.log(`>>> [WHATSAPP] Despesa registrada (${origem}): ${descricao} | R$ ${valor} | Categoria: ${categoria} | De: ${numero}`);

    // Send confirmation message via Whapi
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    if (WHAPI_TOKEN) {
      const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      let prefix = "Despesa registrada";
      if (origem === "whatsapp_imagem") prefix = "Comprovante recebido e registrado";
      if (origem === "whatsapp_audio") prefix = "Despesa registrada por áudio";
      
      const confirmacao = `${prefix}: ${descricao} - R$ ${valorFormatado}`;
      
      try {
        const response = await fetch('https://gate.whapi.cloud/messages/text', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHAPI_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: numero,
            body: confirmacao
          })
        });
        
        if (response.ok) {
          console.log(`>>> [WHATSAPP] Confirmação enviada para ${numero}`);
        } else {
          const errorData = await response.json();
          console.error(">>> [WHATSAPP] Erro na API Whapi ao enviar confirmação:", errorData);
        }
      } catch (fetchError) {
        console.error(">>> [WHATSAPP] Erro de rede ao enviar confirmação via Whapi:", fetchError);
      }
    } else {
      console.warn(">>> [WHATSAPP] WHAPI_TOKEN não configurado. Confirmação não enviada.");
    }
  } catch (error) {
    console.error(">>> [WHATSAPP] Erro ao salvar no Firestore:", error);
  }
}
