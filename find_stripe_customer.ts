import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: '2023-10-16' as any,
});

async function findCustomer() {
  console.log("Listing recent customers...");
  
  const customers = await stripe.customers.list({
    limit: 20,
    expand: ['data.subscriptions']
  });

  customers.data.forEach(customer => {
    console.log("Customer:", customer.id, "| Email:", customer.email, "| Subs:", customer.subscriptions?.data.length);
    if (customer.subscriptions?.data.length && customer.subscriptions.data.length > 0) {
        console.log("   -> Active Sub Found!");
    }
  });
}

findCustomer();
