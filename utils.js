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

const DbRef = admin.firestore().collection("rankChanges").doc("main");

let Cache = null;
let CacheTime = 0;
const CacheTTL = 5000;

async function retry(action, attempts = 3) {
  let count = 0;
  while (count < attempts) {
    try {
      return await action();
    } catch (error) {
      count++;
      if (count >= attempts) throw error;
      await new Promise(res => setTimeout(res, count * 200));
    }
  }
}

async function getJsonBin() {
  const now = Date.now();
  if (Cache && now - CacheTime < CacheTTL) return Cache;

  const data = await retry(async () => {
    const snap = await DbRef.get();
    return snap.exists ? snap.data() : {};
  });

  Cache = data || {};
  CacheTime = now;
  return Cache;
}

async function saveJsonBin(data) {
  Cache = data || {};
  CacheTime = Date.now();

  await retry(async () => {
    await DbRef.set(data, { merge: true });
  });
}

async function logRankChange(groupId, userId, roleInfo, issuer) {
  const data = await getJsonBin();
  data.RankChanges = data.RankChanges || [];

  const date = new Date().toISOString().split("T")[0];

  data.RankChanges.push({
    groupId,
    userId,
    newRank: roleInfo,
    issuedBy: issuer || "API",
    timestamp: date
  });

  await saveJsonBin(data);
}

module.exports = {
  getJsonBin,
  saveJsonBin,
  logRankChange
};
