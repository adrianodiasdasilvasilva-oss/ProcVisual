import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function checkUser() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId;

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: projectId,
    });
  }

  const db = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
  
  const email = "adrianodiasilva@yahoo.com.br";
  console.log(`>>> [CHECK] Buscando usuário: ${email} no projeto ${projectId} (DB: ${dbId})`);

  try {
    const snapshot = await db.collection("usuarios").get();
    console.log(`>>> [CHECK] Total de usuários encontrados: ${snapshot.size}`);

    const user = snapshot.docs.find(doc => doc.data().email === email);

    if (!user) {
      console.log(">>> [CHECK] Usuário não encontrado na lista total.");
      // List first 5 users for debugging
      snapshot.docs.slice(0, 5).forEach(doc => {
        console.log(`- ${doc.data().email} | ${doc.data().telefone}`);
      });
      return;
    }

    console.log(`>>> [CHECK] ID: ${user.id}`);
    console.log(`>>> [CHECK] Dados:`, JSON.stringify(user.data(), null, 2));
  } catch (e: any) {
    console.error(">>> [CHECK] Erro:", e.message);
  }
}

checkUser().catch(console.error);
