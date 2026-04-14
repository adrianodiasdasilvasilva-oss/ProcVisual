import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  console.log("Checking users via Client SDK...");
  try {
    const q = query(collection(db, "usuarios"));
    const snap = await getDocs(q);
    console.log(`Success! Found ${snap.size} users.`);
    snap.docs.forEach(d => {
      const data = d.data();
      console.log(`ID: ${d.id} | Email: ${data.email} | Tel: ${data.telefone} | Active: ${data.isActive}`);
    });
  } catch (e: any) {
    console.log(`Failed: ${e.message}`);
  }
}
check();
