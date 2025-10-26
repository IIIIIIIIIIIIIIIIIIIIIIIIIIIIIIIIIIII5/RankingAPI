const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { exileUser, getRobloxUserId } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exile")
        .setDescription("Exile a user from the Roblox group.")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for exile").setRequired(false)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "exile");
        if (!allowed)
            return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const db = await getJsonBin();
        if (!db.ServerConfig?.[interaction.guild.id])
            return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const groupId = db.ServerConfig[interaction.guild.id].GroupId;
        const username = interaction.options.getString("username");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        try {
            const userId = await getRobloxUserId(username);
            await exileUser(groupId, userId);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("User Exiled")
                .addFields(
                    { name: "Username", value: username, inline: true },
                    { name: "Group ID", value: String(groupId), inline: true },
                    { name: "Reason", value: reason, inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({
                content: `Failed to exile user: ${err.message || "Unknown error"}`,
                ephemeral: true
            });
        }
    }
};
