const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("view")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("configuration")
               .setDescription("View your XP system configuration and permissions")
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub !== "configuration") return;

        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        const xpData = Db.XP?.[guildId];

        const embed = new EmbedBuilder()
            .setTitle("Configured XP System")
            .setColor("#2b2d31");

        if (!xpData || !xpData.Ranks || Object.keys(xpData.Ranks).length === 0) {
            embed.setDescription("XP system has not been configured for this server.");
        } else {
            let ranksText = '';
            const sortedRanks = Object.entries(xpData.Ranks).sort((a, b) => a[1] - b[1]);
            for (const [roleName, xpAmount] of sortedRanks) {
                ranksText += `**${roleName}** - (${xpAmount}) XP\n`;
            }
            embed.addFields({ name: "Configured Roles", value: ranksText, inline: false });

            let permittedRolesText = "No roles have XP management permissions.";
            if (xpData.PermissionRoles && xpData.PermissionRoles.length > 0) {
                permittedRolesText = xpData.PermissionRoles.map(rid => `<@&${rid}>`).join(", ");
            }
            embed.addFields({ name: "Roles with XP Management Access", value: permittedRolesText, inline: false });
        }

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};
