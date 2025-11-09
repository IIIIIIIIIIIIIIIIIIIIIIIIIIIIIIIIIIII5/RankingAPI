const { getJsonBin, saveJsonBin } = require("../utils");
const { leaveGroup, fetchRoles } = require("../roblox");
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

async function sendDebug(client, message) {
    const channel = await client.channels.fetch("1437041869300437103").catch(() => null);
    if (channel) channel.send(`${message}`).catch(() => {});
}

module.exports = async function handleButton(interaction, client) {
    try {
        if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

        const Db = await getJsonBin();
        Db.ServerConfig = Db.ServerConfig || {};
        Db.PendingApprovals = Db.PendingApprovals || {};
        Db.XP = Db.XP || {};

        const guildId = interaction.guild?.id;
        const customId = interaction.customId;

        await sendDebug(client, `Interaction received: ${customId}`);

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
            if (!pending) {
                await interaction.reply({ content: "No pending request found.", ephemeral: true });
                return sendDebug(client, `No pending request for group ${GroupId}`);
            }

            const requester = await client.users.fetch(pending.requesterId).catch(() => null);
            const guildIdPending = pending.guildId;

            if (actionType === "accept") {
                Db.ServerConfig[guildIdPending] = { GroupId: Number(GroupId) };
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been approved.`).catch(() => {});
                await interaction.update({ content: `Configuration approved. Group ID ${GroupId} is now set.`, components: [] });
                return sendDebug(client, `Group ${GroupId} approved`);
            }

            if (actionType === "decline") {
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group configuration for ID ${GroupId} has been declined.`).catch(() => {});
                await interaction.update({ content: `Configuration request for Group ID ${GroupId} declined.`, components: [] });
                return sendDebug(client, `Group ${GroupId} declined`);
            }

            if (actionType === "remove_accept") {
                delete Db.ServerConfig[guildIdPending];
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                await leaveGroup(GroupId).catch(() => {});
                if (requester) requester.send(`Your group removal request has been approved.`).catch(() => {});
                await interaction.update({ content: `Removal request approved. Group ID ${GroupId} has been removed.`, components: [] });
                return sendDebug(client, `Group ${GroupId} removal approved`);
            }

            if (actionType === "remove_decline") {
                delete Db.PendingApprovals[GroupId];
                await saveJsonBin(Db);
                if (requester) requester.send(`Your group removal request has been declined.`).catch(() => {});
                await interaction.update({ content: `Removal request for Group ID ${GroupId} declined.`, components: [] });
                return sendDebug(client, `Group ${GroupId} removal declined`);
            }
        }

        if (customId === "xp_yes") {
            const GroupId = Db.ServerConfig?.[guildId]?.GroupId;
            if (!GroupId) return interaction.update({ content: "Group ID not configured.", components: [] });

            let roles;
            try {
                roles = await fetchRoles(GroupId);
            } catch (err) {
                await interaction.update({ content: `Failed to fetch roles. ${err.message}`, components: [] });
                return sendDebug(client, `Failed to fetch roles for group ${GroupId}: ${err.message}`);
            }

            roles = roles.filter(r => r.name.toLowerCase() !== "guest");
            if (!roles.length) return interaction.update({ content: "No roles found for this group.", components: [] });

            Db.XP[guildId] = {
                _setupIndex: 0,
                _setupRoles: roles,
                Ranks: {}
            };
            await saveJsonBin(Db);

            const firstRole = roles[0];
            await interaction.update({
                content: `Rank: **${firstRole.name}**`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`editxp_${firstRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`skipxp_${firstRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
            return sendDebug(client, `Started XP setup with role ${firstRole.name}`);
        }

        if (customId === "xp_no") {
            await interaction.update({ content: "XP setup cancelled.", components: [] });
            return sendDebug(client, "XP setup cancelled");
        }

        if (customId.startsWith("editxp_") || customId.startsWith("skipxp_")) {
            const xpData = Db.XP[guildId];
            if (!xpData || !xpData._setupRoles || !Array.isArray(xpData._setupRoles) || xpData._setupRoles.length === 0) {
                await interaction.reply({ content: "XP setup data missing. Please restart the setup.", ephemeral: true });
                return sendDebug(client, "XP setup data missing on edit/skip");
            }

            const roleId = customId.split("_")[1];
            const role = xpData._setupRoles.find(r => r.id.toString() === roleId);
            if (!role) return interaction.reply({ content: "Role not found. Please restart the XP setup.", ephemeral: true });

            if (customId.startsWith("editxp_")) {
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
                xpData._setupIndex = (xpData._setupIndex || 0) + 1;
                await saveJsonBin(Db);

                if (xpData._setupIndex >= xpData._setupRoles.length) {
                    delete xpData._setupIndex;
                    delete xpData._setupRoles;
                    await saveJsonBin(Db);
                    await interaction.update({ content: "XP system fully configured!", components: [] });
                    return sendDebug(client, "XP setup fully configured");
                }

                const nextRole = xpData._setupRoles[xpData._setupIndex];
                await interaction.update({
                    content: `Rank: **${nextRole.name}**`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`editxp_${nextRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`skipxp_${nextRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });
                return sendDebug(client, `Skipping to role ${nextRole.name}`);
            }
        }

        if (interaction.isModalSubmit() && customId.startsWith("xpmodal_")) {
            const roleId = customId.split("_")[1];
            const xpValueRaw = interaction.fields.getTextInputValue("xp_value");
            const xpValue = parseInt(xpValueRaw);

            if (isNaN(xpValue)) {
                await interaction.reply({ content: "Invalid XP value. Enter a number.", ephemeral: true });
                return sendDebug(client, "Invalid XP value entered");
            }

            const xpData = Db.XP[guildId];
            if (!xpData || !xpData.Ranks || !xpData._setupRoles) {
                await interaction.reply({ content: "XP setup data missing. Please restart the setup.", ephemeral: true });
                return sendDebug(client, "XP setup data missing on modal submit");
            }

            const role = xpData._setupRoles.find(r => r.id.toString() === roleId);
            if (!role) {
                await interaction.reply({ content: "Role not found. Restart the setup.", ephemeral: true });
                return sendDebug(client, "Role not found on modal submit");
            }

            xpData.Ranks[roleId] = xpValue;
            xpData._setupIndex = (xpData._setupIndex || 0) + 1;
            await saveJsonBin(Db);

            if (xpData._setupIndex >= xpData._setupRoles.length) {
                delete xpData._setupIndex;
                delete xpData._setupRoles;
                await saveJsonBin(Db);
                await interaction.reply({ content: "XP system fully configured!", ephemeral: true });
                return sendDebug(client, "XP setup fully configured on modal submit");
            }

            const nextRole = xpData._setupRoles[xpData._setupIndex];
            await interaction.reply({
                content: `Rank: **${nextRole.name}**`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`editxp_${nextRole.id}`).setLabel("Edit XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`skipxp_${nextRole.id}`).setLabel("Skip").setStyle(ButtonStyle.Secondary)
                    )
                ],
                ephemeral: true
            });
            return sendDebug(client, `Next role setup: ${nextRole.name}`);
        }

        if (interaction.isStringSelectMenu() && customId === "remove_xp_roles") {
            const selected = interaction.values;
            if (!Db.XP[guildId]) return interaction.update({ content: "No XP roles configured.", components: [] });

            for (const r of selected) {
                if (Db.XP[guildId].PermissionRole === r) delete Db.XP[guildId].PermissionRole;
            }

            await saveJsonBin(Db);
            await interaction.update({ content: "Removed XP role permissions.", components: [] });
            return sendDebug(client, `Removed XP role permissions: ${selected.join(", ")}`);
        }
    } catch (err) {
        const channel = await client.channels.fetch("1437041869300437103").catch(() => null);
        if (channel) channel.send(`[ERROR] ${err.stack}`).catch(() => {});
        console.error(err);
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
        }
    }
};
