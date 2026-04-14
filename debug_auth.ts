import admin from "firebase-admin";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: config.projectId });
}

async function check() {
  try {
    const list = await admin.auth().listUsers();
    console.log(`Found ${list.users.length} users in Auth.`);
    list.users.forEach(u => {
      console.log(`UID: ${u.uid} | Email: ${u.email}`);
    });
  } catch (e: any) {
    console.log(`Auth failed: ${e.message}`);
  }
}
check();
