const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");

const CONFIG_CHANNEL_ID = "1423685663642877993";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Set or remove the Roblox group ID for this server.")
        .addSubcommand(sub =>
            sub.setName("set")
               .setDescription("Set the Roblox group ID for this server.")
               .addIntegerOption(opt => opt.setName("groupid").setDescription("The Roblox group ID to link to this server.").setRequired(true)))
        .addSubcommand(sub =>
            sub.setName("remove")
               .setDescription("Request to remove the configured Roblox group from this server.")),

    async execute(interaction, PendingApprovals) {
        if (!interaction.guild) return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });

        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "Only the server owner can use this command.", ephemeral: true });
        }

        const Db = await getJsonBin();
        Db.ServerConfig = Db.ServerConfig || {};
        const existing = Db.ServerConfig[interaction.guild.id];
        const sub = interaction.options.getSubcommand();

        const Channel = await interaction.client.channels.fetch(CONFIG_CHANNEL_ID).catch(() => null);
        if (!Channel) return interaction.reply({ content: "Configuration channel not found.", ephemeral: true });

        if (sub === "set") {
            const GroupId = interaction.options.getInteger("groupid");
            if (existing && existing.GroupId) return interaction.reply({ content: "This server already has a configured group. Use `/config remove` first.", ephemeral: true });

            Db.ServerConfig[interaction.guild.id] = { GroupId };
            await saveJsonBin(Db);

            PendingApprovals[GroupId] = { requesterId: interaction.user.id, guildId: interaction.guild.id, action: "set" };
            const Row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_${GroupId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_${GroupId}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
            );

            await Channel.send({ content: `New pending configuration:\nGroup ID: ${GroupId}\nRequested by: <@${interaction.user.id}>`, components: [Row] });
            return interaction.reply({ content: `Group ID ${GroupId} set. Waiting for admin approval.`, ephemeral: true });
        }

        if (sub === "remove") {
            if (!existing || !existing.GroupId) return interaction.reply({ content: "No group is currently configured.", ephemeral: true });

            const GroupId = existing.GroupId;
            PendingApprovals[GroupId] = { requesterId: interaction.user.id, guildId: interaction.guild.id, action: "remove" };
            const Row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`remove_accept_${GroupId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`remove_decline_${GroupId}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
            );

            await Channel.send({ content: `Pending group removal request:\nGroup ID: ${GroupId}\nRequested by: <@${interaction.user.id}>`, components: [Row] });
            return interaction.reply({ content: `A removal request for group ID ${GroupId} has been sent for approval.`, ephemeral: true });
        }
    }
};
