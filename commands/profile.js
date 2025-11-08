const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getRobloxUserId, getRobloxDescription, fetchRoles, getCurrentRank } = require("../roblox");
const { GetJsonBin } = require("../utils");

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
            const Db = await GetJsonBin();

            const userId = await getRobloxUserId(username);
            const description = await getRobloxDescription(userId);

            const guildId = interaction.guild.id;
            const GroupId = Db.ServerConfig?.[guildId]?.GroupId;

            let rank = "N/A";
            if (GroupId) {
                try {
                    const userRank = await getCurrentRank(GroupId, userId);
                    rank = userRank;
                } catch {
                    rank = "Not in group";
                }
            }

            const userXP = Db.XP?.[guildId]?.[userId]?.amount || 0;
            const xpRanks = Db.XP?.[guildId]?.Ranks || {};
            let nextRankXP = "Max";
            const sortedXP = Object.entries(xpRanks).sort((a,b) => a[1] - b[1]);
            for (const [rName, xpVal] of sortedXP) {
                if (xpVal > userXP) {
                    nextRankXP = xpVal - userXP;
                    break;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`${username} Profile`)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .addFields(
                    { name: "Username", value: username, inline: true },
                    { name: "Rank", value: rank.toString(), inline: true },
                    { name: "XP", value: userXP.toString(), inline: true },
                    { name: "XP to Next Rank", value: nextRankXP.toString(), inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: `Failed to fetch profile: ${err.message}` });
        }
    }
};
