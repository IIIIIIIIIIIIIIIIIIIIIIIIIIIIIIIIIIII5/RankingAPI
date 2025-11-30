const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { FetchRoles, SetRank, GetRobloxUserId } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("fire")
        .setDescription("Demote a user to the lowest group role.")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for firing").setRequired(false)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "fire");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const db = await getJsonBin();
        if (!db.ServerConfig?.[interaction.guild.id]) return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const groupId = db.ServerConfig[interaction.guild.id].GroupId;
        const username = interaction.options.getString("username");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        try {
            const userId = await getRobloxUserId(username);
            const roles = await fetchRoles(groupId);
            const lowestRankNumber = Math.min(...Object.keys(roles).map(Number));

            await setRank(groupId, userId, lowestRankNumber, interaction.user.username);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("User Fired")
                .addFields(
                    { name: "Username", value: username, inline: true },
                    { name: "Group ID", value: String(groupId), inline: true },
                    { name: "New Role", value: roles[lowestRankNumber].name, inline: true },
                    { name: "Reason", value: reason, inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `Failed to fire user: ${err.message || "Unknown error"}`, ephemeral: true });
        }
    }
};
