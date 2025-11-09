const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = async function handleButton(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.XP = Db.XP || {};

    const guildId = interaction.guild?.id;
    const customId = interaction.customId;

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
            if (requester) requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
            return interaction.update({ content: `Configuration approved. Group ID ${GroupId} is now set.`, components: [] });
        }

        if (actionType === "decline") {
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            if (requester) requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
            return interaction.update({ content: `Configuration request for Group ID ${GroupId} declined.`, components: [] });
        }

        if (actionType === "remove_accept") {
            delete Db.ServerConfig[guildIdPending];
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            await leaveGroup(GroupId).catch(() => {});
            if (requester) requester.send(`Your group removal request has been approved.`).catch(() => {});
            return interaction.update({ content: `Removal request approved. Group ID ${GroupId} has been removed.`, components: [] });
        }

        if (actionType === "remove_decline") {
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            if (requester) requester.send(`Your group removal request has been declined.`).catch(() => {});
            return interaction.update({ content: `Removal request for Group ID ${GroupId} declined.`, components: [] });
        }
        return;
    }

    if (customId === "xp_yes") {
        const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
        if (!GroupId) return interaction.update({ content: "Group ID not configured.", components: [] });

        let roles;
        try { roles = await fetchRoles(GroupId); } catch (err) {
            return interaction.update({ content: `Failed to fetch roles. ${err.message}`, components: [] });
        }

        roles = roles.filter(r => r.name.toLowerCase() !== "guest");

        Db.XP[guildId] = Db.XP[guildId] || {};
        Db.XP[guildId]._setupIndex = 0;
        Db.XP[guildId]._setupRoles = roles;
        Db.XP[guildId].Ranks = Db.XP[guildId].Ranks || {};
        await saveJsonBin(Db);

        const role = roles[0];
        return interaction.update({
            content: `Rank: **${role.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${role.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${role.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    if (customId === "xp_no") return interaction.update({ content: "XP setup cancelled.", components: [] });

    if (customId.startsWith("editxp_")) {
        const roleId = customId.split("_")[1];
        const xpData = Db.XP[guildId];
        const role = xpData._setupRoles.find(r => r.id == roleId);

        const modal = new ModalBuilder()
            .setCustomId(`xpmodal_${roleId}`)
            .setTitle(`Set XP for ${role.name}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("xp_value")
                        .setLabel("XP amount")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );

        return interaction.showModal(modal);
    }

    if (customId.startsWith("skipxp_")) {
        const xpData = Db.XP[guildId];
        xpData._setupIndex += 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.update({ content: "XP system fully configured!", components: [] });
        }

        const next = xpData._setupRoles[xpData._setupIndex];
        return interaction.update({
            content: `Rank: **${next.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    if (interaction.isModalSubmit() && customId.startsWith("xpmodal_")) {
        const roleId = customId.split("_")[1];
        const xpValue = parseInt(interaction.fields.getTextInputValue("xp_value"));

        const xpData = Db.XP[guildId];
        xpData.Ranks[roleId] = xpValue;
        xpData._setupIndex += 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.reply({ content: "XP system fully configured!", ephemeral: true });
        }

        const next = xpData._setupRoles[xpData._setupIndex];
        return interaction.update({
            content: `Rank: **${next.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    if (interaction.isStringSelectMenu() && customId === "remove_xp_roles") {
        const selected = interaction.values;
        if (!Db.XP[guildId]) return interaction.update({ content: "No XP roles configured.", components: [] });

        for (const r of selected) {
            if (Db.XP[guildId].PermissionRole === r) delete Db.XP[guildId].PermissionRole;
        }
        await saveJsonBin(Db);
        return interaction.update({ content: "Removed XP role permissions.", components: [] });
    }
};
