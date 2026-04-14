import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`>>> [STRIPE-CHECKOUT] Request: ${req.method}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, email, priceId } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: "UserId e Email são obrigatórios." });
  }

  try {
    const key = (process.env.STRIPE_SECRET_KEY || "").trim();
    if (!key || !key.startsWith('sk_')) {
      throw new Error("Chave Secreta do Stripe inválida ou não configurada.");
    }

    const stripe = new Stripe(key, {
      apiVersion: '2023-10-16' as any,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId || process.env.VITE_STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      phone_number_collection: {
        enabled: true,
      },
      metadata: { userId },
      success_url: `${req.headers.origin}/?payment=success`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error(">>> [STRIPE-CHECKOUT] Erro:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
