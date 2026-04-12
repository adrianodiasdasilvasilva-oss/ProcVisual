import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Initialize Firebase Admin
let dbAdmin: admin.firestore.Firestore | null = null;

async function initializeFirebaseAdmin() {
  if (dbAdmin) return dbAdmin;
  
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) return null;
  
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  
  dbAdmin = admin.firestore();
  return dbAdmin;
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return res.status(400).send("Webhook Error: Assinatura ou Secret ausente.");
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error(`>>> [STRIPE] Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`>>> [STRIPE] Evento recebido: ${event.type}`);

  try {
    const db = await initializeFirebaseAdmin();
    if (!db) throw new Error("Firebase Admin não inicializado.");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId) {
          console.log(`>>> [STRIPE] Ativando assinatura para o usuário: ${userId}`);
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
          const userQuery = await db.collection("usuarios")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            console.log(`>>> [STRIPE] Renovação confirmada para o usuário: ${userDoc.id}`);
            await userDoc.ref.update({
              isActive: true,
              lastPayment: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        if (subscriptionId) {
          const userQuery = await db.collection("usuarios")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            console.log(`>>> [STRIPE] Assinatura cancelada/removida para o usuário: ${userDoc.id}`);
            await userDoc.ref.update({
              isActive: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro ao processar evento:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
