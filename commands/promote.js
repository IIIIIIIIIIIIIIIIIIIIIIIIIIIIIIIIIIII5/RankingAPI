const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getCurrentRank, getNextRank, setRank, getUserIdFromUsername, fetchRoles } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Promote a user by Roblox username")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "promote");
        if (!allowed) return interaction.reply({ content: "You don't have permission.", flags: 64 });

        try {
            await interaction.deferReply();

            const username = interaction.options.getString("username");
            const userId = await getUserIdFromUsername(username);
            if (!userId) return interaction.editReply({ content: `User "${username}" not found.` });

            const Db = await getJsonBin();
            const GroupId = Db.ServerConfig[interaction.guild.id]?.GroupId;
            if (!GroupId) return interaction.editReply({ content: "No GroupId set for this server." });

            const currentRank = await getCurrentRank(GroupId, userId);
            const nextRank = await getNextRank(GroupId, currentRank);

            if (!nextRank || typeof nextRank.id !== "number") {
                const roles = await fetchRoles(GroupId);
                const higherRoles = roles.filter(r => r.rank > currentRank);
                if (!higherRoles.length) return interaction.editReply({ content: `${username} is already at the highest rank.` });
                nextRank = higherRoles[0];
            }

            await setRank(GroupId, userId, nextRank.id, interaction.user.username);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("Promoted")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "New Rank", value: nextRank.name, inline: true },
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
            else await interaction.reply({ embeds: [embed] });

            await logAction(interaction, embed);
        }
    }
};
