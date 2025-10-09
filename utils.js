const axios = require("axios");

const JsonBinId = process.env.JSONBIN_ID;
const JsonBinSecret = process.env.JSONBIN_SECRET;

async function getJsonBin() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${JsonBinId}/latest`, {
            headers: { "X-Master-Key": JsonBinSecret }
        });
        return res.data.record || {};
    } catch {
        return {};
    }
}

async function saveJsonBin(data) {
    await axios.put(`https://api.jsonbin.io/v3/b/${JsonBinId}`, data, {
        headers: { "X-Master-Key": JsonBinSecret, "Content-Type": "application/json" }
    });
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
