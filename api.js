const express = require("express");
const { SetRank, GetCurrentRank, FetchRoles, GetRobloxUserId, ExileUser, LeaveGroup } = require("./roblox");
const { logRankChange, getJsonBin, saveJsonBin } = require("./utils");

const Router = express.Router();

async function Auth(req, res, next) {
    const { Auth } = req.body;
    if (!Auth) return res.status(403).json({ error: "Missing Auth key" });

    try {
        const Db = await getJsonBin();

        Db.ApiKeys = Db.ApiKeys || {};
        const AllKeys = Object.values(Db.ApiKeys).flat();

        if (!AllKeys.includes(Auth)) {
            return res.status(403).json({ error: "Invalid API Key" });
        }

        next();
    } catch (Err) {
        return res.status(500).json({ error: "Internal authentication error" });
    }
}

Router.post("/promote/:groupId", Auth, async (req, res) => {
    try {
        const GroupId = Number(req.params.groupId);
        const Username = req.body.Username;
        const UserId = await GetRobloxUserId(Username);
        const CurrentRank = await GetCurrentRank(GroupId, UserId);
        const Roles = await FetchRoles(GroupId);

        const SortedRanks = Roles.map(r => r.rank).sort((a, b) => a - b);
        const CurrentIndex = SortedRanks.indexOf(CurrentRank);
        if (CurrentIndex === SortedRanks.length - 1) return res.status(400).json({ error: "Already at highest rank" });

        const NewRank = SortedRanks[CurrentIndex + 1];
        await SetRank(GroupId, UserId, NewRank, "API", logRankChange);

        res.json({
            success: true,
            Username,
            OldRank: Roles.find(r => r.rank === CurrentRank).name,
            NewRank: Roles.find(r => r.rank === NewRank).name
        });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/demote/:groupId", Auth, async (req, res) => {
    try {
        const GroupId = Number(req.params.groupId);
        const Username = req.body.Username;
        const UserId = await GetRobloxUserId(Username);
        const CurrentRank = await GetCurrentRank(GroupId, UserId);
        const Roles = await FetchRoles(GroupId);

        const SortedRanks = Roles.map(r => r.rank).sort((a, b) => a - b);
        const CurrentIndex = SortedRanks.indexOf(CurrentRank);
        if (CurrentIndex === 0) return res.status(400).json({ error: "Already at lowest rank" });

        const NewRank = SortedRanks[CurrentIndex - 1];
        await SetRank(GroupId, UserId, NewRank, "API", logRankChange);

        res.json({
            success: true,
            Username,
            OldRank: Roles.find(r => r.rank === CurrentRank).name,
            NewRank: Roles.find(r => r.rank === NewRank).name
        });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/setrank/:groupId", Auth, async (req, res) => {
    try {
        const GroupId = Number(req.params.groupId);
        const Username = req.body.Username;
        const RankName = req.body.RankName.trim();
        const UserId = await GetRobloxUserId(Username);

        const Roles = await FetchRoles(GroupId);
        const RankEntry = Roles.find(r => r.name.toLowerCase() === RankName.toLowerCase());
        if (!RankEntry) return res.status(400).json({ error: "Rank not found" });

        await SetRank(GroupId, UserId, RankEntry.rank, "API", logRankChange);
        res.json({ success: true, Username, NewRank: RankEntry.name });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/exile/:groupId", Auth, async (req, res) => {
    try {
        const GroupId = Number(req.params.groupId);
        const Username = req.body.Username;
        const UserId = await GetRobloxUserId(Username);

        await ExileUser(GroupId, UserId);
        res.json({ success: true, Username, Message: "User exiled from group" });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/leave/:groupId", Auth, async (req, res) => {
    try {
        const GroupId = Number(req.params.groupId);
        await LeaveGroup(GroupId);
        res.json({ success: true, Message: `Left group ${GroupId}` });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/block", async (req, res) => {
    try {
        const { Type, Id } = req.body;
        if (!Type || !Id) return res.status(400).json({ error: "Missing Type or Id" });

        const Db = await getJsonBin();
        Db.BlockedUsers = Db.BlockedUsers || [];
        Db.BlockedServers = Db.BlockedServers || [];

        if (Type === "user" && !Db.BlockedUsers.includes(Id)) Db.BlockedUsers.push(Id);
        if (Type === "server" && !Db.BlockedServers.includes(Id)) Db.BlockedServers.push(Id);

        await saveJsonBin(Db);
        res.json({ success: true, Message: `${Type} ${Id} blocked successfully.` });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

Router.post("/unblock", async (req, res) => {
    try {
        const { Type, Id } = req.body;
        if (!Type || !Id) return res.status(400).json({ error: "Missing Type or Id" });

        const Db = await getJsonBin();
        Db.BlockedUsers = Db.BlockedUsers || [];
        Db.BlockedServers = Db.BlockedServers || [];

        if (Type === "user") Db.BlockedUsers = Db.BlockedUsers.filter(u => u !== Id);
        if (Type === "server") Db.BlockedServers = Db.BlockedServers.filter(s => s !== Id);

        await saveJsonBin(Db);
        res.json({ success: true, Message: `${Type} ${Id} unblocked successfully.` });
    } catch (Err) {
        res.status(500).json({ error: Err.message || "Unknown error" });
    }
});

module.exports = Router;
