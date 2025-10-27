const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");
const { randomBytes } = require("crypto");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("apikey")
        .setDescription("Manage server API keys.")
        .addSubcommand(cmd => cmd.setName("generate").setDescription("Generate a new API key."))
        .addSubcommand(cmd => cmd.setName("list").setDescription("List all generated API keys."))
        .addSubcommand(cmd =>
            cmd.setName("delete")
                .setDescription("Delete a specific API key.")
                .addStringOption(opt => opt.setName("key").setDescription("The API key to delete.").setRequired(true))
        ),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "apikey");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const db = await getJsonBin();
        db.ApiKeys = db.ApiKeys || {};
        db.ApiKeys[interaction.guild.id] = db.ApiKeys[interaction.guild.id] || [];

        const sub = interaction.options.getSubcommand();

        if (sub === "generate") {
            if (db.ApiKeys[interaction.guild.id].length >= 3)
                return interaction.reply({ content: "You can only have up to 3 API keys for this server.", ephemeral: true });

            const apiKey = randomBytes(16).toString("hex");
            db.ApiKeys[interaction.guild.id].push(apiKey);
            await saveJsonBin(db);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("API Key Generated")
                .addFields(
                    { name: "Server", value: interaction.guild.name, inline: true },
                    { name: "API Key", value: `\`${apiKey}\``, inline: false },
                    { name: "Limit", value: `${db.ApiKeys[interaction.guild.id].length}/3 keys used`, inline: true }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "list") {
            const keys = db.ApiKeys[interaction.guild.id];
            if (!keys.length) return interaction.reply({ content: "No API keys have been generated for this server.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle("API Keys")
                .setDescription(keys.map((k, i) => `**${i + 1}.** \`${k}\``).join("\n"))
                .setFooter({ text: `${keys.length}/3 keys used` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "delete") {
            const keyToDelete = interaction.options.getString("key");
            const keys = db.ApiKeys[interaction.guild.id];
            if (!keys.includes(keyToDelete))
                return interaction.reply({ content: "That API key does not exist.", ephemeral: true });

            db.ApiKeys[interaction.guild.id] = keys.filter(k => k !== keyToDelete);
            await saveJsonBin(db);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("API Key Deleted")
                .setDescription(`The API key \`${keyToDelete}\` has been removed.`)
                .setFooter({ text: `${db.ApiKeys[interaction.guild.id].length}/3 keys remaining` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
