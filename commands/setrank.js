const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setRank } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../utils/roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setrank")
        .setDescription("Set a user's rank")
        .addIntegerOption(opt => opt.setName("userid").setDescription("Roblox user ID").setRequired(true))
        .addIntegerOption(opt => opt.setName("rank").setDescription("Rank number").setRequired(true)),

    async execute(interaction, logFunction) {
        const allowed = await checkCommandRole(interaction, "setrank");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const Db = await getJsonBin();
        if (!Db.ServerConfig?.[interaction.guild.id]) return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;
        const UserId = interaction.options.getInteger("userid");
        const NewRank = interaction.options.getInteger("rank");

        try {
            await setRank(GroupId, UserId, NewRank, interaction.user.username, logFunction);

            const dateOnly = new Date().toISOString().split("T")[0];
            const Embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("Rank Updated")
                .addFields(
                    { name: "User ID", value: String(UserId), inline: true },
                    { name: "Group ID", value: String(GroupId), inline: true },
                    { name: "New Rank", value: String(NewRank), inline: true },
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

            await interaction.reply({ embeds: [ErrorEmbed], ephemeral: true });
        }
    }
};
