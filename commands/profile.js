const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getRobloxUserId, getRobloxDescription, fetchRoles, getCurrentRank } = require("../roblox");
const { getJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("View a user's Roblox profile and XP")
        .addStringOption(opt =>
            opt.setName("username")
               .setDescription("Roblox username")
               .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const username = interaction.options.getString("username");
            const Db = await getJsonBin();

            const userId = await getRobloxUserId(username);
            const description = await getRobloxDescription(userId);

            const guildId = interaction.guild.id;
            const GroupId = Db.ServerConfig?.[guildId]?.GroupId;

            let rank = "N/A";
            if (GroupId) {
                try {
                    const roles = await fetchRoles(GroupId);
                    const userRankNumber = await getCurrentRank(GroupId, userId);
                    const userRole = roles.find(r => r.rank === userRankNumber);
                    rank = userRole ? userRole.name : "Not in group";
                } catch {
                    rank = "Not in group";
                }
            }

            const xpSystemConfigured = Db.XP?.[guildId]?.Ranks && Object.keys(Db.XP[guildId].Ranks).length > 0;
            let userXP = 0;
            let nextRankXP = "XP System has not been configured";

            if (xpSystemConfigured) {
                userXP = Db.XP?.[guildId]?.[userId]?.amount || 0;
                const xpRanks = Db.XP[guildId].Ranks;
                const sortedXP = Object.entries(xpRanks).sort((a, b) => a[1] - b[1]);
                nextRankXP = "Max";
                for (const [rName, xpVal] of sortedXP) {
                    if (xpVal > userXP) {
                        nextRankXP = xpVal - userXP;
                        break;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`${username} Profile`)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .addFields(
                    { name: "Username", value: username, inline: true },
                    { name: "Rank", value: rank, inline: true },
                    { name: "XP", value: xpSystemConfigured ? userXP.toString() : "N/A", inline: true },
                    { name: "XP to Next Rank", value: nextRankXP.toString(), inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: `Failed to fetch profile: ${err.message}` });
        }
    }
};
