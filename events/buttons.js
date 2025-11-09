const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");
const {  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = async function handleButton(interaction, client) {
    console.log("Interaction received:", interaction?.customId);

    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
        console.log("Invalid interaction type:", interaction.type);
        return;
    }

    let Db;
    try {
        Db = await getJsonBin();
        console.log("Database loaded.");
    } catch (err) {
        console.error("Failed to load database:", err);
        try {
            return interaction.reply({ content: "Something went wrong loading data.", ephemeral: true });
        } catch (e) {
            console.error("Failed to reply after DB load error:", e);
            return;
        }
    }

    Db.ServerConfig = Db.ServerConfig || {};
    Db.PendingApprovals = Db.PendingApprovals || {};
    Db.XP = Db.XP || {};

    const guildId = interaction.guild?.id;
    const customId = interaction.customId;

    console.log("Guild ID:", guildId, "Custom ID:", customId);

    let match, actionType, GroupId;
    if ((match = customId.match(/^(accept|decline)_(\d+)$/))) {
        actionType = match[1];
        GroupId = match[2];
    } else if ((match = customId.match(/^remove_(accept|decline)_(\d+)$/))) {
        actionType = match[1] === "accept" ? "remove_accept" : "remove_decline";
        GroupId = match[2];
    }

    if (actionType && GroupId) {
        console.log("Approval action detected:", actionType, "GroupId:", GroupId);
        const pending = Db.PendingApprovals[GroupId];
        if (!pending) {
            console.log("No pending approval found for GroupId:", GroupId);
            try {
                return interaction.reply({ content: "No pending request found.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply when no pending approval:", e);
                return;
            }
        }

        let requester = null;
        try {
            requester = await client.users.fetch(pending.requesterId);
            console.log("Requester fetched:", requester?.tag || pending.requesterId);
        } catch (err) {
            console.error("Failed to fetch requester:", err);
        }

        const guildIdPending = pending.guildId;
        try {
            if (actionType === "accept") {
                console.log("Processing accept for GroupId:", GroupId, "Guild:", guildIdPending);
                Db.ServerConfig[guildIdPending] = { GroupId: Number(GroupId) };
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
                return interaction.update({ content: `Configuration approved. Group ID ${GroupId} is now set.`, components: [] });
            }

            if (actionType === "decline") {
                console.log("Processing decline for GroupId:", GroupId);
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
                return interaction.update({ content: `Configuration request for Group ID ${GroupId} declined.`, components: [] });
            }

            if (actionType === "remove_accept") {
                console.log("Processing removal accept for GroupId:", GroupId, "Guild:", guildIdPending);
                delete Db.ServerConfig[guildIdPending];
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                await leaveGroup(GroupId).catch(err => console.error("Leave group failed:", err));
                if (requester) requester.send(`Your group removal request has been approved.`).catch(() => {});
                return interaction.update({ content: `Removal request approved. Group ID ${GroupId} has been removed.`, components: [] });
            }

            if (actionType === "remove_decline") {
                console.log("Processing removal decline for GroupId:", GroupId);
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group removal request has been declined.`).catch(() => {});
                return interaction.update({ content: `Removal request for Group ID ${GroupId} declined.`, components: [] });
            }
        } catch (err) {
            console.error("Error handling approval action:", err);
            try {
                return interaction.reply({ content: "Something went wrong processing the request.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply after approval action error:", e);
                return;
            }
        }
        return;
    }
    
    if (customId === "xp_yes") {
        console.log("XP setup initiated by user.");
        const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
        if (!GroupId) {
            console.log("Group ID not configured for guild:", guildId);
            try {
                return interaction.update({ content: "Group ID not configured.", components: [] });
            } catch (e) {
                console.error("Failed to update interaction for missing GroupId:", e);
                return;
            }
        }

        let roles;
        try {
            roles = await fetchRoles(GroupId);
            console.log("Roles fetched from Roblox for GroupId:", GroupId, "Count:", roles?.length || 0);
        } catch (err) {
            console.error("Failed to fetch roles:", err);
            try {
                return interaction.update({ content: `Failed to fetch roles. ${err.message}`, components: [] });
            } catch (e) {
                console.error("Failed to update interaction after fetchRoles error:", e);
                return;
            }
        }

        if (!Array.isArray(roles) || roles.length === 0) {
            console.log("No roles returned from fetchRoles for GroupId:", GroupId);
            try {
                return interaction.update({ content: "No roles found for that group.", components: [] });
            } catch (e) {
                console.error("Failed to update interaction for no roles:", e);
                return;
            }
        }

        roles = roles.filter(r => r && r.name && r.name.toLowerCase() !== "guest");
        console.log("Filtered roles count (excluding guest):", roles.length);

        Db.XP[guildId] = Db.XP[guildId] || {};
        Db.XP[guildId]._setupIndex = 0;
        Db.XP[guildId]._setupRoles = roles;
        Db.XP[guildId].Ranks = Db.XP[guildId].Ranks || {};
        await saveJsonBin(Db);
        console.log("XP setup state saved to DB for guild:", guildId);

        const role = roles[0];
        console.log("Starting XP setup with first role:", role.name, "ID:", role.id);
        try {
            return interaction.update({
                content: `Rank: **${role.name}**`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`editxp_${role.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`skipxp_${role.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        } catch (e) {
            console.error("Failed to update interaction to start XP setup:", e);
            return;
        }
    }

    if (customId === "xp_no") {
        console.log("User cancelled XP setup.");
        try {
            return interaction.update({ content: "XP setup cancelled.", components: [] });
        } catch (e) {
            console.error("Failed to update interaction for xp_no:", e);
            return;
        }
    }

    if (customId.startsWith("editxp_")) {
        const roleId = customId.split("_")[1];
        console.log("Edit XP clicked for roleId:", roleId);

        const xpData = Db.XP[guildId];
        if (!xpData || !xpData._setupRoles) {
            console.log("XP setup data missing when trying to edit role:", roleId);
            try {
                return interaction.reply({ content: "XP setup data missing. Please restart the setup.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply when XP data missing on edit:", e);
                return;
            }
        }

        const role = xpData._setupRoles.find(r => r.id == roleId);
        if (!role) {
            console.log("Role not found in setupRoles for roleId:", roleId);
            try {
                return interaction.reply({ content: "Role not found in setup list.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply when role not found:", e);
                return;
            }
        }

        console.log("Showing modal for role:", role.name);
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

        try {
            return interaction.showModal(modal);
        } catch (e) {
            console.error("Failed to show modal:", e);
            try {
                return interaction.reply({ content: "Failed to open modal.", ephemeral: true });
            } catch (er) {
                console.error("Failed to reply after modal show failure:", er);
                return;
            }
        }
    }

    if (customId.startsWith("skipxp_")) {
        const xpData = Db.XP[guildId];
        if (!xpData || typeof xpData._setupIndex !== "number" || !Array.isArray(xpData._setupRoles)) {
            console.log("XP setup state invalid when skipping.");
            try {
                return interaction.reply({ content: "XP setup state invalid. Please restart the setup.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply when XP state invalid on skip:", e);
                return;
            }
        }

        xpData._setupIndex += 1;
        await saveJsonBin(Db);
        console.log("Skipped role. New index:", xpData._setupIndex);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            console.log("XP setup completed after skipping last role.");
            try {
                return interaction.update({ content: "XP system fully configured!", components: [] });
            } catch (e) {
                console.error("Failed to update interaction after finishing XP setup on skip:", e);
                return;
            }
        }

        const next = xpData._setupRoles[xpData._setupIndex];
        console.log("Proceeding to next role after skip:", next.name);
        try {
            return interaction.update({
                content: `Rank: **${next.name}**`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`editxp_${next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`skipxp_${next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        } catch (e) {
            console.error("Failed to update interaction for next role after skip:", e);
            return;
        }
    }

    if (interaction.isModalSubmit() && customId.startsWith("xpmodal_")) {
        console.log("Modal submission detected for customId:", customId);
        const roleId = customId.split("_")[1];
        let xpValueRaw;
        try {
            xpValueRaw = interaction.fields.getTextInputValue("xp_value");
            console.log("Modal field xp_value:", xpValueRaw);
        } catch (err) {
            console.error("Failed to get modal field xp_value:", err);
            try {
                return interaction.reply({ content: "Something went wrong reading your input.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply after modal field read error:", e);
                return;
            }
        }

        const xpValue = parseInt(xpValueRaw);
        const xpData = Db.XP[guildId];

        if (!xpData || !xpData._setupRoles || !xpData.Ranks) {
            console.log("XP setup data missing at modal submit.");
            try {
                return interaction.reply({ content: "XP setup data missing. Please restart the setup.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply when XP data missing at modal submit:", e);
                return;
            }
        }

        if (isNaN(xpValue)) {
            console.log("Invalid XP value entered:", xpValueRaw);
            try {
                return interaction.reply({ content: "Invalid XP value. Please enter a number.", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply for invalid XP value:", e);
                return;
            }
        }

        xpData.Ranks[roleId] = xpValue;
        xpData._setupIndex += 1;
        await saveJsonBin(Db);
        console.log("Saved XP value for roleId:", roleId, "Value:", xpValue);

        if (xpData._setupIndex >= xpData._setupRoles.length) {
            delete xpData._setupIndex;
            delete xpData._setupRoles;
            await saveJsonBin(Db);
            console.log("XP setup completed after modal submissions.");
            try {
                return interaction.reply({ content: "XP system fully configured!", ephemeral: true });
            } catch (e) {
                console.error("Failed to reply after finishing XP setup:", e);
                return;
            }
        }

        const next = xpData._setupRoles[xpData._setupIndex];
        console.log("Next role after modal submit:", next.name);
        try {
            return interaction.reply({
                content: `Rank: **${next.name}**`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`editxp_${next.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`skipxp_${next.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                    )
                ],
                ephemeral: true
            });
        } catch (e) {
            console.error("Failed to reply with next role after modal submit:", e);
            return;
        }
    }

    if (interaction.isStringSelectMenu() && customId === "remove_xp_roles") {
        console.log("remove_xp_roles select menu used. Values:", interaction.values);
        const selected = interaction.values;
        if (!Db.XP[guildId]) {
            console.log("No XP config found for guild when removing roles:", guildId);
            try {
                return interaction.update({ content: "No XP roles configured.", components: [] });
            } catch (e) {
                console.error("Failed to update interaction when no XP config:", e);
                return;
            }
        }

        for (const r of selected) {
            if (Db.XP[guildId].PermissionRole === r) {
                console.log("Removing permission role:", r);
                delete Db.XP[guildId].PermissionRole;
            }
            if (Db.XP[guildId].SomeOtherRoleField === r) {
                console.log("Removing SomeOtherRoleField:", r);
                delete Db.XP[guildId].SomeOtherRoleField;
            }
        }

        await saveJsonBin(Db);
        console.log("XP role permissions updated for guild:", guildId);
        try {
            return interaction.update({ content: "Removed XP role permissions.", components: [] });
        } catch (e) {
            console.error("Failed to update interaction after removing XP roles:", e);
            return;
        }
    }

    console.log("No matching handler for interaction:", customId);
    try {
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            return interaction.reply({ content: "No handler for that action.", ephemeral: true });
        }
    } catch (e) {
        console.error("Failed to send fallback reply:", e);
    }
};
