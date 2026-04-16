import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

async function run() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const db = getFirestore(app);
  
  console.log("--- USUÁRIOS ---");
  const users = await getDocs(collection(db, 'usuarios'));
  users.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | Email: ${data.email} | Tel: ${data.telefone} | Active: ${data.isActive}`);
  });
  
  console.log("\n--- ÚLTIMOS LANÇAMENTOS WHATSAPP ---");
  const lancamentos = await getDocs(collection(db, 'lancamentos'));
  const wa = lancamentos.docs.filter(d => d.data().origem?.startsWith('whatsapp')).slice(-5);
  wa.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | User: ${data.userId} | Desc: ${data.descricao} | Valor: ${data.valor}`);
  });
}

run();
