const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function handleButton(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.XP = Db.XP || {};

    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    let match, actionType, GroupId;
    if ((match = customId.match(/^(accept|decline)_(\d+)$/))) {
        actionType = match[1];
        GroupId = match[2];
    } else if ((match = customId.match(/^remove_(accept|decline)_(\d+)$/))) {
        actionType = match[1] === "accept" ? "remove_accept" : "remove_decline";
        GroupId = match[2];
    }

    if (actionType && GroupId) {
        const pending = Db.PendingApprovals[GroupId];
        if (!pending) return interaction.reply({ content: "No pending request found.", ephemeral: true });

        const requester = await client.users.fetch(pending.requesterId).catch(() => null);
        const guildIdPending = pending.guildId;

        if (actionType === "accept") {
            Db.ServerConfig[guildIdPending] = { GroupId: Number(GroupId) };
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            if (requester) await requester.send(`Your group configuration for ID ${GroupId} has been approved.`);
            return interaction.update({ content: `Configuration approved. Group ID ${GroupId} is now set.`, components: [] });
        }

        if (actionType === "decline") {
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            if (requester) await requester.send(`Your group configuration for ID ${GroupId} has been declined.`);
            return interaction.update({ content: `Configuration request for Group ID ${GroupId} declined.`, components: [] });
        }

        if (actionType === "remove_accept") {
            delete Db.ServerConfig[guildIdPending];
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            await leaveGroup(GroupId);
            if (requester) await requester.send(`Your group removal request has been approved.`);
            return interaction.update({ content: `Removal request approved. Group ID ${GroupId} has been removed.`, components: [] });
        }

        if (actionType === "remove_decline") {
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            if (requester) await requester.send(`Your group removal request has been declined.`);
            return interaction.update({ content: `Removal request for Group ID ${GroupId} declined.`, components: [] });
        }
        return;
    }

    if (customId === "xp_yes") {
        const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
        if (!GroupId) return interaction.update({ content: "Group ID not configured.", components: [] });

        let roles;
        try {
            roles = (await fetchRoles(GroupId)).filter(r => r.name.toLowerCase() !== "guest");
        } catch (err) {
            return interaction.update({ content: `Failed to fetch roles from Roblox.\n${err.message}`, components: [] });
        }

        if (!roles.length) return interaction.update({ content: "No roles found in the group.", components: [] });

        Db.XP[guildId] = Db.XP[guildId] || {};
        Db.XP[guildId]._setupIndex = 0;
        Db.XP[guildId]._setupRoles = roles;
        Db.XP[guildId].Ranks = Db.XP[guildId].Ranks || {};
        await saveJsonBin(Db);

        const firstRole = roles[0];
        const modal = new ModalBuilder()
            .setCustomId(`xp_modal_${firstRole.id}`)
            .setTitle(`Set XP for ${firstRole.name}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("xp_amount")
                        .setLabel("Enter XP amount")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );

        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId.startsWith("xp_modal_")) {
        const roleId = customId.split("_")[2];
        const xpData = Db.XP[guildId];
        if (!xpData || !xpData._setupRoles || xpData._setupIndex === undefined) {
            return interaction.reply({ content: "XP setup data not found or invalid.", ephemeral: true });
        }

        const input = interaction.fields.getTextInputValue("xp_amount");
        const xpValue = parseInt(input);
        if (isNaN(xpValue) || xpValue < 0) {
            return interaction.reply({ content: "Invalid XP value.", ephemeral: true });
        }

        xpData.Ranks[roleId] = xpValue;
        xpData._setupIndex += 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.reply({ content: "XP system has been fully configured!", ephemeral: true });
        }

        const nextRole = xpData._setupRoles[xpData._setupIndex];
        const modal = new ModalBuilder()
            .setCustomId(`xp_modal_${nextRole.id}`)
            .setTitle(`Set XP for ${nextRole.name}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("xp_amount")
                        .setLabel("Enter XP amount")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );

        return interaction.reply({ content: `XP for **${interaction.guild.roles.cache.get(roleId)?.name || "unknown"}** set to ${xpValue}.`, ephemeral: true })
            .then(() => interaction.showModal(modal));
    }

    if (customId === "xp_no") return interaction.update({ content: "XP setup cancelled.", components: [] });

    if (interaction.isStringSelectMenu() && customId === "remove_xp_roles") {
        const selectedRoles = interaction.values;
        if (!Db.XP[guildId]) return interaction.update({ content: "No XP roles configured.", components: [] });

        for (const roleId of selectedRoles) {
            if (Db.XP[guildId].PermissionRole && Db.XP[guildId].PermissionRole === roleId) {
                delete Db.XP[guildId].PermissionRole;
            }
        }
        await saveJsonBin(Db);
        return interaction.update({ content: `Removed XP permissions for selected role(s).`, components: [] });
    }
};
