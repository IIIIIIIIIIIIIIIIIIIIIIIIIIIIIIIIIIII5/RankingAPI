const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { checkCommandRole } = require("../roleCheck");
const { getJsonBin, saveJsonBin } = require("../utils");
const { getRobloxUserId } = require("../roblox");
const { fetchRoles } = require("../roblox");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("xp")
        .setDescription("Manage the XP system")
        .addSubcommand(sub => sub
            .setName("setup")
            .setDescription("Setup XP system for your group"))
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
            .addStringOption(opt => opt.setName("roleid").setDescription("Role ID allowed to give XP").setRequired(true)))
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

    async execute(interaction) {
        const Db = await getJsonBin();
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === "setup") {
            const allowed = await checkCommandRole(interaction, "config");
            if (!allowed) return interaction.reply({ content: "You don't have permission.", ephemeral: true });

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

        if (sub === "add" || sub === "remove") {
            const allowed = await checkCommandRole(interaction, "xp");
            if (!allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

            const username = interaction.options.getString("username");
            const amount = interaction.options.getInteger("amount");

            try {
                const userId = await getRobloxUserId(username);
                Db.XP = Db.XP || {};
                Db.XP[guildId] = Db.XP[guildId] || {};
                Db.XP[guildId][userId] = Db.XP[guildId][userId] || { amount: 0 };

                if (sub === "add") Db.XP[guildId][userId].amount += amount;
                if (sub === "remove") Db.XP[guildId][userId].amount = Math.max(Db.XP[guildId][userId].amount - amount, 0);

                await saveJsonBin(Db);
                return interaction.reply({ content: `${sub === "add" ? "Added" : "Removed"} ${amount} XP ${sub === "add" ? "to" : "from"} ${username}.`, ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: `Failed: ${err.message}`, ephemeral: true });
            }
        }

        if (sub === "permission") {
            const allowed = await checkCommandRole(interaction, "xp");
            if (!allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

            const roleId = interaction.options.getString("roleid");
            Db.XP = Db.XP || {};
            Db.XP[guildId] = Db.XP[guildId] || {};
            Db.XP[guildId].PermissionRole = roleId;
            await saveJsonBin(Db);

            return interaction.reply({ content: `XP permission role set to <@&${roleId}>`, ephemeral: true });
        }

        if (sub === "permission_remove") {
            const allowed = await checkCommandRole(interaction, "xp");
            if (!allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

            const xpRoles = [];
            if (Db.XP[guildId]?.PermissionRole) {
                const role = interaction.guild.roles.cache.get(Db.XP[guildId].PermissionRole);
                if (role) xpRoles.push({ label: role.name, value: role.id });
            }

            if (xpRoles.length === 0) {
                return interaction.reply({ content: "No roles have XP permission.", ephemeral: true });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("remove_xp_roles")
                .setPlaceholder("Select role(s) to remove XP permission")
                .setMinValues(1)
                .setMaxValues(xpRoles.length)
                .addOptions(xpRoles);

            return interaction.reply({
                content: "Select the role(s) to remove XP permission from:",
                components: [{ type: 1, components: [menu] }],
                ephemeral: true
            });
        }

        if (sub === "name") {
            const allowed = await checkCommandRole(interaction, "xp");
            if (!allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

            const xpName = interaction.options.getString("xpname");
            Db.XP = Db.XP || {};
            Db.XP[guildId] = Db.XP[guildId] || {};
            Db.XP[guildId].Name = xpName;
            await saveJsonBin(Db);

            return interaction.reply({ content: `XP name set to ${xpName}`, ephemeral: true });
        }

        if (sub === "channel") {
            const allowed = await checkCommandRole(interaction, "xp");
            if (!allowed) return interaction.reply({ content: "No permission.", ephemeral: true });

            const channel = interaction.options.getChannel("channel");
            Db.XP = Db.XP || {};
            Db.XP[guildId] = Db.XP[guildId] || {};
            Db.XP[guildId].LogChannel = channel.id;
            await saveJsonBin(Db);

            return interaction.reply({ content: `XP logs will now be sent in ${channel}`, ephemeral: true });
        }
    }
};
