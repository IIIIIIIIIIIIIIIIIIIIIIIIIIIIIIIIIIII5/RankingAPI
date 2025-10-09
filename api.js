const express = require("express");
const { setRank, getCurrentRank, fetchRoles } = require("./roblox");
const { logRankChange } = require("./utils");

const router = express.Router();

function auth(req, res, next) {
    if (req.body.Auth !== process.env.API_KEY) return res.status(403).json({ error: "Unauthorized" });
    next();
}

router.post("/promote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const userId = String(req.body.UserId);
        const currentRank = await getCurrentRank(groupId, userId);
        const roles = await fetchRoles(groupId);
        const maxRank = Math.max(...Object.keys(roles).map(Number));
        if (currentRank >= maxRank) return res.status(400).json({ error: "Already at highest rank" });

        const newRank = currentRank + 1;
        await setRank(groupId, userId, newRank, "API", logRankChange);
        res.json({ success: true, userId, oldRank: currentRank, newRank });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/demote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const userId = String(req.body.UserId);
        const currentRank = await getCurrentRank(groupId, userId);
        const newRank = Math.max(currentRank - 1, 1);
        await setRank(groupId, userId, newRank, "API", logRankChange);
        res.json({ success: true, userId, oldRank: currentRank, newRank });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/setrank/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const userId = String(req.body.UserId);
        const rank = Number(req.body.RankNumber);
        if (isNaN(rank)) return res.status(400).json({ error: "RankNumber must be a number" });

        await setRank(groupId, userId, rank, "API", logRankChange);
        res.json({ success: true, userId, newRank: rank });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

module.exports = router;
