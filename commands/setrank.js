const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchRoles, setRank, getUserIdFromUsername } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setrank")
        .setDescription("Set a user's rank using their username and target rank name")
        .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
        .addStringOption(opt => opt.setName("rankname").setDescription("Target rank name").setRequired(true)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "setrank");
        if (!allowed) return interaction.reply({ content: "You don't have permission.", flags: 64 });

        await interaction.deferReply();

        try {
            const username = interaction.options.getString("username").trim();
            const rankName = interaction.options.getString("rankname").trim();

            const userId = await getUserIdFromUsername(username);
            if (!userId) return interaction.editReply({ content: `User "${username}" not found.` });

            const Db = await getJsonBin();
            const GroupId = Db.ServerConfig[interaction.guild.id]?.GroupId;
            if (!GroupId) return interaction.editReply({ content: "No GroupId set for this server." });

            const roles = await fetchRoles(GroupId);

            const targetRole = roles.find(r => r.name.trim().toLowerCase() === rankName.toLowerCase());
            if (!targetRole) {
                return interaction.editReply({
                    content: `Rank "${rankName}" not found. Available roles: ${roles.map(r => r.name).join(", ")}`
                });
            }

            const botRank = await fetchRoles(GroupId);
            const botRole = botRank.find(r => r.id === targetRole.id);
            if (!botRole) return interaction.editReply({ content: `Cannot assign this rank. Bot may lack permission.` });

            await setRank(GroupId, userId, targetRole.id, interaction.user.username);

            Db.ServerConfig[interaction.guild.id].LastFetched = roles.map(r => r.name);
            await saveJsonBin(Db);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("Rank Updated")
                .addFields(
                    { name: "User", value: username, inline: true },
                    { name: "New Rank", value: targetRole.name, inline: true },
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
