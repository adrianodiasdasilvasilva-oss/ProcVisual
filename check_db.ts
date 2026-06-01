import { initializeFirebaseAdmin } from "./api/firebase-admin.js";
import fs from "fs";
import path from "path";

async function checkNotifications() {
  const db = await initializeFirebaseAdmin();
  
  console.log("--- USUÁRIOS ---");
  const userSnap = await db.collection("usuarios").get();
  if (userSnap.empty) {
    console.log("Nenhum usuário cadastrado.");
  } else {
    userSnap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}, Nome: ${data.nome}, Email: ${data.email}, Ativo: ${data.isActive}, Telefone: ${data.telefone}`);
    });
  }

  console.log("\n--- UNREGISTERED COOLDOWN ---");
  const cooldownSnap = await db.collection("unregistered_cooldown").get();
  if (cooldownSnap.empty) {
    console.log("Nenhum cooldown ativo.");
  } else {
    cooldownSnap.forEach(doc => {
      const data = doc.data();
      console.log(`ID/Numero: ${doc.id} | LastSent: ${data.lastSent} | OriginalNumero: ${data.numero}`);
    });
  }

  console.log("\n--- DEPENDÊNCIAS WHATSAPP ---");
  const pendaSnap = await db.collection("pendencias_whatsapp").get();
  if (pendaSnap.empty) {
    console.log("Nenhuma pendência ativa em pendencias_whatsapp.");
  } else {
    pendaSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Data:`, JSON.stringify(doc.data(), null, 2));
    });
  }

  console.log("\n--- USER PENDING WHATSAPP EXPENSE ---");
  const usersSnap = await db.collection("usuarios").get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.pendingWhatsAppExpense) {
      console.log(`User ID: ${doc.id} | pendingWhatsAppExpense:`, JSON.stringify(data.pendingWhatsAppExpense, null, 2));
    }
  });

  console.log("\n--- ÚLTIMOS LANÇAMENTOS ---");
  const lancSnap = await db.collection("lancamentos")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  if (lancSnap.empty) {
    console.log("Nenhum lançamento encontrado.");
  } else {
    lancSnap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id} | User: ${data.userId} | Desc: ${data.descricao} | Valor: ${data.valor} | Tipo: ${data.tipo} | Categoria: ${data.categoria} | Origem: ${data.origem} | Data: ${data.data}`);
    });
  }
}

checkNotifications().catch(console.error);
