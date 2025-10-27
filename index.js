const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const apiRoutes = require("./api");
const { getRobloxDescription, leaveGroup } = require("./roblox");
const { getJsonBin, saveJsonBin, logRankChange } = require("./utils");

const ClientBot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const verifications = {};
const PendingApprovals = {};

require("./commands")(ClientBot);

ClientBot.once("ready", () => console.log("Bot is ready!"));

ClientBot.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = ClientBot.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, verifications, PendingApprovals, logRankChange);
        } catch (err) {
            console.error(err);
            if (!interaction.replied) await interaction.reply({ content: "An error occurred.", ephemeral: true });
        }
    } else if (interaction.isButton()) {
        const [action, type, groupIdRaw] = interaction.customId.split("_");
        const groupId = groupIdRaw || type;

        if (action === "done") {
            const Data = verifications[interaction.user.id];
            if (!Data) return interaction.reply({ content: "You haven't started verification yet.", ephemeral: true });
            const Description = await getRobloxDescription(Data.RobloxUserId);
            if (Description.includes(Data.Code)) {
                const Db = await getJsonBin();
                Db.VerifiedUsers = Db.VerifiedUsers || {};
                Db.VerifiedUsers[interaction.user.id] = Data.RobloxUserId;
                await saveJsonBin(Db);
                delete verifications[interaction.user.id];
                return interaction.reply({ content: `Verified! Linked to Roblox ID ${Data.RobloxUserId}`, ephemeral: true });
            } else return interaction.reply({ content: "Code not found in your profile. Make sure you added it and try again.", ephemeral: true });
        }

        if (action === "accept" || action === "decline") {
            const pending = PendingApprovals[groupId];
            if (!pending) return interaction.reply({ content: "No pending configuration found for this group ID.", ephemeral: true });
            const requester = await ClientBot.users.fetch(pending.requesterId).catch(() => null);
            delete PendingApprovals[groupId];
            if (action === "accept") {
                if (requester) await requester.send(`Your group configuration for ID ${groupId} has been approved.`);
                return interaction.reply({ content: `Configuration for group ID ${groupId} has been approved.`, ephemeral: true });
            } else {
                if (requester) await requester.send(`Your group configuration for ID ${groupId} has been declined.`);
                const Db = await getJsonBin();
                if (Db.ServerConfig?.[pending.guildId]) delete Db.ServerConfig[pending.guildId];
                await saveJsonBin(Db);
                return interaction.reply({ content: `Configuration for group ID ${groupId} has been declined.`, ephemeral: true });
            }
        }

        if (action === "remove" && (type === "accept" || type === "decline")) {
            const pending = PendingApprovals[groupId];
            if (!pending) return interaction.reply({ content: "No pending removal found for this group ID.", ephemeral: true });
            const requester = await ClientBot.users.fetch(pending.requesterId).catch(() => null);
            delete PendingApprovals[groupId];
            if (type === "accept") {
                const Db = await getJsonBin();
                if (Db.ServerConfig?.[pending.guildId]) delete Db.ServerConfig[pending.guildId];
                await saveJsonBin(Db);
                await leaveGroup(groupId);
                if (requester) await requester.send(`Your group removal request has been approved and your linked group for the server ${pending.guildId} has been removed. All server data has been cleared.`);
                return interaction.reply({ content: `Group configuration for ID ${groupId} has been removed and the bot has left the group.`, ephemeral: true });
            } else {
                if (requester) await requester.send(`Your group removal request has been declined and your linked group for the server ${pending.guildId} has not been removed.`);
                return interaction.reply({ content: `Group removal request for ID ${groupId} has been declined.`, ephemeral: true });
            }
        }
    }
});

const app = express();
app.use(bodyParser.json());
app.use("/api", apiRoutes);
app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`));

ClientBot.login(process.env.BOT_TOKEN);
