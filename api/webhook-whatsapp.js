import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;

    console.log("Webhook recebido:", JSON.stringify(data));

    const message = data?.messages?.[0];

    // Only process incoming messages (not sent by the bot itself)
    if (message && !message.from_me) {
      const numero = message.from; // e.g. "5511999999999@s.whatsapp.net"
      const texto = message.body || "";

      console.log("Processando mensagem de:", numero);
      console.log("Texto:", texto);

      // Basic parsing: "Description Value"
      // We split by space and assume the last part is the value
      const parts = texto.trim().split(/\s+/);
      
      if (parts.length >= 2) {
        const valorStr = parts.pop();
        const valor = parseFloat(valorStr.replace(',', '.'));
        const descricao = parts.join(' ');

        if (!isNaN(valor)) {
          try {
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

            // Create record in "despesas" collection
            await db.collection("despesas").add({
              descricao,
              valor,
              telefone: numero,
              origem: "whatsapp",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`>>> [WHATSAPP] Despesa registrada: ${descricao} | R$ ${valor} | De: ${numero}`);
          } catch (error) {
            console.error(">>> [WHATSAPP] Erro ao salvar no Firestore:", error);
          }
        } else {
          console.log(">>> [WHATSAPP] Valor numérico não encontrado na mensagem.");
        }
      } else {
        console.log(">>> [WHATSAPP] Formato de mensagem inválido (esperado: 'descricao valor').");
      }
    }

    res.status(200).json({ ok: true });
  } else {
    res.status(405).end();
  }
}
