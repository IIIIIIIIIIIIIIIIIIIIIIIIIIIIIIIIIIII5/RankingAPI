const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Configure role permissions and logging channel for Roblox commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const Db = await getJsonBin();
        Db.ServerConfig = Db.ServerConfig || {};
        Db.ServerConfig[interaction.guild.id] = Db.ServerConfig[interaction.guild.id] || {};

        const settingsSelect = new StringSelectMenuBuilder()
            .setCustomId("settings_type")
            .setPlaceholder("Select a setting to configure")
            .addOptions([
                { label: "⚒️ Role Permissions", value: "role_permissions", description: "Manage command access roles" },
                { label: "📊 Logging Channel", value: "logging_channel", description: "Set channel to log ranking actions" }
            ]);

        const row = new ActionRowBuilder().addComponents(settingsSelect);
        await interaction.reply({ content: "Select a setting to configure:", components: [row], ephemeral: true });
    }
};

module.exports.handleSelect = async (interaction) => {
    await interaction.deferUpdate();
    
    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.ServerConfig[interaction.guild.id] = Db.ServerConfig[interaction.guild.id] || {};

    if (interaction.customId === "settings_type") {
        if (interaction.values[0] === "role_permissions") {
            const roleMenu = new StringSelectMenuBuilder()
                .setCustomId("set_role")
                .setPlaceholder("Select a role for command access")
                .addOptions(interaction.guild.roles.cache.map(r => ({ label: r.name, value: r.id })).slice(0, 25));

            const row = new ActionRowBuilder().addComponents(roleMenu);
            return interaction.update({ content: "Select a role to allow command access:", components: [row], ephemeral: true });

        } else if (interaction.values[0] === "logging_channel") {
            const channelMenu = new StringSelectMenuBuilder()
                .setCustomId("set_logging")
                .setPlaceholder("Select a logging channel")
                .addOptions(interaction.guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ label: c.name, value: c.id })).slice(0, 25));

            const row = new ActionRowBuilder().addComponents(channelMenu);
            return interaction.update({ content: "Select a channel for logging:", components: [row], ephemeral: true });
        }
    }

    if (interaction.customId === "set_role") {
        const selectedRoleId = interaction.values[0];
        Db.ServerConfig[interaction.guild.id].CommandRoles = {
            promote: selectedRoleId,
            demote: selectedRoleId,
            setrank: selectedRoleId,
            config: selectedRoleId
        };
        await saveJsonBin(Db);
        return interaction.update({ content: `All Roblox commands are now restricted to <@&${selectedRoleId}>.`, components: [], ephemeral: true });
    }

    if (interaction.customId === "set_logging") {
        const selectedChannelId = interaction.values[0];
        Db.ServerConfig[interaction.guild.id].LoggingChannel = selectedChannelId;
        await saveJsonBin(Db);
        return interaction.update({ content: `Logging channel is now set to <#${selectedChannelId}>.`, components: [], ephemeral: true });
    }
};
