const { getJsonBin } = require("../utils");

async function checkCommandRole(interaction, commandName) {
    const Db = await getJsonBin();
    const guildConfig = Db.ServerConfig?.[interaction.guild.id];
    if (!guildConfig || !guildConfig.CommandRoles?.[commandName]) return true;

    const roleId = guildConfig.CommandRoles[commandName];
    return interaction.member.roles.cache.has(roleId);
}

module.exports = { checkCommandRole };
