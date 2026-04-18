import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let db: any = null;

export async function initializeFirebaseAdmin() {
  if (db) return db;
  
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("firebase-applet-config.json not found");
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId;

    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
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
