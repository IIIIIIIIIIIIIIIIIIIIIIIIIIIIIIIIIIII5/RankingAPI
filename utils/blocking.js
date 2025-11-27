const { getJsonBin, saveJsonBin } = require("../utils");

async function getBlockData() {
    const Db = await getJsonBin();
    Db.BlockedUsers = Db.BlockedUsers || [];
    Db.BlockedServers = Db.BlockedServers || [];
    return Db;
}

async function blockUser(userId) {
    const Db = await getBlockData();
    if (!Db.BlockedUsers.includes(userId)) Db.BlockedUsers.push(userId);
    await saveJsonBin(Db);
}

async function unblockUser(userId) {
    const Db = await getBlockData();
    Db.BlockedUsers = Db.BlockedUsers.filter(u => u !== userId);
    await saveJsonBin(Db);
}

async function blockServer(serverId) {
    const Db = await getBlockData();
    if (!Db.BlockedServers.includes(serverId)) Db.BlockedServers.push(serverId);
    await saveJsonBin(Db);
}

async function unblockServer(serverId) {
    const Db = await getBlockData();
    Db.BlockedServers = Db.BlockedServers.filter(s => s !== serverId);
    await saveJsonBin(Db);
}

module.exports = {
    getBlockData,
    blockUser,
    unblockUser,
    blockServer,
    unblockServer
};
