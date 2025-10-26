const express = require("express");
const { setRank, getCurrentRank, fetchRoles, getRobloxUserId } = require("./roblox");
const { logRankChange, getJsonBin } = require("./utils");
const axios = require("axios");

const router = express.Router();

async function auth(req, res, next) {
    try {
        const db = await getJsonBin();
        const serverId = req.body.ServerId;
        if (!serverId) return res.status(400).json({ error: "ServerId required" });

        const validKey = db.ApiKeys?.[serverId];
        if (!validKey || req.body.Auth !== validKey)
            return res.status(403).json({ error: "Unauthorized" });

        req.serverId = serverId;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to verify API key" });
    }
}

async function resolveUser(groupId, userInput) {
    let userId = String(userInput);
    let username = userId;

    if (isNaN(userId)) {
        userId = await getRobloxUserId(userInput);
        username = userInput;
    }

    const currentRankNum = await getCurrentRank(groupId, userId);
    const roles = await fetchRoles(groupId);
    const currentRankName = roles[currentRankNum].name;

    return { userId, username, currentRankNum, currentRankName, roles };
}

router.post("/promote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const { userId, username, currentRankNum, roles } = await resolveUser(groupId, req.body.User);

        const maxRankNum = Math.max(...Object.keys(roles).map(Number));
        if (currentRankNum >= maxRankNum)
            return res.status(400).json({ error: "Already at highest rank" });

        const newRankNum = currentRankNum + 1;
        await setRank(groupId, userId, newRankNum, "API", logRankChange);

        res.json({ success: true, username, oldRank: roles[currentRankNum].name, newRank: roles[newRankNum].name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/demote/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const { userId, username, currentRankNum, roles } = await resolveUser(groupId, req.body.User);

        const newRankNum = Math.max(currentRankNum - 1, Math.min(...Object.keys(roles).map(Number)));
        await setRank(groupId, userId, newRankNum, "API", logRankChange);

        res.json({ success: true, username, oldRank: roles[currentRankNum].name, newRank: roles[newRankNum].name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/setrank/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const { userId, username, roles } = await resolveUser(groupId, req.body.User);
        const rankName = req.body.RankName;
        const rankNum = Object.entries(roles).find(([num, r]) => r.name.toLowerCase() === rankName.toLowerCase())?.[0];

        if (!rankNum) return res.status(400).json({ error: "Invalid rank name" });

        await setRank(groupId, userId, Number(rankNum), "API", logRankChange);
        res.json({ success: true, username, newRank: roles[rankNum].name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

router.post("/exile/:groupId", auth, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const { userId, username } = await resolveUser(groupId, req.body.User);

        const xsrfToken = await (async () => {
            try {
                const res = await axios.post("https://auth.roblox.com/v2/logout", {}, {
                    headers: { Cookie: `.ROBLOSECURITY=${process.env.ROBLOSECURITY}` }
                });
                return res.headers["x-csrf-token"];
            } catch (err) {
                return err.response?.headers["x-csrf-token"] || "";
            }
        })();

        await axios.delete(`https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`, {
            headers: {
                Cookie: `.ROBLOSECURITY=${process.env.ROBLOSECURITY}`,
                "X-CSRF-TOKEN": xsrfToken
            }
        });

        res.json({ success: true, username, action: "exiled" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Unknown error" });
    }
});

module.exports = router;
