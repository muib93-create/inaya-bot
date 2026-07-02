const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

const {
    setUserWorkMinutes,
} = require("../utils/workConfig");

const { updatePanel } = require("../utils/panelManager");
const { formatMinutes } = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("근무시간설정")
        .setDescription("본인의 하루 근무시간을 설정합니다.")
        .addIntegerOption(option =>
            option
                .setName("시간")
                .setDescription("근무 시간")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(24)
        )
        .addIntegerOption(option =>
            option
                .setName("분")
                .setDescription("추가 분")
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(59)
        ),

    async execute(interaction) {
        const hour = interaction.options.getInteger("시간");
        const minute = interaction.options.getInteger("분") ?? 0;

        const totalMinutes = hour * 60 + minute;

        setUserWorkMinutes(interaction.user.id, totalMinutes);

        updatePanel(interaction.client).catch(console.error);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("⚙️ 근무시간 설정 완료")
            .setDescription(`앞으로 하루 근무시간은 **${formatMinutes(totalMinutes)}**으로 계산됩니다.`)
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};