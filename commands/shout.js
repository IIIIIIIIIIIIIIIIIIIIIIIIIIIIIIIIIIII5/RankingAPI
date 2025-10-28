const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setGroupShout } = require("../roblox");
const { checkCommandRole } = require("../roleCheck");
const { logAction } = require("../logging");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shout")
        .setDescription("Set the Roblox group shout.")
        .addStringOption(opt => opt.setName("message").setDescription("Shout message").setRequired(true)),

    async execute(interaction) {
        const allowed = await checkCommandRole(interaction, "shout");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        try {
            const message = interaction.options.getString("message");
            const Db = await require("../utils").getJsonBin();
            const GroupId = Db.ServerConfig[interaction.guild.id].GroupId;

            await setGroupShout(GroupId, message);

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("Group Shout Updated")
                .addFields(
                    { name: "Message", value: message },
                    { name: "Group ID", value: String(GroupId), inline: true },
                    { name: "Issued By", value: interaction.user.tag, inline: true },
                    { name: "Date", value: new Date().toISOString().split("T")[0], inline: true }
                );

            await interaction.reply({ embeds: [embed] });
            await logAction(interaction, embed);
        } catch (err) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Failed to Update Shout")
                .setDescription(err.message || "Unknown error")
                .addFields({ name: "Date", value: new Date().toISOString().split("T")[0], inline: true });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            await logAction(interaction, embed);
        }
    }
};
