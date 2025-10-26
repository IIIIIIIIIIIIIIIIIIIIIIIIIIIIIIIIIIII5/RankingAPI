const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { exileUser, getUserIdFromUsername, getRankNameFromId } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exile")
        .setDescription("Exile a user from the Roblox group")
        .addStringOption(opt => 
            opt.setName("username")
                .setDescription("Roblox username to exile")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("reason")
                .setDescription("Reason for exile")
                .setRequired(false)
        ),

    async execute(interaction, logFunction = null) {
        const allowed = await checkCommandRole(interaction, "exile");
        if (!allowed)
            return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const Db = await getJsonBin();
        if (!Db.ServerConfig?.[interaction.guild.id])
            return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;
        const username = interaction.options.getString("username");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        try {
            const userId = await getUserIdFromUsername(username);
            await exileUser(GroupId, userId, reason, interaction.user.username, logFunction || (() => {}));

            const dateOnly = new Date().toISOString().split("T")[0];
            const Embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("User Exiled")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "Group", value: String(GroupId), inline: true },
                    { name: "Reason", value: reason, inline: true },
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
