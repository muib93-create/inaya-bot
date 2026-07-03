const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");
const { updatePanel } = require("../utils/panelManager");

const {
    now,
    getTodayKST,
} = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("초기화")
        .setDescription("내 오늘 근무 기록을 초기화합니다"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const today = getTodayKST(now());

        const result = db.prepare(`
            DELETE FROM work_log
            WHERE user_id = ? AND work_date = ?
        `).run(userId, today);

        if (result.changes === 0) {
            await interaction.reply({
                content: "📭 오늘 초기화할 기록이 없어요.",
                ephemeral: true,
            });
            return;
        }

        updatePanel(interaction.client).catch(console.error);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🧹 초기화 완료")
            .setDescription("오늘 내 근무 기록을 삭제했습니다.")
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};