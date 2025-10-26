const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setRank, getRankNameFromId, getUserIdFromUsername } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setrank")
        .setDescription("Set a user's rank using their username and target rank name")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
        .addStringOption(opt => opt.setName("rankname").setDescription("Target rank name").setRequired(true)),

    async execute(interaction, logFunction = null) {
        const allowed = await checkCommandRole(interaction, "setrank");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const Db = await getJsonBin();
        if (!Db.ServerConfig?.[interaction.guild.id])
            return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;
        const username = interaction.options.getString("username");
        const rankName = interaction.options.getString("rankname");

        try {
            const userId = await getUserIdFromUsername(username);
            const rankId = await getRankNameFromId(GroupId, rankName);

            if (!rankId) return interaction.reply(`Rank "${rankName}" not found in the group.`);

            await setRank(GroupId, userId, rankId, interaction.user.username, logFunction || (() => {}));

            const dateOnly = new Date().toISOString().split("T")[0];
            const Embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("Rank Updated")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "Group", value: String(GroupId), inline: true },
                    { name: "New Rank", value: rankName, inline: true },
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
