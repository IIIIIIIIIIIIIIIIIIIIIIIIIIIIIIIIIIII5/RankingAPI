const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setGroupShout } = require("../roblox");
const { getJsonBin } = require("../utils");
const { checkCommandRole } = require("../roleCheck");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shout")
        .setDescription("Set the Roblox group shout.")
        .addStringOption(opt => opt.setName("message").setDescription("Shout message").setRequired(true)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "shout");
        if (!allowed)
            return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        const db = await getJsonBin();
        if (!db.ServerConfig?.[interaction.guild.id])
            return interaction.reply({ content: "Group ID not set. Run /config first.", ephemeral: true });

        const groupId = db.ServerConfig[interaction.guild.id].GroupId;
        const message = interaction.options.getString("message");

        try {
            await setGroupShout(groupId, message);

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("Group Shout Updated")
                .addFields(
                    { name: "Message", value: message },
                    { name: "Group ID", value: String(groupId), inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({
                content: `Failed to update shout: ${err.message || "Unknown error"}`,
                ephemeral: true
            });
        }
    }
};
