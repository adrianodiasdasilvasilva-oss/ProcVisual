import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
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

let dbAdmin: admin.firestore.Firestore | null = null;
async function initializeFirebaseAdmin() {
  if (dbAdmin) return dbAdmin;
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) return null;
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }
  
  // Use named database if provided
  dbAdmin = dbId && dbId !== '(default)' ? admin.firestore(dbId) : admin.firestore();
  return dbAdmin;
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
        if (userId) {
          console.log(`>>> [WEBHOOK] Ativando premium para: ${userId}`);
          await db.collection("usuarios").doc(userId).set({
            isActive: true,
            plan: "premium",
            subscriptionId: subscriptionId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
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
              lastPayment: admin.firestore.FieldValue.serverTimestamp() 
            });
          }
        }
        break;
      }
      // ... other cases
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`>>> [WEBHOOK] Erro: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
