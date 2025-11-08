const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");

module.exports = async function handleButton(interaction, client) {
    if (!interaction.isButton()) return;

    const Db = await getJsonBin();
    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};

    const customId = interaction.customId;

    let actionType, GroupId;
    let match;
    if ((match = customId.match(/^(accept|decline)_(\d+)$/))) {
        actionType = match[1];
        GroupId = match[2];
    } else if ((match = customId.match(/^remove_(accept|decline)_(\d+)$/))) {
        actionType = match[1] === "accept" ? "remove_accept" : "remove_decline";
        GroupId = match[2];
    }

    if (actionType && GroupId) {
        const pending = Db.PendingApprovals[GroupId];
        if (!pending) return interaction.reply({ content: "No pending request found for this group ID.", ephemeral: true });

        const guildId = pending.guildId;
        const requester = await client.users.fetch(pending.requesterId).catch(() => null);

        if (actionType === "accept") {
            Db.ServerConfig[guildId] = { GroupId: Number(GroupId) };
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
            delete Db.ServerConfig[guildId];
            delete Db.PendingApprovals[GroupId];
            await saveJsonBin(Db);
            await leaveGroup(GroupId);
            if (requester) await requester.send(`Your group removal request has been approved. The linked group for the server has been removed.`);
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
        await interaction.update({ content: "Starting XP setup...", components: [] });

        const guildId = interaction.guild.id;
        const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
        if (!GroupId) return interaction.followUp({ content: "Group ID not configured.", ephemeral: true });

        const roles = await fetchRoles(GroupId);
        Db.XP = Db.XP || {};
        Db.XP[guildId] = Db.XP[guildId] || { Ranks: {} };
        await saveJsonBin(Db);

        for (const role of roles.slice(0, -1)) {
            await interaction.followUp({
                content: `How much XP do you want for the rank **${role.name}**?`,
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, label: "Set XP", style: 3, custom_id: `setxp_${role.id}` },
                            { type: 2, label: "Skip", style: 2, custom_id: `skipxp_${role.id}` }
                        ]
                    }
                ],
                ephemeral: true
            });
        }

        return interaction.followUp({ content: "XP System has been configured.", ephemeral: true });
    }

    if (customId === "xp_no") {
        await interaction.update({ content: "XP setup cancelled.", components: [] });
        return;
    }

    if (customId.startsWith("setxp_")) {
        const roleId = customId.split("_")[1];
        await interaction.reply({ content: `You chose to set XP for role ID ${roleId}.`, ephemeral: true });
        return;
    }

    if (customId.startsWith("skipxp_")) {
        const roleId = customId.split("_")[1];
        await interaction.reply({ content: `Skipped XP setup for role ID ${roleId}.`, ephemeral: true });
        return;
    }
};
