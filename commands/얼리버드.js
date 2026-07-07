const { SlashCommandBuilder } = require("discord.js");
const { createOrUpdateRankingPanel } = require("../utils/rankingManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("얼리버드")
        .setDescription("오늘의 얼리버드 출근 랭킹 패널을 생성합니다."),

    async execute(interaction) {
        await createOrUpdateRankingPanel(interaction.channel);

        await interaction.reply({
            content: "👑 오늘의 얼리버드 패널을 생성했어요.",
            ephemeral: true,
        });
    },
};