const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { GetUserIdFromUsername, ExileUser } = require("../roblox");
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
        if (!allowed)
            return interaction.reply({ content: "You don't have permission.", flags: 64 });

        await interaction.deferReply();

        const username = interaction.options.getString("username").trim();
        const userId = await GetUserIdFromUsername(username);

        if (!userId)
            return interaction.editReply({ content: `User "${username}" not found.` });

        const serverId = interaction.guild.id;

        let Db = await getJsonBin();

        Db.GroupBans = Db.GroupBans || {};
        Db.ServerConfig = Db.ServerConfig || {};
        Db.ServerConfig[serverId] = Db.ServerConfig[serverId] || {};

        const groupId = Db.ServerConfig[serverId].GroupId;
        if (!groupId)
            return interaction.editReply({ content: `No GroupId set for this server.` });

        if (!Array.isArray(Db.GroupBans[serverId])) {
            Db.GroupBans[serverId] = [];
        }

        const list = Db.GroupBans[serverId];

        try {

            if (sub === "ban") {
                if (list.includes(userId))
                    return interaction.editReply(`${username} is already group-banned.`);

                list.push(userId);

                await saveJsonBin(Db);

                try {
                    await ExileUser(groupId, userId);
                } catch (err) {
                    console.log("Error:", err.response?.status, err.response?.data);
                }

                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("User Group-Banned")
                    .addFields(
                        { name: "User", value: username },
                        { name: "UserId", value: `${userId}` },
                        { name: "Issued By", value: interaction.user.tag },
                        { name: "Date", value: new Date().toISOString().split("T")[0] }
                    );

                await interaction.editReply({ embeds: [embed] });
                return logAction(interaction, embed);
            }

            if (sub === "unban") {

                if (!list.includes(userId))
                    return interaction.editReply(`${username} is not group-banned.`);

                Db.GroupBans[serverId] = list.filter(id => id !== userId);

                await saveJsonBin(Db);

                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("User Group-Unbanned")
                    .addFields(
                        { name: "User", value: username },
                        { name: "UserId", value: `${userId}` },
                        { name: "Issued By", value: interaction.user.tag },
                        { name: "Date", value: new Date().toISOString().split("T")[0] }
                    );

                await interaction.editReply({ embeds: [embed] });
                return logAction(interaction, embed);
            }

        } catch (err) {

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed")
                .setDescription(err.message || "Unknown error");

            await interaction.editReply({ embeds: [embed] });
            return logAction(interaction, embed);
        }
    }
};
