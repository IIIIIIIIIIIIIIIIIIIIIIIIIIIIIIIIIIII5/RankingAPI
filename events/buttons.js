const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup } = require("../roblox");

module.exports = async function handleButton(interaction, client) {
    const Db = await getJsonBin();
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.ServerConfig = Db.ServerConfig || {};

    const customId = interaction.customId;
    let match = null;
    let actionType = null;
    let GroupId;

    if ((match = customId.match(/^(accept|decline)_(\d+)$/))) {
        actionType = match[1];
        GroupId = match[2];
    } else if ((match = customId.match(/^remove_(accept|decline)_(\d+)$/))) {
        actionType = match[1] === "accept" ? "remove_accept" : "remove_decline";
        GroupId = match[2];
    } else return;

    const pending = Db.PendingApprovals[GroupId];
    if (!pending) return interaction.reply({ content: "No pending request found.", ephemeral: true });

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
};
