const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = async function handleButton(interaction) {
    const Db = await getJsonBin();
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.ServerConfig = Db.ServerConfig || {};

    const customId = interaction.customId;
    let match = null;
    let actionType = null;

    if ((match = customId.match(/^(accept|decline)_(\d+)$/))) {
        actionType = match[1];
        var GroupId = match[2];
    } else if ((match = customId.match(/^remove_(accept|decline)_(\d+)$/))) {
        actionType = match[1] === "accept" ? "remove_accept" : "remove_decline";
        var GroupId = match[2];
    } else return;

    const pending = Db.PendingApprovals[GroupId];
    if (!pending) return interaction.reply({ content: "No pending request found.", ephemeral: true });

    const guildId = pending.guildId;

    if (actionType === "accept") {
        Db.ServerConfig[guildId] = { GroupId: Number(GroupId) };
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        return interaction.update({ content: `Configuration approved. Group ID ${GroupId} is now set.`, components: [] });
    }

    if (actionType === "decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        return interaction.update({ content: `Configuration request for Group ID ${GroupId} declined.`, components: [] });
    }

    if (actionType === "remove_accept") {
        delete Db.ServerConfig[guildId];
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        return interaction.update({ content: `Removal request approved. Group ID ${GroupId} has been removed.`, components: [] });
    }

    if (actionType === "remove_decline") {
        delete Db.PendingApprovals[GroupId];
        await saveJsonBin(Db);
        return interaction.update({ content: `Removal request for Group ID ${GroupId} declined.`, components: [] });
    }
};
