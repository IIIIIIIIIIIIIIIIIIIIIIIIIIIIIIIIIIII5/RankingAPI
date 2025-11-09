const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");

const SetupSessions = {};

module.exports = async function handleButton(interaction, client) {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const GuildId = interaction.guild?.id;
    const CustomId = interaction.customId;
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
      if (!Pending) return interaction.replied ? null : interaction.reply({ content: "No pending request found.", ephemeral: true });

      const Requester = await client.users.fetch(Pending.requesterId).catch(() => null);
      const TargetGuild = Pending.guildId;

      if (ActionType === "accept") {
        Db.ServerConfig[TargetGuild] = { GroupId: Number(GroupId) };
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
        return interaction.update({ content: `Configuration approved for Group ${GroupId}`, components: [] });
      }

      if (ActionType === "decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
        return interaction.update({ content: `Configuration declined for Group ${GroupId}`, components: [] });
      }

      if (ActionType === "remove_accept") {
        delete Db.ServerConfig[TargetGuild];
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        await leaveGroup(GroupId).catch(() => {});
        if (Requester) Requester.send(`Your group removal request has been approved.`).catch(() => {});
        return interaction.update({ content: `Removed Group ${GroupId}`, components: [] });
      }

      if (ActionType === "remove_decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        if (Requester) Requester.send(`Your group removal request has been declined.`).catch(() => {});
        return interaction.update({ content: `Removal request declined for Group ${GroupId}`, components: [] });
      }
    }

    if (CustomId === "xp_yes" || CustomId === "xp_no") {
      if (CustomId === "xp_no") return interaction.update({ content: "XP setup cancelled.", components: [] });
      await interaction.deferReply({ ephemeral: true });

      const GroupId = Db.ServerConfig?.[GuildId]?.GroupId;
      if (!GroupId) return interaction.editReply({ content: "Group ID not configured." });

      let Roles;
      try { Roles = await fetchRoles(GroupId); } catch (err) { return interaction.editReply({ content: `Failed to fetch roles: ${err.message}` }); }

      Roles = Roles.filter(r => r.name && r.name.toLowerCase() !== "guest");
      if (!Roles.length) return interaction.editReply({ content: "No valid roles found." });

      SetupSessions[GuildId] = { SetupIndex: 0, SetupRoles: Roles, Ranks: {} };
      const Role = Roles[0];

      return interaction.editReply({
        content: `Rank: **${Role.name}**`,
        components: [ new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Role.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Role.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        ) ]
      });
    }

    if (CustomId.startsWith("editxp_") || CustomId.startsWith("skipxp_")) {
      const Session = SetupSessions[GuildId];
      if (!Session) return interaction.reply({ content: "XP setup expired. Restart setup.", ephemeral: true });

      const RoleId = CustomId.split("_")[1];
      const Role = Session.SetupRoles.find(r => r.id.toString() === RoleId);
      if (!Role) return interaction.reply({ content: "Role not found.", ephemeral: true });

      if (CustomId.startsWith("editxp_")) {
        const Modal = new ModalBuilder().setCustomId(`xpmodal_${RoleId}`).setTitle(`Set XP for ${Role.name}`)
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp_value").setLabel("XP Amount").setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(Modal);
      }

      Session.SetupIndex++;
      if (Session.SetupIndex >= Session.SetupRoles.length) {
        Db.XP[GuildId] = { Ranks: Session.Ranks };
        delete SetupSessions[GuildId];
        await saveJsonBin(Db);
        return interaction.update({ content: "XP setup complete!", components: [] });
      }

      const Next = Session.SetupRoles[Session.SetupIndex];
      return interaction.update({
        content: `Rank: **${Next.name}**`,
        components: [ new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        ) ]
      });
    }

    if (interaction.isModalSubmit() && CustomId.startsWith("xpmodal_")) {
      const RoleId = CustomId.split("_")[1];
      const ValueRaw = interaction.fields.getTextInputValue("xp_value");
      const Value = parseInt(ValueRaw);
      if (isNaN(Value)) return interaction.reply({ content: "Invalid XP value.", ephemeral: true });

      const Session = SetupSessions[GuildId];
      if (!Session) return interaction.reply({ content: "XP setup expired.", ephemeral: true });

      Session.Ranks[RoleId] = Value;
      Session.SetupIndex++;

      if (Session.SetupIndex >= Session.SetupRoles.length) {
        Db.XP[GuildId] = { Ranks: Session.Ranks };
        delete SetupSessions[GuildId];
        await saveJsonBin(Db);
        return interaction.reply({ content: "XP setup complete!", ephemeral: true });
      }

      const Next = Session.SetupRoles[Session.SetupIndex];
      return interaction.followUp({
        content: `Rank: **${Next.name}**`,
        ephemeral: true,
        components: [ new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`editxp_${Next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`skipxp_${Next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
        ) ]
      });
    }

    if (interaction.isStringSelectMenu() && CustomId === "remove_xp_roles") {
      const Selected = interaction.values;
      if (!Db.XP[GuildId]) return interaction.update({ content: "No XP roles configured.", components: [] });

      for (const Id of Selected) {
        if (Db.XP[GuildId].PermissionRole === Id) delete Db.XP[GuildId].PermissionRole;
      }

      await saveJsonBin(Db);
      return interaction.update({ content: "Removed XP permissions.", components: [] });
    }

  } catch {
    if (!interaction.replied && !interaction.deferred)
      await interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
  }
};
