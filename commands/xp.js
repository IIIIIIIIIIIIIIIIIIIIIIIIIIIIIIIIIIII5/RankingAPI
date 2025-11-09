const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { checkCommandRole } = require("../roleCheck");
const { getJsonBin, saveJsonBin } = require("../firestore");
const { getRobloxUserId } = require("../roblox");

const DebugChannelId = "1437041869300437103";

async function sendDebug(client, message) {
  const Channel = await client.channels.fetch(DebugChannelId).catch(() => null);
  if (Channel) Channel.send(`[DEBUG] ${message}`).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manage the XP system")
    .addSubcommand(sub => sub.setName("setup").setDescription("Setup XP system for your group"))
    .addSubcommand(sub => sub
      .setName("add")
      .setDescription("Add XP to a user")
      .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Amount of XP to add").setRequired(true)))
    .addSubcommand(sub => sub
      .setName("remove")
      .setDescription("Remove XP from a user")
      .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Amount of XP to remove").setRequired(true)))
    .addSubcommand(sub => sub
      .setName("permission")
      .setDescription("Set ranks that can give XP")
      .addRoleOption(opt => opt.setName("role").setDescription("Role allowed to give XP").setRequired(true)))
    .addSubcommand(sub => sub
      .setName("permission_remove")
      .setDescription("Remove ranks allowed to give XP"))
    .addSubcommand(sub => sub
      .setName("name")
      .setDescription("Set a custom name for XP")
      .addStringOption(opt => opt.setName("xpname").setDescription("Custom XP name").setRequired(true)))
    .addSubcommand(sub => sub
      .setName("channel")
      .setDescription("Set the logging channel for XP")
      .addChannelOption(opt => opt.setName("channel").setDescription("Channel to log XP").setRequired(true))),

  async execute(interaction, client) {
    const Db = await getJsonBin();
    const GuildId = interaction.guild.id;
    const Subcommand = interaction.options.getSubcommand();

    await sendDebug(client, `XP command executed: ${Subcommand} by ${interaction.user.tag}`);

    if (Subcommand === "setup") {
      const Allowed = await checkCommandRole(interaction, "config");
      if (!Allowed) return interaction.reply({ content: "You don't have permission.", ephemeral: true });

      return interaction.reply({
        content: "Are you sure you want to set up your group ranks with XP?",
        components: [
          {
            type: 1,
            components: [
              { type: 2, label: "Yes", style: 3, custom_id: "xp_yes" },
              { type: 2, label: "No", style: 4, custom_id: "xp_no" }
            ]
          }
        ],
        ephemeral: true
      });
    }

    if (Subcommand === "add" || Subcommand === "remove") {
      const Allowed = await checkCommandRole(interaction, "xp");
      if (!Allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

      const Username = interaction.options.getString("username");
      const Amount = interaction.options.getInteger("amount");

      try {
        let UserId;
        for (let i = 0; i < 3; i++) {
          try {
            UserId = await getRobloxUserId(Username);
            break;
          } catch (err) {
            if (i === 2) throw err;
          }
        }

        Db.XP = Db.XP || {};
        Db.XP[GuildId] = Db.XP[GuildId] || {};
        Db.XP[GuildId][UserId] = Db.XP[GuildId][UserId] || { Amount: 0 };

        if (Subcommand === "add") Db.XP[GuildId][UserId].Amount += Amount;
        if (Subcommand === "remove") Db.XP[GuildId][UserId].Amount = Math.max(Db.XP[GuildId][UserId].Amount - Amount, 0);

        await saveJsonBin(Db);

        return interaction.reply({ content: `${Subcommand === "add" ? "Added" : "Removed"} ${Amount} XP ${Subcommand === "add" ? "to" : "from"} ${Username}.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `Failed to fetch Roblox data: ${err.message}`, ephemeral: true });
      }
    }

    if (Subcommand === "permission") {
      const Allowed = await checkCommandRole(interaction, "xp");
      if (!Allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

      const Role = interaction.options.getRole("role");
      if (!Role) return interaction.reply({ content: "Invalid role.", ephemeral: true });

      Db.XP = Db.XP || {};
      Db.XP[GuildId] = Db.XP[GuildId] || {};
      Db.XP[GuildId].PermissionRole = Role.id;
      await saveJsonBin(Db);

      return interaction.reply({ content: `XP permission role set to ${Role}`, ephemeral: true });
    }

    if (Subcommand === "permission_remove") {
      const Allowed = await checkCommandRole(interaction, "xp");
      if (!Allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

      const XPRoles = [];
      if (Db.XP[GuildId]?.PermissionRole) {
        const Role = interaction.guild.roles.cache.get(Db.XP[GuildId].PermissionRole);
        if (Role) XPRoles.push({ label: Role.name, value: Role.id });
      }

      if (!XPRoles.length) return interaction.reply({ content: "No roles have XP permission.", ephemeral: true });

      const Menu = new StringSelectMenuBuilder()
        .setCustomId("remove_xp_roles")
        .setPlaceholder("Select role(s) to remove XP permission")
        .setMinValues(1)
        .setMaxValues(XPRoles.length)
        .addOptions(XPRoles);

      return interaction.reply({ content: "Select the role(s) to remove XP permission:", components: [{ type: 1, components: [Menu] }], ephemeral: true });
    }

    if (Subcommand === "name") {
      const Allowed = await checkCommandRole(interaction, "xp");
      if (!Allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

      const XPName = interaction.options.getString("xpname");

      Db.XP = Db.XP || {};
      Db.XP[GuildId] = Db.XP[GuildId] || {};
      Db.XP[GuildId].Name = XPName;
      await saveJsonBin(Db);

      return interaction.reply({ content: `XP name set to ${XPName}`, ephemeral: true });
    }

    if (Subcommand === "channel") {
      const Allowed = await checkCommandRole(interaction, "xp");
      if (!Allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

      const Channel = interaction.options.getChannel("channel");

      Db.XP = Db.XP || {};
      Db.XP[GuildId] = Db.XP[GuildId] || {};
      Db.XP[GuildId].LogChannel = Channel.id;
      await saveJsonBin(Db);

      return interaction.reply({ content: `XP logs will now be sent in ${Channel}`, ephemeral: true });
    }
  }
};
