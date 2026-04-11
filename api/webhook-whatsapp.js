import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;

    console.log("Webhook recebido:", JSON.stringify(data));

    const message = data?.messages?.[0];

    // Only process incoming messages (not sent by the bot itself)
    if (message && !message.from_me) {
      const numero = message.from; // e.g. "5511999999999@s.whatsapp.net"
      const type = message.type;

      // Initialize Firebase Admin if not already initialized
      if (admin.apps.length === 0) {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          admin.initializeApp({
            projectId: firebaseConfig.projectId
          });
        }
      }

      // Get Firestore instance (respecting named database if present)
      let db;
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const dbId = firebaseConfig.firestoreDatabaseId;
        if (dbId && dbId !== '(default)') {
          db = getFirestore(dbId);
        } else {
          db = getFirestore();
        }
      } else {
        db = getFirestore();
      }

      if (type === 'text') {
        const texto = message.body || "";
        console.log("Processando texto de:", numero, "Texto:", texto);

        // Basic parsing: "Description Value"
        const parts = texto.trim().split(/\s+/);
        
        if (parts.length >= 2) {
          const valorStr = parts.pop();
          const valor = parseFloat(valorStr.replace(',', '.'));
          const descricao = parts.join(' ');

          if (!isNaN(valor)) {
            await saveAndConfirm(db, numero, descricao, valor, "whatsapp");
          }
        }
      } else if (type === 'image') {
        const imageUrl = message.image?.link;
        console.log("Processando imagem de:", numero, "URL:", imageUrl);

        if (imageUrl) {
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
                await saveAndConfirm(db, numero, descricao, valor, "whatsapp_imagem");
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
                await saveAndConfirm(db, numero, descricao, valor, "whatsapp_audio");
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
    }

    res.status(200).json({ ok: true });
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

async function saveAndConfirm(db, numero, descricao, valor, origem) {
  try {
    // Categorize automatically using AI
    const categoria = await categorize(descricao);

    // Create record in "despesas" collection
    await db.collection("despesas").add({
      descricao,
      valor,
      categoria,
      telefone: numero,
      origem,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

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
