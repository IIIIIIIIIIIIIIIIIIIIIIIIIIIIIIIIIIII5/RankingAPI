const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { GetCurrentRank, FetchRoles, SetRank, GetUserIdFromUsername } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("demote")
        .setDescription("Demote a user by Roblox username")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "demote");
        if (!allowed) return interaction.reply({ content: "You don't have permission.", ephemeral: true });

        await interaction.deferReply();

        try {
            const username = interaction.options.getString("username").trim();
            const userId = await GetUserIdFromUsername(username);
            if (!userId) return interaction.editReply({ content: `User "${username}" not found.` });

            const Db = await getJsonBin();
            const GroupId = Db.ServerConfig[interaction.guild.id]?.GroupId;
            if (!GroupId) return interaction.editReply({ content: "No GroupId set for this server." });

            const currentRank = await GetCurrentRank(GroupId, userId);
            const roles = await FetchRoles(GroupId);
            const lowerRole = roles.filter(r => r.rank < currentRank).pop();
            if (!lowerRole) return interaction.editReply({ content: `${username} is already at the lowest rank.` });

            await SetRank(GroupId, userId, lowerRole.id, interaction.user.username);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Demoted")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "New Rank", value: lowerRole.name, inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
            await logAction(interaction, embed);

        } catch (err) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed")
                .setDescription(err.response?.data?.errors?.[0]?.message || err.message || "Unknown error")
                .addFields({ name: "Date", value: new Date().toISOString().split("T")[0], inline: true });

            if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embed] });
            else await interaction.reply({ embeds: [embed], ephemeral: true });

            await logAction(interaction, embed);
        }
    }
};
