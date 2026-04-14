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
      projectId,
      credential: admin.credential.applicationDefault()
    });
  }

  const db = getFirestore(dbId);
  
  // Get the user by email (from the context)
  const email1 = "adrianodiasdasilva.silva@gmail.com";
  const email2 = "adrianodiasilva@yahoo.com.br";
  
  console.log("Searching for:", email1);
  const snap1 = await db.collection("usuarios").where("email", "==", email1).get();
  snap1.forEach(doc => console.log("Found (Gmail):", doc.id, doc.data()));

  console.log("Searching for:", email2);
  const snap2 = await db.collection("usuarios").where("email", "==", email2).get();
  snap2.forEach(doc => console.log("Found (Yahoo):", doc.id, doc.data()));
}

checkUser();
