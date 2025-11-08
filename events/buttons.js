const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");

module.exports = async function handleButton(interaction, client) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

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
            return interaction.update({ content: `Failed to fetch roles from Roblox. Try again later.\nError: ${err.message}`, components: [] });
        }

        if (!roles || roles.length === 0) {
            return interaction.update({ content: "No roles found in the group.", components: [] });
        }

        Db.XP[guildId] = Db.XP[guildId] || {};
        Db.XP[guildId]._setupIndex = 0;
        Db.XP[guildId]._setupRoles = roles;
        Db.XP[guildId].Ranks = Db.XP[guildId].Ranks || {};
        await saveJsonBin(Db);

        const firstRole = roles[0];
        return interaction.update({
            content: `How much XP do you want for the rank **${firstRole.name}**?`,
            components: [
                {
                    type: 1,
                    components: [
                        { type: 2, label: "Set XP", style: 3, custom_id: `setxp_${firstRole.id}` },
                        { type: 2, label: "Skip", style: 2, custom_id: `skipxp_${firstRole.id}` }
                    ]
                }
            ]
        });
    }

    if (customId === "xp_no") {
        return interaction.update({ content: "XP setup cancelled.", components: [] });
    }

    if (customId.startsWith("setxp_") || customId.startsWith("skipxp_")) {
        const xpData = Db.XP[guildId];
        if (!xpData || !xpData._setupRoles || xpData._setupIndex === undefined) {
            return interaction.update({ content: "XP setup data not found or invalid.", components: [] });
        }

        const roleId = customId.split("_")[1];
        const roleIndex = xpData._setupRoles.findIndex(r => r.id.toString() === roleId);
        if (roleIndex === -1) return interaction.update({ content: "Role not found in setup data.", components: [] });

        if (customId.startsWith("setxp_")) xpData.Ranks[roleId] = 0;

        xpData._setupIndex = roleIndex + 1;
        await saveJsonBin(Db);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            return interaction.update({ content: "XP system has been fully configured!", components: [] });
        }

        const nextRole = xpData._setupRoles[xpData._setupIndex];
        return interaction.update({
            content: `How much XP do you want for the rank **${nextRole.name}**?`,
            components: [
                {
                    type: 1,
                    components: [
                        { type: 2, label: "Set XP", style: 3, custom_id: `setxp_${nextRole.id}` },
                        { type: 2, label: "Skip", style: 2, custom_id: `skipxp_${nextRole.id}` }
                    ]
                }
            ]
        });
    }
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
