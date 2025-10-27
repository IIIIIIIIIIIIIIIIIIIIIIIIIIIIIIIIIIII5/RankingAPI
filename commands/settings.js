const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Configure role permissions and logging channel for Roblox commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const settingsSelect = new StringSelectMenuBuilder()
            .setCustomId("settings_type")
            .setPlaceholder("Select a setting to configure")
            .addOptions([
                { label: "⚒️ Role Permissions", value: "role_permissions", description: "Manage command access roles" },
                { label: "📊 Logging Channel", value: "logging_channel", description: "Set channel to log ranking actions" }
            ]);

        const row = new ActionRowBuilder().addComponents(settingsSelect);
        await interaction.reply({ content: "Select a setting to configure:", components: [row], ephemeral: false });
    }
};
