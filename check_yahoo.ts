import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

async function check() {
  const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  
  const q = query(collection(db, "usuarios"), where("email", "==", "adrianodiasdasilva@yahoo.com.br"));
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    console.log("Dados:", JSON.stringify(doc.data(), null, 2));
  });
}

check().catch(console.error);
