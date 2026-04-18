import { initializeFirebaseAdmin, admin, FieldValue } from "./firebase-admin.js";
import Stripe from 'stripe';
import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: any): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function sendWhatsApp(to: string, message: string) {
  const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
  if (!WHAPI_TOKEN) return { success: false, error: "Token ausente" };
  let cleanNumber = to.replace(/\D/g, "");
  if (cleanNumber.length === 10 || cleanNumber.length === 11) cleanNumber = "55" + cleanNumber;
  const recipient = `${cleanNumber}@s.whatsapp.net`;

  try {
    const response = await fetch(`https://gate.whapi.cloud/messages/text`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHAPI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, body: message }),
    });
    return response.ok ? { success: true } : { success: false, error: await response.text() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = (process.env.STRIPE_SECRET_KEY || "").trim();

  if (!sig || !endpointSecret || !stripeKey) {
    return res.status(400).send("Webhook Error: Configuração ausente.");
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const rawBody = await getRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);

    console.log(`>>> [WEBHOOK] Evento: ${event.type}`);

    const db = await initializeFirebaseAdmin();
    if (!db) throw new Error("Firebase não disponível");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;
        const customerPhone = session.customer_details?.phone;

          if (userId) {
            console.log(`>>> [WEBHOOK] Ativando premium para: ${userId}`);
            const updateData: any = {
              isActive: true,
              plan: "premium",
              subscriptionId: subscriptionId,
              updatedAt: FieldValue.serverTimestamp()
            };

            if (customerPhone) {
              updateData.telefone = customerPhone.replace(/\D/g, "");
              console.log(`>>> [WEBHOOK] Telefone capturado: ${updateData.telefone}`);
            }

            await db.collection("usuarios").doc(userId).set(updateData, { merge: true });

            // Enviar mensagem de boas-vindas/ajuda se tiver telefone
            const userDoc = await db.collection("usuarios").doc(userId).get();
            const userData = userDoc.data();
            const phoneToSend = updateData.telefone || userData?.telefone;

            if (phoneToSend) {
              console.log(`>>> [WEBHOOK] Enviando boas-vindas para: ${phoneToSend}`);
              const welcomeMsg = `🚀 *Bem-vindo ao ProcVisual Premium!*\n\nSeu pagamento foi confirmado e sua conta já está ativa. Agora você pode registrar despesas direto por aqui!\n\n📖 *Guia de Uso*\n\nVocê pode registrar despesas enviando:\n\n1️⃣ *Texto:* "Almoço 35.00" ou "Internet 120 amanhã"\n2️⃣ *Áudio:* Fale o que comprou e o valor.\n3️⃣ *Foto:* Envie uma foto do cupom fiscal ou comprovante.\n\n*Dica:* Para parcelas, diga algo como "Geladeira 2000 em 10x".`;
              await sendWhatsApp(phoneToSend, welcomeMsg);
            }
          }
          break;
        }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const userQuery = await db.collection("usuarios").where("subscriptionId", "==", subscriptionId).limit(1).get();
          if (!userQuery.empty) {
            console.log(`>>> [WEBHOOK] Pagamento confirmado para sub: ${subscriptionId}`);
            await userQuery.docs[0].ref.update({ 
              isActive: true, 
              lastPayment: FieldValue.serverTimestamp() 
            });
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`>>> [WEBHOOK] Erro: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
