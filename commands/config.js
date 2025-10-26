const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");
const { checkCommandRole } = require("./roleCheck");

const CONFIG_CHANNEL_ID = "1423685663642877993";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Set the Roblox group ID for this server.")
        .addIntegerOption(opt =>
            opt.setName("groupid").setDescription("The Roblox group ID to link to this server.").setRequired(true)
        ),

    async execute(interaction, verifications, PendingApprovals) {
        const allowed = await checkCommandRole(interaction, "config");
        if (!allowed) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });

        if (!interaction.guild) return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });

        const GroupId = interaction.options.getInteger("groupid");
        const Db = await getJsonBin();
        Db.ServerConfig = Db.ServerConfig || {};
        Db.ServerConfig[interaction.guild.id] = { ...Db.ServerConfig[interaction.guild.id], GroupId };
        await saveJsonBin(Db);

        PendingApprovals[GroupId] = { requesterId: interaction.user.id, guildId: interaction.guild.id };

        const Channel = await interaction.client.channels.fetch(CONFIG_CHANNEL_ID).catch(() => null);
        if (!Channel) return interaction.reply({ content: "Configuration channel not found.", ephemeral: true });

        const Row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${GroupId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_${GroupId}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
        );

        await Channel.send({ content: `New pending configuration:\nGroup ID: ${GroupId}\nRequested by: <@${interaction.user.id}>`, components: [Row] });

        await interaction.reply({ content: `Group ID ${GroupId} set. Waiting for admin approval.`, ephemeral: true });
    }
};
