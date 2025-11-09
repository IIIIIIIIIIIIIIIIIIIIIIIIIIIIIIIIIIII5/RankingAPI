const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");

const SetupSessions = {};

async function sendMessage(client, message) {
  const channelId = "1437041869300437103";
  if (!client?.channels) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) await channel.send(`${message}`);
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

module.exports = async function handleButton(interaction, client) {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const GuildId = interaction.guild?.id;
    const CustomId = interaction.customId;
    await sendMessage(client, `Received: ${CustomId}`);

    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.XP = Db.XP || {};

    let Match, ActionType, GroupId;

    if ((Match = CustomId.match(/^(accept|decline)_(\d+)$/))) {
      ActionType = Match[1];
      GroupId = Match[2];
    } else if ((Match = CustomId.match(/^remove_(accept|decline)_(\d+)$/))) {
      ActionType = Match[1] === "accept" ? "remove_accept" : "remove_decline";
      GroupId = Match[2];
    }

    if (ActionType && GroupId) {
      const Pending = Db.PendingApprovals[GroupId];
      if (!Pending) {
        if (!interaction.replied) await interaction.reply({ content: "No pending request found.", ephemeral: true });
        await sendMessage(client, `No pending request for ${GroupId}`);
        return;
      }

      const Requester = await client.users.fetch(Pending.requesterId).catch(() => null);
      const TargetGuild = Pending.guildId;

      if (ActionType === "accept") {
        Db.ServerConfig[TargetGuild] = { GroupId: Number(GroupId) };
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
        await interaction.update({ content: `Configuration approved for Group ${GroupId}`, components: [] });
        await sendMessage(client, `Approved group ${GroupId}`);
        return;
      }

      if (ActionType === "decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
        await interaction.update({ content: `Configuration declined for Group ${GroupId}`, components: [] });
        await sendMessage(client, `Declined group ${GroupId}`);
        return;
      }

      if (ActionType === "remove_accept") {
        delete Db.ServerConfig[TargetGuild];
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        await leaveGroup(GroupId).catch(() => {});
        if (Requester) Requester.send(`Your group removal request has been approved.`).catch(() => {});
        await interaction.update({ content: `Removed Group ${GroupId}`, components: [] });
        await sendMessage(client, `Removed group ${GroupId}`);
        return;
      }

      if (ActionType === "remove_decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group removal request has been declined.`).catch(() => {});
        await interaction.update({ content: `Removal request declined for Group ${GroupId}`, components: [] });
        await sendMessage(client, `Removal declined for ${GroupId}`);
        return;
      }
    }

    if (CustomId === "xp_yes") {
      await interaction.deferReply({ ephemeral: true });
      const GroupId = Db.ServerConfig?.[GuildId]?.GroupId;
      if (!GroupId) {
        await interaction.editReply({ content: "Group ID not configured." });
        return;
      }

      let Roles;
      try { Roles = await fetchRoles(GroupId); } 
      catch (err) { await interaction.editReply({ content: `Failed to fetch roles: ${err.message}` }); return; }

      Roles = Roles.filter(r => r.name && r.name.toLowerCase() !== "guest");
      if (!Roles.length) { await interaction.editReply({ content: "No valid roles found." }); return; }

      SetupSessions[GuildId] = { SetupIndex: 0, SetupRoles: Roles, Ranks: {} };
      const Role = Roles[0];

      await interaction.editReply({
        content: `Rank: **${Role.name}**`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Role.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Role.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        )]
      });
      await sendMessage(client, `XP setup started. First: ${Role.name}`);
      return;
    }

    if (CustomId === "xp_no") {
      await interaction.update({ content: "XP setup cancelled.", components: [] });
      await sendMessage(client, "XP setup cancelled.");
      return;
    }

    if (CustomId.startsWith("editxp_") || CustomId.startsWith("skipxp_")) {
      const Session = SetupSessions[GuildId];
      if (!Session) { await interaction.reply({ content: "XP setup expired. Restart setup.", ephemeral: true }); return; }

      const RoleId = CustomId.split("_")[1];
      const Role = Session.SetupRoles.find(r => r.id.toString() === RoleId);
      if (!Role) { await interaction.reply({ content: "Role not found.", ephemeral: true }); return; }

      if (CustomId.startsWith("editxp_")) {
        const Modal = new ModalBuilder().setCustomId(`xpmodal_${RoleId}`).setTitle(`Set XP for ${Role.name}`)
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("xp_value").setLabel("XP Amount").setStyle(TextInputStyle.Short).setRequired(true)
          ));
        await interaction.showModal(Modal);
        return;
      }

      Session.SetupIndex++;
      if (Session.SetupIndex >= Session.SetupRoles.length) {
        Db.XP[GuildId] = { Ranks: Session.Ranks };
        delete SetupSessions[GuildId];
        await saveJsonBin(Db);
        await interaction.update({ content: "XP setup complete!", components: [] });
        return;
      }

      const Next = Session.SetupRoles[Session.SetupIndex];
      await interaction.update({
        content: `Rank: **${Next.name}**`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        )]
      });
      return;
    }

    if (interaction.isModalSubmit() && CustomId.startsWith("xpmodal_")) {
      await interaction.deferReply({ ephemeral: true });
      const RoleId = CustomId.split("_")[1];
      const ValueRaw = interaction.fields.getTextInputValue("xp_value");
      const Value = parseInt(ValueRaw);
      if (isNaN(Value)) { await interaction.editReply({ content: "Invalid XP value." }); return; }

      const Session = SetupSessions[GuildId];
      if (!Session) { await interaction.editReply({ content: "XP setup expired." }); return; }

      Session.Ranks[RoleId] = Value;
      Session.SetupIndex++;

      if (Session.SetupIndex >= Session.SetupRoles.length) {
        Db.XP[GuildId] = { Ranks: Session.Ranks };
        delete SetupSessions[GuildId];
        await saveJsonBin(Db);
        await interaction.editReply({ content: "XP setup complete!" });
        return;
      }

      const Next = Session.SetupRoles[Session.SetupIndex];
      await interaction.editReply({
        content: `Rank: **${Next.name}**`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        )]
      });
      return;
    }

    if (interaction.isStringSelectMenu() && CustomId === "remove_xp_roles") {
      const Selected = interaction.values;
      if (!Db.XP[GuildId]) { await interaction.update({ content: "No XP roles configured.", components: [] }); return; }

      for (const Id of Selected) {
        if (Db.XP[GuildId].PermissionRole === Id) delete Db.XP[GuildId].PermissionRole;
      }

      await saveJsonBin(Db);
      await interaction.update({ content: "Removed XP permissions.", components: [] });
      return;
    }

  } catch (error) {
    await sendMessage(client, `Error: ${error.message}`);
    if (!interaction.replied && !interaction.deferred)
      await interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
  }
};
