const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("view")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("settings")
               .setDescription("View your current Roblox command settings")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub !== "settings") return;

        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        const config = Db.ServerConfig?.[guildId];

        const embed = new EmbedBuilder()
            .setTitle("Server Settings")
            .setColor("#2b2d31");

        if (!config) {
            embed.setDescription("No settings found. Use `/settings` to set them up.");
            return interaction.reply({ embeds: [embed], ephemeral: false });
        }

        if (config.CommandRoles && config.CommandRoles.promote) {
            embed.addFields({
                name: "⚒️ Role Permissions",
                value: `<@&${config.CommandRoles.promote}>`,
                inline: true
            });
        } else {
            embed.addFields({
                name: "⚒️ Role Permissions",
                value: "You have not set up Role Permissions. Use `/settings` to set it up.",
                inline: true
            });
        }

        if (config.LoggingChannel) {
            embed.addFields({
                name: "📊 Logging Channel",
                value: `<#${config.LoggingChannel}>`,
                inline: false
            });
        } else {
            embed.addFields({
                name: "📊 Logging Channel",
                value: "You have not set up a Logging Channel. Use `/settings` to set it up.",
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};
