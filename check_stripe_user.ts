
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

async function checkSubscription() {
  const emails = [
    "adrianodiasilva@yahoo.com.br",
    "adrianodiasdasilva@yahoo.com.br",
    "adrianodiasdasilva.silva@gmail.com"
  ];
  
  for (const email of emails) {
    console.log(`\n>>> Consultando Stripe para: ${email}`);
    try {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        console.log(`Nenhum cliente encontrado para ${email}`);
        continue;
      }

      const customer = customers.data[0];
      console.log(`Cliente encontrado: ${customer.id}`);

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
      });

      if (subscriptions.data.length === 0) {
        console.log("Nenhuma assinatura encontrada para este cliente.");
      } else {
        subscriptions.data.forEach((sub, i) => {
          console.log(`Assinatura ${i + 1}:`);
          console.log(`ID: ${sub.id}`);
          console.log(`Status: ${sub.status}`);
          console.log(`Fim do Período: ${new Date(sub.current_period_end * 1000).toLocaleString()}`);
        });
      }
    } catch (error: any) {
      console.error(`Erro ao consultar ${email}:`, error.message);
    }
  }
}

checkSubscription();
