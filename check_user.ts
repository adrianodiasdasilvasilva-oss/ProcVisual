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
      projectId: projectId
    });
  }

  const db = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
  
  const email = "adrianodiasilva@yahoo.com.br";
  console.log(`>>> [CHECK] Listando usuários no projeto ${projectId} (DB: ${dbId})`);

  try {
    const snapshot = await db.collection("usuarios").get();
    console.log(`>>> [CHECK] Total de usuários: ${snapshot.size}`);

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email === email) {
        console.log(`>>> [MATCH] ID: ${doc.id}`);
        console.log(`>>> [MATCH] Ativo: ${data.isActive}`);
        console.log(`>>> [MATCH] Telefone: ${data.telefone}`);
      } else {
        console.log(`- ${data.email} | ${data.telefone}`);
      }
    });
  } catch (e: any) {
    console.error(">>> [CHECK] Erro:", e.message);
  }
}

checkUser().catch(console.error);
