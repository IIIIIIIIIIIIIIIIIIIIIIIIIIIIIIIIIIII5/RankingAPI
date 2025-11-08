const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, ActivityType } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const apiRoutes = require("./api");
const { getJsonBin, saveJsonBin } = require("./utils");
const { getRobloxDescription, leaveGroup } = require("./roblox");

const ClientBot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

require("./commands")(ClientBot);

ClientBot.once("ready", () => {
    console.log("Bot is ready!");
    ClientBot.updateActivity();
    setInterval(() => ClientBot.updateActivity(), 60000);
});

ClientBot.on("guildCreate", async guild => {
    ClientBot.updateActivity();

    try {
        const owner = await guild.fetchOwner();

        if (!owner) return;

        const message = "**THANK YOU FOR ADDING RoSystem!**\n\nWe appreciate you adding RoSystem — a group management bot currently in Alpha, meaning we are actively adding new features and always open for feedback.\n\nTo get started, run /config with your group ID to set up the bot.\n\nFor support, join our Support Server:\nhttps://discord.gg/VhBqwBxHSd\n\n**Best Wishes,**\n**Team RoSystem**.";

        await owner.send(message).catch(() => {});
    } catch (err) {
        console.error("Failed to send message:", err);
    }
});
        
ClientBot.on("guildDelete", () => ClientBot.updateActivity());

ClientBot.updateActivity = function () {
    const count = this.guilds.cache.size;
    this.user.setActivity(`${count} servers`, { type: ActivityType.Watching });
};

const handleButton = require("./events/buttons");

ClientBot.on("interactionCreate", async interaction => {
    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.Verifications = Db.Verifications || {};

    if (interaction.isButton()) {
        await handleButton(interaction, ClientBot);
        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = ClientBot.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(err);
            if (!interaction.replied) await interaction.reply({ content: "An error occurred.", ephemeral: true });
        }
        return;
    }

    if (interaction.isStringSelectMenu()) {
        const idParts = interaction.customId.split("_");
        const timestamp = parseInt(idParts[idParts.length - 1], 10);
        if (Date.now() - timestamp > 60_000)
            return interaction.reply({ content: "This selection has expired. Please run the settings command again.", ephemeral: true });

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

    if (interaction.isButton() && interaction.customId.startsWith("done")) {
        const Data = Db.Verifications[interaction.user.id];
        if (!Data) return interaction.reply({ content: "You haven't started verification yet.", ephemeral: true });
        const Description = await getRobloxDescription(Data.RobloxUserId);
        if (Description.includes(Data.Code)) {
            Db.Verifications[interaction.user.id] = undefined;
            Db.VerifiedUsers = Db.VerifiedUsers || {};
            Db.VerifiedUsers[interaction.user.id] = Data.RobloxUserId;
            await saveJsonBin(Db);
            return interaction.reply({ content: `Verified! Linked to Roblox ID ${Data.RobloxUserId}`, ephemeral: true });
        } else return interaction.reply({ content: "Code not found in your profile. Make sure you added it and try again.", ephemeral: true });
    }
});

const app = express();
app.use(bodyParser.json());
app.use("/api", apiRoutes);
app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`));

ClientBot.login(process.env.BOT_TOKEN);
