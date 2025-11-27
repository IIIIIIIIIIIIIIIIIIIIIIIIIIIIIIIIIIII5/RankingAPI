const { getJsonBin, saveJsonBin } = require("./utils");

async function getBlockData() {
    const db = await getJsonBin();
    db.BlockedUsers = db.BlockedUsers || [];
    db.BlockedServers = db.BlockedServers || [];
    return db;
}

async function blockUser(userId) {
    const db = await getBlockData();
    if (!db.BlockedUsers.includes(userId)) db.BlockedUsers.push(userId);
    await saveJsonBin(db);
}

async function unblockUser(userId) {
    const db = await getBlockData();
    db.BlockedUsers = db.BlockedUsers.filter(id => id !== userId);
    await saveJsonBin(db);
}

async function blockServer(serverId) {
    const db = await getBlockData();
    if (!db.BlockedServers.includes(serverId)) db.BlockedServers.push(serverId);
    await saveJsonBin(db);
}

async function unblockServer(serverId) {
    const db = await getBlockData();
    db.BlockedServers = db.BlockedServers.filter(id => id !== serverId);
    await saveJsonBin(db);
}

module.exports = {
    getBlockData,
    blockUser,
    unblockUser,
    blockServer,
    unblockServer
};
