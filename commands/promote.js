const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getCurrentRank, setRank, getRankInfo, getUserIdFromUsername } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Promote a user by Roblox username")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true)),

    async execute(interaction, logFunction) {
        const allowed = await checkCommandRole(interaction, "promote");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const Db = await getJsonBin();
        if (!Db.ServerConfig?.[interaction.guild.id])
            return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;
        const username = interaction.options.getString("username");

        try {
            const userId = await getUserIdFromUsername(username);
            const { rankId, rankName } = await getCurrentRank(GroupId, userId);
            const nextRank = await getRankInfo(GroupId, rankId + 1);

            if (!nextRank) return interaction.reply(`❌ ${username} is already at the highest rank.`);

            await setRank(GroupId, userId, nextRank.id, interaction.user.username, logFunction);

            const dateOnly = new Date().toISOString().split("T")[0];
            const Embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("Promoted")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "Group", value: String(GroupId), inline: true },
                    { name: "New Rank", value: nextRank.name, inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: dateOnly, inline: true }
                );

            await interaction.reply({ embeds: [Embed] });
        } catch (err) {
            const dateOnly = new Date().toISOString().split("T")[0];
            const ErrorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed")
                .setDescription(err.message || "Unknown error")
                .addFields({ name: "Date", value: dateOnly, inline: true });

            await interaction.reply({ embeds: [ErrorEmbed] });
        }
    }
};
