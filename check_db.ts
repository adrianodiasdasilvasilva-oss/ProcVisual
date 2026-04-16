import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function checkNotifications() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  const db = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
  
  const email = "adrianodiasdasilva.silva@gmail.com";
  const userSnap = await db.collection("usuarios").where("email", "==", email).get();
  
  if (userSnap.empty) {
    console.log("Usuário não encontrado.");
    return;
  }

  const userDoc = userSnap.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();
  console.log(`Usuário: ${userId}, Ativo: ${userData.isActive}, Telefone: ${userData.telefone}`);

  const now = new Date();
  const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  const todayStr = brazilTime.toISOString().split('T')[0];
  console.log(`Data hoje (Brasil): ${todayStr}`);

  const lancamentosSnap = await db.collection("lancamentos")
    .where("userId", "==", userId)
    .get();

  console.log(`Total de lançamentos: ${lancamentosSnap.size}`);

  lancamentosSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.descricao}: Data: ${data.data}, Pago: ${data.pago}, NotificadoHoje: ${data.notificadoNoDia}, Tipo: ${data.tipo}`);
  });
}

checkNotifications().catch(console.error);
