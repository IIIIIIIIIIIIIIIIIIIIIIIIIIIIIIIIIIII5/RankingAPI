const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const apiRoutes = require("./api");
const { getJsonBin, saveJsonBin } = require("./utils");
const { getRobloxDescription, leaveGroup } = require("./roblox");

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
            await command.execute(interaction, verifications, PendingApprovals);
        } catch (err) {
            console.error(err);
            if (!interaction.replied) await interaction.reply({ content: "An error occurred.", ephemeral: true });
        }

    } else if (interaction.isStringSelectMenu()) {
        const idParts = interaction.customId.split("_");
        const timestamp = parseInt(idParts[idParts.length - 1], 10);
        if (Date.now() - timestamp > 60_000)
            return interaction.reply({ content: "This selection has expired. Please run the settings command again.", ephemeral: true });

        const Db = await getJsonBin();
        Db.ServerConfig = Db.ServerConfig || {};
        Db.ServerConfig[interaction.guild.id] = Db.ServerConfig[interaction.guild.id] || {};

        if (interaction.customId.startsWith("settings_type")) {
            if (interaction.values[0] === "role_permissions") {
                const roleMenu = new StringSelectMenuBuilder()
                    .setCustomId(`set_role_${timestamp}`)
                    .setPlaceholder("Select a role for command access")
                    .addOptions(interaction.guild.roles.cache.map(r => ({ label: r.name, value: r.id })).slice(0, 25));
                const row = new ActionRowBuilder().addComponents(roleMenu);
                return interaction.reply({ content: "Select a role to allow command access:", components: [row], ephemeral: false });
            }
            if (interaction.values[0] === "logging_channel") {
                const channelMenu = new StringSelectMenuBuilder()
                    .setCustomId(`set_logging_${timestamp}`)
                    .setPlaceholder("Select a logging channel")
                    .addOptions(interaction.guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ label: c.name, value: c.id })).slice(0, 25));
                const row = new ActionRowBuilder().addComponents(channelMenu);
                return interaction.reply({ content: "Select a channel for logging:", components: [row], ephemeral: false });
            }
        }

        if (interaction.customId.startsWith("set_role")) {
            const selectedRoleId = interaction.values[0];
            Db.ServerConfig[interaction.guild.id].CommandRoles = {
                promote: selectedRoleId,
                demote: selectedRoleId,
                setrank: selectedRoleId,
                config: selectedRoleId
            };
            await saveJsonBin(Db);
            return interaction.update({ content: `All Roblox commands are now restricted to <@&${selectedRoleId}>.`, components: [] });
        }

        if (interaction.customId.startsWith("set_logging")) {
            const selectedChannelId = interaction.values[0];
            Db.ServerConfig[interaction.guild.id].LoggingChannel = selectedChannelId;
            await saveJsonBin(Db);
            return interaction.update({ content: `Logging channel is now set to <#${selectedChannelId}>.`, components: [] });
        }
    }

    if (interaction.isButton()) {
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
                await interaction.update({ content: `Configuration for group ID ${groupId} has been approved.`, components: [] });
            } else {
                if (requester) await requester.send(`Your group configuration for ID ${groupId} has been declined.`);
                const Db = await getJsonBin();
                if (Db.ServerConfig?.[pending.guildId]) delete Db.ServerConfig[pending.guildId];
                await saveJsonBin(Db);
                await interaction.update({ content: `Configuration for group ID ${groupId} has been declined.`, components: [] });
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
                await interaction.update({ content: `Group configuration for ID ${groupId} has been removed and the bot has left the group.`, components: [] });
            } else {
                if (requester) await requester.send(`Your group removal request has been declined and your linked group for the server ${pending.guildId} has not been removed.`);
                await interaction.update({ content: `Group removal request for ID ${groupId} has been declined.`, components: [] });
            }
        }
    }
});

const app = express();
app.use(bodyParser.json());
app.use("/api", apiRoutes);
app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`));

ClientBot.login(process.env.BOT_TOKEN);
