const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { GetRobloxUserId, GetRobloxDescription } = require("../roblox");
const { getJsonBin, saveJsonBin } = require("../utils");
const crypto = require("crypto");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Verify your Roblox account")
        .addStringOption(opt => opt.setName("username").setDescription("Your Roblox username").setRequired(true)),
    async execute(interaction, verifications) {
        const username = interaction.options.getString("username");
        const userId = await getRobloxUserId(username);
        const code = "VERIFY-" + crypto.randomBytes(3).toString("hex").toUpperCase();

        verifications[interaction.user.id] = { RobloxUserId: userId, Code: code };
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("done_verification").setLabel("Done").setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: `Put this code in your Roblox profile description:\n\`${code}\`\nThen click the Done button when finished.`,
            components: [row],
            ephemeral: true
        });
    }
};
