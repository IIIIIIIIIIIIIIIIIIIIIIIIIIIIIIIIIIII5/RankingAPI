const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getCurrentRank, setRank } = require("../roblox");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Promote a user")
        .addIntegerOption(opt => opt.setName("userid").setDescription("Roblox user ID").setRequired(true)),
    async execute(interaction, logFunction) {
        const Db = await getJsonBin();
        if (!Db.ServerConfig || !Db.ServerConfig[interaction.guild.id]) return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;
        const UserId = interaction.options.getInteger("userid");

        try {
            const CurrentRank = await getCurrentRank(GroupId, UserId);
            const NewRank = CurrentRank + 1;
            await setRank(GroupId, UserId, NewRank, interaction.user.username, logFunction);

            const dateOnly = new Date().toISOString().split("T")[0];
            const Embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("Promoted").addFields(
                { name: "User ID", value: String(UserId), inline: true },
                { name: "Group ID", value: String(GroupId), inline: true },
                { name: "New Rank", value: String(NewRank), inline: true },
                { name: "Issued By", value: interaction.user.tag, inline: true },
                { name: "Date", value: dateOnly, inline: true }
            );
            await interaction.reply({ embeds: [Embed] });
        } catch (err) {
            const dateOnly = new Date().toISOString().split("T")[0];
            const ErrorEmbed = new EmbedBuilder().setColor(0xe74c3c).setTitle("Failed").setDescription(err.message || "Unknown error").addFields({ name: "Date", value: dateOnly, inline: true });
            await interaction.reply({ embeds: [ErrorEmbed], ephemeral: true });
        }
    }
};
