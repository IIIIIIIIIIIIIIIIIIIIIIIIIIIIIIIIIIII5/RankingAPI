const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("viewconfiguration")
        .setDescription("View your server's XP configuration")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        const xpData = Db.XP?.[guildId];
        const config = Db.ServerConfig?.[guildId];

        const embed = new EmbedBuilder()
            .setTitle("Server XP Configuration")
            .setColor("#2b2d31");

        if (xpData && xpData.Ranks && Object.keys(xpData.Ranks).length > 0) {
            const ranksList = Object.entries(xpData.Ranks)
                .map(([roleId, xp]) => `<@&${roleId}> - (${xp || 0}) XP`)
                .join("\n");

            embed.addFields({
                name: "Configured Roles",
                value: ranksList,
                inline: false
            });
        } else {
            embed.addFields({
                name: "Configured Roles",
                value: "No XP roles configured yet.",
                inline: false
            });
        }

        if (config && config.CommandRoles && config.CommandRoles.xp) {
            embed.addFields({
                name: "Roles with XP Management Permissions",
                value: `<@&${config.CommandRoles.xp}>`,
                inline: false
            });
        } else {
            embed.addFields({
                name: "Roles with XP Management Permissions",
                value: "No roles have permission to manage XP.",
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};
