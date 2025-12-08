const express = require("express");
const { SetRank, GetCurrentRank, FetchRoles, GetRobloxUserId, ExileUser, LeaveGroup } = require("./roblox");
const { logRankChange, getJsonBin, saveJsonBin } = require("./utils");

const Router = express.Router();

async function Auth(req, res, next) {
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
        console.error("Authentication failed:", err);
        return res.status(500).json({ error: "Internal authentication error" });
    }
}

Router.post("/promote/:groupId", Auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await GetRobloxUserId(username);
        const currentRank = await GetCurrentRank(groupId, userId);
        const roles = await FetchRoles(groupId);

        const sortedRanks = roles.map(r => r.rank).sort((a, b) => a - b);
        const currentIndex = sortedRanks.indexOf(currentRank);
        if (currentIndex === sortedRanks.length - 1) return res.status(400).json({ error: "Already at highest rank" });

        const newRank = sortedRanks[currentIndex + 1];
        await SetRank(groupId, userId, newRank, "API", logRankChange);

        res.json({ 
            success: true, 
            username, 
            oldRank: roles.find(r => r.rank === currentRank).name, 
            newRank: roles.find(r => r.rank === newRank).name 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/demote/:groupId", Auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await GetRobloxUserId(username);
        const currentRank = await GetCurrentRank(groupId, userId);
        const roles = await FetchRoles(groupId);

        const sortedRanks = roles.map(r => r.rank).sort((a, b) => a - b);
        const currentIndex = sortedRanks.indexOf(currentRank);
        if (currentIndex === 0) return res.status(400).json({ error: "Already at lowest rank" });

        const newRank = sortedRanks[currentIndex - 1];
        await SetRank(groupId, userId, newRank, "API", logRankChange);

        res.json({ 
            success: true, 
            username, 
            oldRank: roles.find(r => r.rank === currentRank).name, 
            newRank: roles.find(r => r.rank === newRank).name 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/setrank/:groupId", Auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const rankName = req.body.RankName;
        const userId = await GetRobloxUserId(username);

        const roles = await FetchRoles(groupId);
        const rankEntry = roles.find(r => r.name.toLowerCase() === rankName.toLowerCase());
        if (!rankEntry) return res.status(400).json({ error: "Rank not found" });

        await SetRank(groupId, userId, rankEntry.rank, "API", logRankChange);
        res.json({ success: true, username, newRank: rankName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/exile/:groupId", Auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const username = req.body.Username;
        const userId = await GetRobloxUserId(username);

        await ExileUser(groupId, userId);
        res.json({ success: true, username, message: "User exiled from group" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/leave/:groupId", Auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        await LeaveGroup(groupId);
        res.json({ success: true, message: `Left group ${groupId}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/block", Auth, async (req, res) => {
    try {
        const { Type, Id } = req.body;
        if (!Type || !Id) return res.status(400).json({ error: "Missing Type or Id" });

        const db = await getJsonBin();
        db.BlockedUsers = db.BlockedUsers || [];
        db.BlockedServers = db.BlockedServers || [];

        if (Type === "user" && !db.BlockedUsers.includes(Id)) db.BlockedUsers.push(Id);
        if (Type === "server" && !db.BlockedServers.includes(Id)) db.BlockedServers.push(Id);

        await saveJsonBin(db);
        res.json({ success: true, message: `${Type} ${Id} blocked successfully.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

Router.post("/unblock", Auth, async (req, res) => {
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
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

module.exports = Router;
