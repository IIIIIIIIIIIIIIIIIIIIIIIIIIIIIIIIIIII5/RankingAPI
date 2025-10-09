const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const apiRoutes = require("./api");

const ClientBot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const verifications = {};
const PendingApprovals = {};
const { getRobloxDescription } = require("./roblox");
const { getJsonBin, saveJsonBin, logRankChange } = require("./utils");

require("./commands")(ClientBot);

ClientBot.once("ready", () => console.log("Bot is ready!"));

ClientBot.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = ClientBot.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, verifications, PendingApprovals, logRankChange);
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "An error occurred.", ephemeral: true });
        }
    } else if (interaction.isButton()) {
        const [action, groupId] = interaction.customId.split("_");

        if (action === "done") {
            const Data = verifications[interaction.user.id];
            if (!Data) return interaction.reply({ content: "You haven't started verification yet.", ephemeral: true });
            const Description = await getRobloxDescription(Data.RobloxUserId);
            if (Description.includes(Data.Code)) {
                const Db = await getJsonBin();
                Db.VerifiedUsers = Db.VerifiedUsers || {};
                Db.VerifiedUsers[interaction.user.id] = Data.RobloxUserId;
                await saveJsonBin(Db);
                delete verifications[interaction.user.id];
                interaction.reply({ content: `Verified! Linked to Roblox ID ${Data.RobloxUserId}`, ephemeral: true });
            } else interaction.reply({ content: "Code not found in your profile. Make sure you added it and try again.", ephemeral: true });
        }
    }
});

const app = express();
app.use(bodyParser.json());
app.use("/api", apiRoutes);
app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`));

ClientBot.login(process.env.BOT_TOKEN);
