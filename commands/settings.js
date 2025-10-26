const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getJsonBin, saveJsonBin } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Configure which role has access to all Roblox commands")
        .addRoleOption(opt =>
            opt.setName("role")
               .setDescription("The role that will have access to all commands")
               .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const role = interaction.options.getRole("role");
        const Db = await getJsonBin();

        Db.ServerConfig = Db.ServerConfig || {};
        Db.ServerConfig[interaction.guild.id] = Db.ServerConfig[interaction.guild.id] || {};

        Db.ServerConfig[interaction.guild.id].CommandRoles = {
            promote: role.id,
            demote: role.id,
            setrank: role.id,
            config: role.id
        };

        await saveJsonBin(Db);

        await interaction.reply({
            content: `All Roblox commands are now restricted to the <@&${role.id}> role.`,
            ephemeral: true
        });
    }
};
