const { getJsonBin, saveJsonBin } = require("./utils");

const MONTH = new Date().toISOString().slice(0, 7);

async function useServerLimit(guildId, maxLimit, amount = 1) {
    const db = await getJsonBin();
    db.ServerMonthlyLimit = db.ServerMonthlyLimit || {};

    let record = db.ServerMonthlyLimit[guildId];

    if (!record || record.month !== MONTH) {
        db.ServerMonthlyLimit[guildId] = {
            month: MONTH,
            used: 0
        };
        record = db.ServerMonthlyLimit[guildId];
    }

    if (record.used + amount > maxLimit) {
        return { allowed: false, used: record.used };
    }

    record.used += amount;
    await saveJsonBin(db);

    return { allowed: true, used: record.used };
}

module.exports = { useServerLimit };
