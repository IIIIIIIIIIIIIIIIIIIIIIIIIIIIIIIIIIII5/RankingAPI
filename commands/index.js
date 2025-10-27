const fs = require("fs");
const path = require("path");
const { REST, Routes, ActivityType } = require("discord.js");

module.exports = async (client) => {
    const commands = [];
    const commandFiles = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && f !== "index.js");

    client.commands = new Map();

    for (const file of commandFiles) {
        const filePath = path.join(__dirname, file);
        const command = require(filePath);
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
  
    const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log(`Loaded ${commands.length} commands.`);

    client.updateActivity = () => {
        const servercount = client.guilds.cache.size;
        client.user.setActivity(`${servercount} servers`, { type: ActivityType.Watching });
    };
};
