const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");
const { randomBytes } = require("crypto");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("generateapikey")
        .setDescription("Generate a unique API key for this server."),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "generateapikey");
        if (!allowed)
            return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        try {
            const db = await getJsonBin();
            db.ApiKeys = db.ApiKeys || {};

            const apiKey = randomBytes(16).toString("hex");

            db.ApiKeys[interaction.guild.id] = apiKey;
            await saveJsonBin(db);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("API Key Generated")
                .setDescription("A new API key has been generated for this server.")
                .addFields(
                    { name: "Server", value: interaction.guild.name, inline: true },
                    { name: "API Key", value: `\`${apiKey}\``, inline: false },
                    { name: "Keep this key safe", value: "This key will be used for server-specific requests." }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "Failed to generate API key.", ephemeral: true });
        }
    }
};
