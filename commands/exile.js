const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { ExileUser, GetUserIdFromUsername } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exile")
        .setDescription("Exile a user from the Roblox group.")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for exile").setRequired(false)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "exile");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        try {
            const username = interaction.options.getString("username");
            const reason = interaction.options.getString("reason") || "No reason provided.";
            const userId = await GetUserIdFromUsername(username);

            const Db = await getJsonBin();
            const GroupId = Db.ServerConfig[interaction.guild.id]?.GroupId;
            if (!GroupId) return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

            await ExileUser(GroupId, userId);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("User Exiled")
                .addFields(
                    { name: "Username", value: username, inline: true },
                    { name: "Group ID", value: String(GroupId), inline: true },
                    { name: "Reason", value: reason, inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.reply({ embeds: [embed] });
            await logAction(interaction, embed);
        } catch (err) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed")
                .setDescription(err.message || "Unknown error")
                .addFields({ name: "Date", value: new Date().toISOString().split("T")[0], inline: true });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            await logAction(interaction, embed);
        }
    }
};
