const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

async function sendBlockedMessage(interaction) {
    const blockedType = interaction.guild ? "server" : "user";

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Contact Support")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.gg/VhBqwBxHSd")
    );

    const messages = {
        user: [
            "You have been blocked from using the bot. For assistance, please contact support.",
            "Access denied. Your account has been restricted. Reach out to our support team for help."
        ],
        server: [
            "This server has been blocked from using the bot. Contact support for assistance.",
            "Access to this server is restricted. Please get in touch with support if you believe this is an error."
        ]
    };

    const message = messages[blockedType][Math.floor(Math.random() * messages[blockedType].length)];

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message, components: [row], ephemeral: true }).catch(() => {});
    } else {
        await interaction.reply({ content: message, components: [row], ephemeral: true }).catch(() => {});
    }
}

module.exports = { sendBlockedMessage };
