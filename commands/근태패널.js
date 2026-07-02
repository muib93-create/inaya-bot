const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("근태패널")
        .setDescription("근태 버튼 패널을 생성합니다.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📋 근태관리")
            .setDescription("아래 버튼으로 근태를 관리하세요.")
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("work_start")
                .setEmoji("🟢")
                .setLabel("출근")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("work_end")
                .setEmoji("🔴")
                .setLabel("퇴근")
                .setStyle(ButtonStyle.Danger),
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("work_until")
                .setEmoji("⏰")
                .setLabel("퇴근까지")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("work_status")
                .setEmoji("📊")
                .setLabel("출근현황")
                .setStyle(ButtonStyle.Secondary),
        );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
        });
    },
};