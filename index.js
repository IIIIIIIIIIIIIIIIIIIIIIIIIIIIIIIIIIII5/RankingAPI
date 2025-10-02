const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");

const ClientBot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const RobloxCookie = process.env.ROBLOSECURITY;
const JsonBinId = process.env.JSONBIN_ID;
const JsonBinSecret = process.env.JSONBIN_SECRET;
const ADMIN_ID = process.env.ADMIN_ID;
const API_KEY = process.env.AUTHKEY; 
const API_PORT = process.env.PORT || 3000;

const Verifications = {};
const PendingApprovals = {};

async function FetchRoles(GroupId) {
  const Res = await axios.get(`https://groups.roblox.com/v1/groups/${GroupId}/roles`);
  const Roles = {};
  Res.data.roles.forEach((Role, Index) => {
    Roles[Index + 1] = { Id: Role.name, RoleId: Role.id };
  });
  return Roles;
}

async function GetXsrfToken() {
  try {
    const res = await axios.post("https://auth.roblox.com/v2/logout", {}, { headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` } });
    return res.headers["x-csrf-token"];
  } catch (err) {
    return err.response?.headers["x-csrf-token"] || "";
  }
}

async function SetRank(GroupId, UserId, RankNumber, Issuer) {
  const Roles = await FetchRoles(GroupId);
  const RoleInfo = Roles[RankNumber];
  if (!RoleInfo) throw new Error("Invalid rank number: " + RankNumber);

  const Url = `https://groups.roblox.com/v1/groups/${GroupId}/users/${UserId}`;
  let XsrfToken = await GetXsrfToken();

  try {
    await axios.patch(Url, { roleId: RoleInfo.RoleId }, {
      headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}`, "Content-Type": "application/json", "X-CSRF-TOKEN": XsrfToken }
    });
  } catch (Err) {
    if (Err.response?.status === 403 && Err.response?.headers["x-csrf-token"]) {
      XsrfToken = Err.response.headers["x-csrf-token"];
      await axios.patch(Url, { roleId: RoleInfo.RoleId }, {
        headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}`, "Content-Type": "application/json", "X-CSRF-TOKEN": XsrfToken }
      });
    } else {
      throw new Error("Request failed: " + (Err.response?.data?.errors?.[0]?.message || Err.message));
    }
  }

  await LogRankChange(GroupId, UserId, RoleInfo, Issuer);
}

async function LogRankChange(GroupId, UserId, RoleInfo, Issuer) {
  const Data = await GetJsonBin();
  Data.RankChanges = Data.RankChanges || [];
  const dateOnly = new Date().toISOString().split("T")[0];
  Data.RankChanges.push({ GroupId, UserId, NewRank: RoleInfo, IssuedBy: Issuer || "API", Timestamp: dateOnly });
  await SaveJsonBin(Data);
}

async function GetJsonBin() {
  try {
    const Res = await axios.get(`https://api.jsonbin.io/v3/b/${JsonBinId}/latest`, { headers: { "X-Master-Key": JsonBinSecret } });
    return Res.data.record || {};
  } catch {
    return {};
  }
}

async function SaveJsonBin(Data) {
  await axios.put(`https://api.jsonbin.io/v3/b/${JsonBinId}`, Data, { headers: { "X-Master-Key": JsonBinSecret, "Content-Type": "application/json" } });
}

async function GetRobloxUserId(Username) {
  const Res = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${Username}`);
  if (!Res.data.data || !Res.data.data[0]) throw new Error("Invalid username");
  return Res.data.data[0].id;
}

async function GetRobloxDescription(UserId) {
  const Res = await axios.get(`https://users.roblox.com/v1/users/${UserId}`);
  return Res.data.description || "";
}

async function GetCurrentRank(GroupId, UserId) {
  const res = await axios.get(`https://groups.roblox.com/v2/users/${UserId}/groups/roles`);
  const GroupData = res.data.data.find(g => g.group.id === GroupId);
  if (!GroupData) throw new Error("User not in group");
  return GroupData.role.rank;
}

async function CheckAndIncrementUsage(userId) {
  const db = await GetJsonBin();
  db.Whitelist = db.Whitelist || [];
  if (db.Whitelist.includes(String(userId))) return { allowed: true };

  db.Usage = db.Usage || {};
  const currentMonth = new Date().toISOString().slice(0, 7);
  const userKey = String(userId);
  const userUsage = db.Usage[userKey] || { month: currentMonth, count: 0 };

  if (userUsage.month !== currentMonth) {
    userUsage.month = currentMonth;
    userUsage.count = 0;
  }

  if (userUsage.count >= 1000) {
    db.Usage[userKey] = userUsage;
    await SaveJsonBin(db);
    return { allowed: false };
  }

  userUsage.count++;
  db.Usage[userKey] = userUsage;
  await SaveJsonBin(db);
  return { allowed: true };
}

ClientBot.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;
  if (![ADMIN_ID].includes(message.author.id)) return;

  const args = message.content.split(" ");
  const cmd = args[0].toLowerCase();
  const GroupId = args[1];

  if (cmd === "!accept" || cmd === "!decline") {
    if (!GroupId || !PendingApprovals[GroupId]) return message.reply("Invalid or unknown group ID.");
    const { requesterId } = PendingApprovals[GroupId];

    if (cmd === "!accept") {
      await ClientBot.users.send(requesterId, `Your group config (ID: ${GroupId}) has been accepted. Please rank DavidRankBot in your Roblox group.`);
      delete PendingApprovals[GroupId];
      return message.channel.send(`Accepted group ${GroupId} and notified <@${requesterId}>`);
    } else if (cmd === "!decline") {
      await ClientBot.users.send(requesterId, `Your group config (ID: ${GroupId}) has been declined by the RoSystem Administration Team. Please contact dizrobloxfan1 for more information.`);
      delete PendingApprovals[GroupId];
      return message.channel.send(`Declined group ${GroupId} and notified <@${requesterId}>`);
    }
  }

  if (cmd === "!whitelist") {
    const action = args[1];
    let userId = args[2];
    if (message.mentions.users.size > 0) userId = message.mentions.users.first().id;

    if (!action) return message.reply("Usage: !whitelist add <discordId> | !whitelist remove <discordId> | !whitelist list");

    const db = await GetJsonBin();
    db.Whitelist = db.Whitelist || [];

    if (action === "add") {
      if (!userId) return message.reply("Provide a Discord user ID or mention.");
      if (!db.Whitelist.includes(userId)) {
        db.Whitelist.push(userId);
        await SaveJsonBin(db);
        return message.reply(`Added <@${userId}> to whitelist.`);
      } else {
        return message.reply("User is already whitelisted.");
      }
    }

    if (action === "remove") {
      if (!userId) return message.reply("Provide a Discord user ID or mention.");
      db.Whitelist = db.Whitelist.filter(id => id !== userId);
      await SaveJsonBin(db);
      return message.reply(`Removed <@${userId}> from whitelist.`);
    }

    if (action === "list") {
      if (db.Whitelist.length === 0) return message.reply("Whitelist is empty.");
      return message.reply("Whitelisted users:\n" + db.Whitelist.map(id => `<@${id}>`).join("\n"));
    }
  }
});

const app = express();
app.use(bodyParser.json());

function auth(req, res, next) {
  if (req.body.Auth !== API_KEY) return res.status(403).json({ error: "Unauthorized" });
  next();
}

app.post("/promote/:groupId", auth, async (req, res) => {
  const { groupId } = req.params;
  const { UserId } = req.body;

  if (!UserId) return res.status(400).json({ error: "Missing UserId" });

  try {
    const uid = String(UserId);
    const currentRank = await GetCurrentRank(Number(groupId), uid);
    const roles = await FetchRoles(Number(groupId));
    const maxRank = Math.max(...Object.keys(roles).map(Number));

    if (currentRank >= maxRank) {
      return res.status(400).json({ error: "User is already at the highest rank" });
    }

    const newRank = currentRank + 1;
    await SetRank(Number(groupId), uid, newRank, "API");

    return res.json({ success: true, userId: uid, oldRank: currentRank, newRank });
  } catch (err) {
    console.error("Promote error:", err.response?.data || err.message);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.post("/demote/:groupId", auth, async (req, res) => {
  const { groupId } = req.params;
  const { UserId } = req.body;
  if (!UserId) return res.status(400).json({ error: "Missing UserId" });

  try {
    const CurrentRank = await GetCurrentRank(Number(groupId), String(UserId));
    const NewRank = Math.max(CurrentRank - 1, 1);
    await SetRank(Number(groupId), String(UserId), NewRank, "API");
    res.json({ success: true, userId: UserId, oldRank: CurrentRank, newRank: NewRank });
  } catch (err) {
    console.error("Demote error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.post("/setrank/:groupId", auth, async (req, res) => {
  const { groupId } = req.params;
  const { UserId, RankNumber } = req.body;
  if (!UserId || !RankNumber) return res.status(400).json({ error: "Missing UserId or RankNumber" });

  try {
    await SetRank(Number(groupId), String(UserId), Number(RankNumber), "API");
    res.json({ success: true, userId: UserId, newRank: RankNumber });
  } catch (err) {
    console.error("SetRank error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.listen(API_PORT, () => {
  console.log(`Ranking API running on port ${API_PORT}`);
});

ClientBot.login(process.env.BOT_TOKEN);
