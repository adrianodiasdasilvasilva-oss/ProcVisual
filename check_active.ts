import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

async function check() {
  const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  
  const q = query(collection(db, "usuarios"), where("isActive", "==", true));
  const snap = await getDocs(q);
  
  console.log("Total de usuários ativos:", snap.size);
  snap.forEach(doc => {
    console.log("- ", doc.data().email);
  });
}

check().catch(console.error);
