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
        .setDescription("내 오늘 근무 기록과 도킹 상태를 초기화합니다"),

    async execute(interaction, fromButton = false) {
        const userId = interaction.user.id;
        const today = getTodayKST(now());

        const workResult = db.prepare(`
            DELETE FROM work_log
            WHERE user_id = ? AND work_date = ?
        `).run(userId, today);

        const dockResult = db.prepare(`
            DELETE FROM dock_status
            WHERE user_id = ?
        `).run(userId);

        if (workResult.changes === 0 && dockResult.changes === 0) {
            if (!fromButton) {
                await interaction.reply({
                    content: "📭 초기화할 기록이 없어요.",
                    ephemeral: true,
                });
            }
            return;
        }

        updatePanel(interaction.client).catch(console.error);

        if (!fromButton) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🧹 초기화 완료")
                .setDescription("오늘 근무 기록과 도킹 상태를 초기화했습니다.")
                .setFooter({ text: "이나봇" })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });
        }
    },
};