const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getJsonBin } = require("../utils");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("whois")
        .setDescription("Lookup a Roblox user from a Discord user")
        .addUserOption(opt => opt.setName("user").setDescription("The Discord user to look up").setRequired(false)),
    async execute(interaction) {
        const TargetUser = interaction.options.getUser("user") || interaction.user;
        const Db = await getJsonBin();
        const VerifiedUsers = Db.VerifiedUsers || {};
        const RobloxUserId = VerifiedUsers[TargetUser.id];

        if (!RobloxUserId) return interaction.reply({ content: `${TargetUser.tag} has not verified a Roblox account.`, ephemeral: true });

        const Res = await axios.get(`https://users.roblox.com/v1/users/${RobloxUserId}`);
        const RobloxInfo = Res.data;

        const Embed = new EmbedBuilder().setColor(0x3498db).setTitle("User Lookup").addFields(
            { name: "Discord User", value: `${TargetUser.tag} (${TargetUser.id})`, inline: false },
            { name: "Roblox Username", value: `[${RobloxInfo.name}](https://www.roblox.com/users/${RobloxInfo.id}/profile)`, inline: true },
            { name: "Roblox User ID", value: String(RobloxInfo.id), inline: true },
            { name: "Description", value: RobloxInfo.description?.slice(0, 200) || "None", inline: false }
        ).setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${RobloxInfo.id}&width=150&height=150&format=png`);

        await interaction.reply({ embeds: [Embed] });
    }
};
