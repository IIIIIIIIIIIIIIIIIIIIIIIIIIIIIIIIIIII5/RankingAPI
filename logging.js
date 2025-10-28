const { getJsonBin } = require("./utils");

async function logAction(interaction, embed) {
    const Db = await getJsonBin();
    const LoggingChannelId = Db.ServerConfig?.[interaction.guild.id]?.LoggingChannel;
    if (!LoggingChannelId) return;

    const loggingChannel = await interaction.guild.channels.fetch(LoggingChannelId).catch(() => null);
    if (!loggingChannel || !loggingChannel.isTextBased()) return;

    await loggingChannel.send({ embeds: [embed] });
}

module.exports = { logAction };
