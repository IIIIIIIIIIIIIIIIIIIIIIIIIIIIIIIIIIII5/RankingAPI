const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchRoles } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkrank")
        .setDescription("Check if the /setrank dropdown is up to date"),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "setrank");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        const groupId = Db.ServerConfig?.[guildId]?.GroupId;

        if (!groupId) return interaction.editReply("Group ID not set. Run `/config` first.");

        try {
            const liveRoles = await fetchRoles(groupId);
            const liveRoleNames = liveRoles.map(r => r.name);

            const cachedRoles = Db.ServerConfig[guildId]?.LastFetchedRanks || [];

            const added = liveRoleNames.filter(r => !cachedRoles.includes(r));
            const removed = cachedRoles.filter(r => !liveRoleNames.includes(r));

            const embed = new EmbedBuilder().setTitle("SetRank Dropdown Check").setColor(0x3498db);

            if (!added.length && !removed.length) {
                embed.setDescription("The rank dropdown is up to date.");
            } else {
                let desc = "";
                if (added.length) desc += `**New Roles Added:**\n${added.join(", ")}\n\n`;
                if (removed.length) desc += `**Roles Removed:**\n${removed.join(", ")}`;
                embed.setDescription(desc);
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            return interaction.editReply(`Failed to check ranks: ${err.message}`);
        }
    }
};
