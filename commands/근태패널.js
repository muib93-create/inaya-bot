const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require("discord.js");

const { createOrUpdatePanel } = require("../utils/panelManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("근태패널")
        .setDescription("근태 버튼 패널을 생성하거나 갱신합니다.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await createOrUpdatePanel(interaction.channel);

        await interaction.reply({
            content: "✅ 근태 패널을 생성/갱신했어요.",
            ephemeral: true,
        });
    },
};