import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function fix() {
  console.log("Fixing user email...");
  try {
    // We found the UID in the previous debug_client.ts output
    const uid = "24cC8kguY3X3IwSwfh6tTAKmJOK2"; 
    const userRef = doc(db, "usuarios", uid);
    await updateDoc(userRef, {
      email: "adrianodiasilva@yahoo.com.br"
    });
    console.log("Success! Email updated.");
  } catch (e: any) {
    console.log(`Failed: ${e.message}`);
  }
}
fix();
