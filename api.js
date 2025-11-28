const express = require("express");
const { setRank, getCurrentRank, fetchRoles, getRobloxUserId, exileUser, leaveGroup } = require("./roblox");
const { logRankChange, getJsonBin } = require("./utils");

const router = express.Router();

async function auth(req, res, next) {
    const { Auth } = req.body;
    if (!Auth) return res.status(403).json({ error: "Missing Auth key" });

    try {
        const db = await getJsonBin();
        db.ApiKeys = db.ApiKeys || {};
        const allKeys = Object.values(db.ApiKeys).flat();

        if (!allKeys.includes(Auth)) {
            return res.status(403).json({ error: "Invalid API Key" });
        }

        next();
    } catch (err) {
        return res.status(500).json({ error: "Internal authentication error" });
    }
}

router.post("/promote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await getRobloxUserId(username);
        const currentRank = await getCurrentRank(groupId, userId);
        const roles = await fetchRoles(groupId);

        const sortedRanks = Object.keys(roles).map(Number).sort((a, b) => a - b);
        const currentIndex = sortedRanks.indexOf(currentRank);
        if (currentIndex === sortedRanks.length - 1) return res.status(400).json({ error: "Already at highest rank" });

        const newRank = sortedRanks[currentIndex + 1];
        await setRank(groupId, userId, newRank, "API", logRankChange);

        res.json({ success: true, username, oldRank: roles[currentRank].name, newRank: roles[newRank].name });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/demote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await getRobloxUserId(username);
        const currentRank = await getCurrentRank(groupId, userId);
        const roles = await fetchRoles(groupId);

        const sortedRanks = Object.keys(roles).map(Number).sort((a, b) => a - b);
        const currentIndex = sortedRanks.indexOf(currentRank);
        if (currentIndex === 0) return res.status(400).json({ error: "Already at lowest rank" });

        const newRank = sortedRanks[currentIndex - 1];
        await setRank(groupId, userId, newRank, "API", logRankChange);

        res.json({ success: true, username, oldRank: roles[currentRank].name, newRank: roles[newRank].name });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/setrank/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const rankName = req.body.RankName;
        const userId = await getRobloxUserId(username);

        const roles = await fetchRoles(groupId);
        const rankEntry = Object.entries(roles).find(([_, info]) => info.name.toLowerCase() === rankName.toLowerCase());

        if (!rankEntry) return res.status(400).json({ error: "Rank not found" });

        const rankNumber = Number(rankEntry[0]);
        await setRank(groupId, userId, rankNumber, "API", logRankChange);

        res.json({ success: true, username, newRank: rankName });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/exile/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await getRobloxUserId(username);

        await exileUser(groupId, userId);

        res.json({ success: true, username, message: "User exiled from group" });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/leave/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        await leaveGroup(groupId);

        res.json({ success: true, message: `Left group ${groupId}` });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/block", auth, async (req, res) => {
    try {
        const { Type, Id } = req.body; // Type = "user" or "server", Id = userId or serverId
        if (!Type || !Id) return res.status(400).json({ error: "Missing Type or Id" });

        const db = await getJsonBin();
        db.BlockedUsers = db.BlockedUsers || [];
        db.BlockedServers = db.BlockedServers || [];

        if (Type === "user" && !db.BlockedUsers.includes(Id)) db.BlockedUsers.push(Id);
        if (Type === "server" && !db.BlockedServers.includes(Id)) db.BlockedServers.push(Id);

        await saveJsonBin(db);
        res.json({ success: true, message: `${Type} ${Id} blocked successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/unblock", auth, async (req, res) => {
    try {
        const { Type, Id } = req.body;
        if (!Type || !Id) return res.status(400).json({ error: "Missing Type or Id" });

        const db = await getJsonBin();
        db.BlockedUsers = db.BlockedUsers || [];
        db.BlockedServers = db.BlockedServers || [];

        if (Type === "user") db.BlockedUsers = db.BlockedUsers.filter(u => u !== Id);
        if (Type === "server") db.BlockedServers = db.BlockedServers.filter(s => s !== Id);

        await saveJsonBin(db);
        res.json({ success: true, message: `${Type} ${Id} unblocked successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

module.exports = router;
