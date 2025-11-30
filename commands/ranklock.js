const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchRoles, getUserIdFromUsername, setRank } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Lock or unlock a user's rank")
        .addSubcommand(sub =>
            sub.setName("lock")
                .setDescription("Lock a user's rank")
                .addStringOption(opt =>
                    opt.setName("username")
                        .setDescription("Roblox username")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("rankname")
                        .setDescription("Target rank name")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("unlock")
                .setDescription("Unlock a user's rank")
                .addStringOption(opt =>
                    opt.setName("username")
                        .setDescription("Roblox username")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const allowed = await checkCommandRole(interaction, "ranklock");
        if (!allowed) return interaction.reply({ content: "You don't have permission.", flags: 64 });
        await interaction.deferReply();

        const username = interaction.options.getString("username").trim();
        const userId = await getUserIdFromUsername(username);
        if (!userId) return interaction.editReply({ content: `User "${username}" not found.` });

        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        if (!Db.RankLocks) Db.RankLocks = {};
        if (!Db.RankLocks[guildId]) Db.RankLocks[guildId] = [];

        try {
            if (sub === "lock") {
                const rankName = interaction.options.getString("rankname").trim();
                const GroupId = Db.ServerConfig[guildId]?.GroupId;
                if (!GroupId) return interaction.editReply({ content: "No GroupId set for this server." });

                const roles = await fetchRoles(GroupId);
                const targetRole = roles.find(r => r.name.toLowerCase() === rankName.toLowerCase());
                if (!targetRole) return interaction.editReply({ content: `Rank "${rankName}" not found.` });

                Db.RankLocks[guildId][userId] = targetRole.id;
                await saveJsonBin(Db);

                await setRank(GroupId, userId, targetRole.id, interaction.user.username);

                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("Rank Locked")
                    .addFields(
                        { name: "User", value: username, inline: true },
                        { name: "Rank", value: targetRole.name, inline: true },
                        { name: "Issued By", value: interaction.user.tag, inline: true },
                        { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
                return logAction(interaction, embed);
            }

            if (sub === "unlock") {
                if (!Db.RankLocks[guildId][userId])
                    return interaction.editReply({ content: `${username} does not have a rank lock.` });

                delete Db.RankLocks[guildId][userId];
                await saveJsonBin(Db);

                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("Rank Unlocked")
                    .addFields(
                        { name: "User", value: username, inline: true },
                        { name: "Issued By", value: interaction.user.tag, inline: true },
                        { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
                return logAction(interaction, embed);
            }

        } catch (err) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed")
                .setDescription(err?.response?.data?.errors?.[0]?.message || err.message || "Unknown error");
            await interaction.editReply({ embeds: [embed] });
            return logAction(interaction, embed);
        }
    }
};
