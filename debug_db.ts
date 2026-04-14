import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: config.projectId });
}

async function check() {
  const dbIds = [config.firestoreDatabaseId, "(default)"];
  for (const id of dbIds) {
    console.log(`\n--- Checking database: ${id} ---`);
    try {
      const db = id === "(default)" ? getFirestore() : getFirestore(id);
      const snap = await db.collection("usuarios").get();
      console.log(`Success! Found ${snap.size} users.`);
      snap.docs.forEach(d => {
        const data = d.data();
        console.log(`ID: ${d.id} | Email: ${data.email} | Tel: ${data.telefone} | Active: ${data.isActive}`);
      });
    } catch (e: any) {
      console.log(`Failed for ${id}: ${e.message}`);
    }
  }
}
check();
