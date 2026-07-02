const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

const {
    getUserWorkMinutes,
} = require("../utils/workConfig");

const {
    formatMinutes,
} = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("내설정")
        .setDescription("내 근무 설정을 확인합니다."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const workMinutes = getUserWorkMinutes(userId);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("⚙️ 내 근무 설정")
            .addFields(
                {
                    name: "하루 근무시간",
                    value: formatMinutes(workMinutes),
                    inline: true,
                }
            )
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};