const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

async function getJsonBin() {
  try {
    const doc = await db.collection("rankChanges").doc("main").get();
    return doc.exists ? doc.data() : {};
  } catch {
    return {};
  }
}

async function saveJsonBin(data) {
  try {
    await db.collection("rankChanges").doc("main").set(data, { merge: true });
  } catch (err) {
    console.error("Failed to save Firestore data:", err.message);
  }
}

async function logRankChange(groupId, userId, roleInfo, issuer) {
  const data = await getJsonBin();
  data.RankChanges = data.RankChanges || [];
  const dateOnly = new Date().toISOString().split("T")[0];
  data.RankChanges.push({ groupId, userId, newRank: roleInfo, issuedBy: issuer || "API", timestamp: dateOnly });
  await saveJsonBin(data);
}

module.exports = {
  getJsonBin,
  saveJsonBin,
  logRankChange
};
