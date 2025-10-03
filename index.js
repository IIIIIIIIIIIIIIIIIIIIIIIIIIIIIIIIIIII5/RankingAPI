const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const Axios = require("axios");
const Express = require("express");
const BodyParser = require("body-parser");

const ClientBot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const RobloxCookie = process.env.ROBLOSECURITY;
const JsonBinId = process.env.JSONBIN_ID;
const JsonBinSecret = process.env.JSONBIN_SECRET;
const AdminId = process.env.ADMIN_ID;
const AdminId2 = "804292216511791204";
const ApprovalChannel = "1423685663642877993";
const ApiKey = process.env.AUTHKEY;
const ApiPort = process.env.PORT || 3000;

const PendingApprovals = {};

async function FetchRoles(GroupId) {
    const Res = await Axios.get(`https://groups.roblox.com/v1/groups/${GroupId}/roles`);
    const Roles = {};
    Res.data.roles.forEach(Role => {
        Roles[Role.rank] = { Name: Role.name, RoleId: Role.id };
    });
    return Roles;
}

async function GetXsrfToken() {
    try {
        const Res = await Axios.post("https://auth.roblox.com/v2/logout", {}, { headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` } });
        return Res.headers["x-csrf-token"];
    } catch (Err) {
        return Err.response?.headers["x-csrf-token"] || "";
    }
}

async function GetRobloxUserId(Username) {
    const Res = await Axios.get(`https://users.roblox.com/v1/users/search?keyword=${Username}`);
    if (!Res.data.data || !Res.data.data[0]) throw new Error("Invalid username");
    return Res.data.data[0].id;
}

async function GetCurrentRank(GroupId, Username) {
    const UserId = await GetRobloxUserId(Username);
    const Res = await Axios.get(`https://groups.roblox.com/v2/users/${UserId}/groups/roles`);
    const GroupData = Res.data.data.find(G => G.group.id === GroupId);
    if (!GroupData) throw new Error("User not in group");
    return GroupData.role.rank;
}

async function SetRank(GroupId, Username, RankNumber, Issuer) {
    const UserId = await GetRobloxUserId(Username);
    const Roles = await FetchRoles(GroupId);
    const RoleInfo = Roles[RankNumber];
    if (!RoleInfo) throw new Error("Invalid rank number: " + RankNumber);

    const Url = `https://groups.roblox.com/v1/groups/${GroupId}/users/${UserId}`;
    let XsrfToken = await GetXsrfToken();

    try {
        await Axios.patch(Url, { roleId: RoleInfo.RoleId }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": XsrfToken
            }
        });
    } catch (Err) {
        if (Err.response?.status === 403 && Err.response?.headers["x-csrf-token"]) {
            XsrfToken = Err.response.headers["x-csrf-token"];
            await Axios.patch(Url, { roleId: RoleInfo.RoleId }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": XsrfToken
                }
            });
        } else {
            throw new Error("Request failed: " + (Err.response?.data?.errors?.[0]?.message || Err.message));
        }
    }

    await LogRankChange(GroupId, Username, RoleInfo.Name, Issuer);
}

async function LogRankChange(GroupId, Username, RoleName, Issuer) {
    const Data = await GetJsonBin();
    Data.RankChanges = Data.RankChanges || [];
    const DateOnly = new Date().toISOString().split("T")[0];
    Data.RankChanges.push({ GroupId, Username, NewRank: RoleName, IssuedBy: Issuer || "API", Timestamp: DateOnly });
    await SaveJsonBin(Data);
}

async function GetJsonBin() {
    try {
        const Res = await Axios.get(`https://api.jsonbin.io/v3/b/${JsonBinId}/latest`, { headers: { "X-Master-Key": JsonBinSecret } });
        return Res.data.record || {};
    } catch {
        return {};
    }
}

async function SaveJsonBin(Data) {
    await Axios.put(`https://api.jsonbin.io/v3/b/${JsonBinId}`, Data, { headers: { "X-Master-Key": JsonBinSecret, "Content-Type": "application/json" } });
}

ClientBot.on("messageCreate", async (Message) => {
    if (!Message.content.startsWith("!")) return;
    if (![AdminId, AdminId2].includes(Message.author.id)) return;

    const Args = Message.content.split(" ");
    const Cmd = Args[0].toLowerCase();
    const GroupId = Args[1];
    const Username = Args[2];
    
    let ApprovalChan;
    try {
        ApprovalChan = await ClientBot.channels.fetch(ApprovalChannel);
    } catch (err) {
        console.error("Failed to fetch approval channel:", err);
        return Message.reply("Cannot access approval channel. Check bot permissions.");
    }

    if (Cmd === "!accept" || Cmd === "!decline") {
        if (!GroupId || !PendingApprovals[GroupId]) return Message.reply("Invalid or unknown group ID.");
        const { requesterUsername } = PendingApprovals[GroupId];

        if (Cmd === "!accept") {
            await ApprovalChan.send(`Accepted group ${GroupId} and notified ${requesterUsername}`);
            delete PendingApprovals[GroupId];
        } else if (Cmd === "!decline") {
            await ApprovalChan.send(`Declined group ${GroupId} and notified ${requesterUsername}`);
            delete PendingApprovals[GroupId];
        }
    }

    if (Cmd === "!promote" || Cmd === "!demote" || Cmd === "!setrank") {
        if (!GroupId || !Username) return Message.reply("Usage: !promote <groupId> <username> | !demote <groupId> <username> | !setrank <groupId> <username> <rank>");

        try {
            const CurrentRank = await GetCurrentRank(Number(GroupId), Username);
            const Roles = await FetchRoles(Number(GroupId));

            if (Cmd === "!promote") {
                const NewRankNumber = CurrentRank + 1;
                if (!Roles[NewRankNumber]) return Message.reply("User is already at the highest rank");
                await SetRank(Number(GroupId), Username, NewRankNumber, Message.author.username);
                const Embed = new EmbedBuilder().setTitle("Promotion").setDescription(`${Username} promoted from ${Roles[CurrentRank].Name} to ${Roles[NewRankNumber].Name}`);
                Message.channel.send({ embeds: [Embed] });
            } else if (Cmd === "!demote") {
                const NewRankNumber = Math.max(CurrentRank - 1, 1);
                await SetRank(Number(GroupId), Username, NewRankNumber, Message.author.username);
                const Embed = new EmbedBuilder().setTitle("Demotion").setDescription(`${Username} demoted from ${Roles[CurrentRank].Name} to ${Roles[NewRankNumber].Name}`);
                Message.channel.send({ embeds: [Embed] });
            } else if (Cmd === "!setrank") {
                const RankNumber = Number(Args[3]);
                if (isNaN(RankNumber) || !Roles[RankNumber]) return Message.reply("Invalid rank number");
                await SetRank(Number(GroupId), Username, RankNumber, Message.author.username);
                const Embed = new EmbedBuilder().setTitle("Rank Set").setDescription(`${Username} set to rank ${Roles[RankNumber].Name}`);
                Message.channel.send({ embeds: [Embed] });
            }
        } catch (Err) {
            console.error("Error handling rank command:", Err);
            Message.reply("Error: " + Err.message);
        }
    }
});

const App = Express();
App.use(BodyParser.json());

function Auth(Req, Res, Next) {
    if (Req.body.Auth !== ApiKey) return Res.status(403).json({ error: "Unauthorized" });
    Next();
}

App.listen(ApiPort, () => { console.log(`Ranking API running on port ${ApiPort}`); });

ClientBot.on("error", (err) => console.error("Discord client error:", err));
ClientBot.on("shardError", (err) => console.error("Discord shard error:", err));

ClientBot.login(process.env.BOT_TOKEN);
