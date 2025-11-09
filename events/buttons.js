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

        const respondAndSave = async (msg) => {
            await saveJsonBin(Db);
            return interaction.update({ content: msg, components: [] });
        };

        switch (actionType) {
            case "accept":
                Db.ServerConfig[guildIdPending] = { GroupId: Number(GroupId) };
                delete Db.PendingApprovals[GroupId];
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
                return respondAndSave(`Configuration approved. Group ID ${GroupId} is now set.`);
            case "decline":
                delete Db.PendingApprovals[GroupId];
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
                return respondAndSave(`Configuration request for Group ID ${GroupId} declined.`);
            case "remove_accept":
                delete Db.ServerConfig[guildIdPending];
                delete Db.PendingApprovals[GroupId];
                await leaveGroup(GroupId).catch(() => {});
                if (requester) requester.send(`Your group removal request has been approved.`).catch(() => {});
                return respondAndSave(`Removal request approved. Group ID ${GroupId} has been removed.`);
            case "remove_decline":
                delete Db.PendingApprovals[GroupId];
                if (requester) requester.send(`Your group removal request has been declined.`).catch(() => {});
                return respondAndSave(`Removal request for Group ID ${GroupId} declined.`);
        }
    }

    if (customId === "xp_yes") {
        const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
        if (!GroupId) return interaction.update({ content: "Group ID not configured.", components: [] });

        let roles;
        try {
            roles = await fetchRoles(GroupId);
        } catch (err) {
            return interaction.update({ content: `Failed to fetch roles. ${err.message}`, components: [] });
        }

        roles = roles.filter(r => r.name.toLowerCase() !== "guest");

        Db.XP[guildId] = { _setupIndex: 0, _setupRoles: roles, Ranks: {} };
        await saveJsonBin(Db);

        const firstRole = roles[0];
        return interaction.update({
            content: `Rank: **${firstRole.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${firstRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${firstRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    if (customId === "xp_no") {
        return interaction.update({ content: "XP setup cancelled.", components: [] });
    }

    if (customId.startsWith("editxp_")) {
        const roleId = customId.split("_")[1];
        const xpData = Db.XP[guildId];
        const role = xpData?._setupRoles?.find(r => r.id === roleId);
        if (!role) return interaction.reply({ content: "Role not found.", ephemeral: true });

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
        if (!xpData?._setupRoles) return interaction.reply({ content: "XP setup data missing.", ephemeral: true });

        xpData._setupIndex += 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.update({ content: "XP system fully configured!", components: [] });
        }

        const nextRole = xpData._setupRoles[xpData._setupIndex];
        return interaction.update({
            content: `Rank: **${nextRole.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${nextRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${nextRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("xpmodal_")) {
        const roleId = interaction.customId.split("_")[1];
        const xpValueRaw = interaction.fields.getTextInputValue("xp_value");
        const xpValue = parseInt(xpValueRaw);

        const xpData = Db.XP[guildId];
        if (!xpData || !xpData._setupRoles || !xpData.Ranks) {
            return interaction.reply({ content: "XP setup data missing. Please restart the setup.", ephemeral: true });
        }

        if (isNaN(xpValue)) {
            return interaction.reply({ content: "Invalid XP value. Please enter a number.", ephemeral: true });
        }

        xpData.Ranks[roleId] = xpValue;
        xpData._setupIndex += 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.reply({ content: "XP system fully configured!", ephemeral: true });
        }

        const nextRole = xpData._setupRoles[xpData._setupIndex];
        return interaction.reply({
            content: `Rank: **${nextRole.name}**`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`editxp_${nextRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`skipxp_${nextRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                )
            ],
            ephemeral: true
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
