const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("View all commands in the bot"),

    async execute(interaction) {
        const client = interaction.client;

        const allCommands = [...client.commands.values()].map(cmd => ({
            name: `/${cmd.data.name}`,
            description: cmd.data.description || "No description"
        }));

        const perPage = 5;
        const pages = [];
        for (let i = 0; i < allCommands.length; i += perPage) {
            pages.push(allCommands.slice(i, i + perPage));
        }

        let page = 0;

        const generateEmbed = (pageIndex) => {
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("Commands")
                .setFooter({ text: `Page ${pageIndex + 1} / ${pages.length}` });

            pages[pageIndex].forEach(cmd => {
                embed.addFields({
                    name: cmd.name,
                    value: cmd.description,
                    inline: false
                });
            });

            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("prev_help")
                .setLabel("<")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("next_help")
                .setLabel(">")
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            embeds: [generateEmbed(page)],
            components: pages.length > 1 ? [row] : []
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            time: 120000
        });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "You do NOT control this menu!.", ephemeral: true });
            }

            if (i.customId === "prev_help") {
                page = page > 0 ? page - 1 : pages.length - 1;
            } else if (i.customId === "next_help") {
                page = page < pages.length - 1 ? page + 1 : 0;
            }

            await i.update({
                embeds: [generateEmbed(page)],
                components: [row]
            });
        });

        collector.on("end", () => {
            message.edit({ components: [] }).catch(() => {});
        });
    }
};
