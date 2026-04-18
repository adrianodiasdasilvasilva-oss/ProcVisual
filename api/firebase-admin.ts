import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let db: any = null;

export async function initializeFirebaseAdmin() {
  if (db) return db;
  
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf-8")) : {};
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId;

  try {
    if (admin.apps.length === 0) {
      const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (serviceAccountVar) {
        console.log(">>> [FIREBASE] Inicializando com Service Account da variável de ambiente.");
        const serviceAccount = JSON.parse(
          serviceAccountVar.startsWith("{") ? serviceAccountVar : Buffer.from(serviceAccountVar, 'base64').toString()
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId
        });
      } else {
        console.log(">>> [FIREBASE] Inicializando com credenciais padrão do ambiente.");
        admin.initializeApp({ projectId });
      }
    }
    
    db = dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
    console.log(`>>> [FIREBASE] Admin inicializado no banco: ${dbId || '(default)'}`);
    return db;
  } catch (e: any) {
    console.error(">>> [FIREBASE] Erro ao inicializar Admin:", e.message);
    throw e;
  }
}

export { admin, FieldValue };
