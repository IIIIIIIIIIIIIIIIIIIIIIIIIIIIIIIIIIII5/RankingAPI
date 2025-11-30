const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { GetUserIdFromUsername } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("group")
        .setDescription("Manage group bans")
        .addSubcommand(sub =>
            sub.setName("ban")
                .setDescription("Ban a user from the Roblox group")
                .addStringOption(opt =>
                    opt.setName("username")
                        .setDescription("Roblox username")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("unban")
                .setDescription("Unban a user from the Roblox group")
                .addStringOption(opt =>
                    opt.setName("username")
                        .setDescription("Roblox username")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const allowed = await checkCommandRole(interaction, "groupban");
        if (!allowed) return interaction.reply({ content: "You don't have permission.", flags: 64 });
        await interaction.deferReply();
        const username = interaction.options.getString("username").trim();
        const userId = await getUserIdFromUsername(username);
        if (!userId) return interaction.editReply({ content: `User "${username}" not found.` });
        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        if (!Db.GroupBans) Db.GroupBans = {};
        if (!Db.GroupBans[guildId]) Db.GroupBans[guildId] = [];

        try {
            if (sub === "ban") {
                if (Db.GroupBans[guildId].includes(userId))
                    return interaction.editReply({ content: `${username} is already group-banned.` });
                Db.GroupBans[guildId].push(userId);
                await saveJsonBin(Db);
                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("User Group-Banned")
                    .addFields(
                        { name: "User", value: username, inline: true },
                        { name: "UserId", value: `${userId}`, inline: true },
                        { name: "Issued By", value: interaction.user.tag, inline: true },
                        { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                    );
                await interaction.editReply({ embeds: [embed] });
                return logAction(interaction, embed);
            }

            if (sub === "unban") {
                if (!Db.GroupBans[guildId].includes(userId))
                    return interaction.editReply({ content: `${username} is not group-banned.` });
                Db.GroupBans[guildId] = Db.GroupBans[guildId].filter(id => id !== userId);
                await saveJsonBin(Db);
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("User Group-Unbanned")
                    .addFields(
                        { name: "User", value: username, inline: true },
                        { name: "UserId", value: `${userId}`, inline: true },
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
