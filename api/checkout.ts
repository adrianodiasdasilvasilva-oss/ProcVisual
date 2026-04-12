import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, email, priceId } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: "UserId e Email são obrigatórios." });
  }

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !key.startsWith('sk_')) {
      return res.status(400).json({ 
        error: "Chave Secreta do Stripe inválida. A chave deve começar com 'sk_test_' ou 'sk_live_'. Por favor, verifique nos Segredos (Settings > Secrets)." 
      });
    }

    console.log(`>>> [STRIPE] Criando sessão de checkout para: ${email} (${userId})`);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId || process.env.VITE_STRIPE_PRICE_ID || "SEU_PRICE_ID",
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      metadata: {
        userId: userId,
      },
      success_url: `${req.headers.origin}/?payment=success`,
      cancel_url: `${req.headers.origin}/?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error(">>> [STRIPE] Erro ao criar sessão:", error.message);
    
    if (error.message.includes('Invalid API Key')) {
      return res.status(401).json({ 
        error: "Chave Secreta do Stripe inválida. Verifique se você copiou a 'Secret Key' corretamente (sk_...) no menu Settings > Secrets." 
      });
    }

    return res.status(500).json({ error: error.message });
  }
}
