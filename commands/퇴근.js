const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");
const { createWorkButtons } = require("../utils/workButtons");
const { updatePanel } = require("../utils/panelManager");

const {
    now,
    getTodayKST,
    formatTimeKST,
    formatMinutes,
} = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("퇴근")
        .setDescription("오늘 근무를 종료합니다"),

    async execute(interaction, fromButton = false) {
        const userId = interaction.user.id;
        const current = now();
        const workDate = getTodayKST(current);

        const record = db.prepare(`
            SELECT * FROM work_log
            WHERE user_id = ? AND work_date = ? AND status = 'working'
        `).get(userId, workDate);

        if (!record) {
            if (!fromButton) {
                await interaction.reply({
                    content: "오늘 출근 중인 기록이 없어요. 먼저 `/출근` 해주세요.",
                    components: createWorkButtons(userId),
                    ephemeral: true,
                });
            }
            return;
        }

        const start = new Date(record.start_time);
        const end = current;
        const workMinutes = Math.floor((end - start) / 1000 / 60);

        db.prepare(`
            UPDATE work_log
            SET end_time = ?,
                work_minutes = ?,
                status = 'finished'
            WHERE id = ?
        `).run(end.toISOString(), workMinutes, record.id);

        updatePanel(interaction.client).catch(console.error);

        if (fromButton) {
            return;
        }

        const startText = formatTimeKST(start);
        const endText = formatTimeKST(end);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔴 퇴근 완료")
            .setDescription("오늘도 고생하셨습니다.")
            .addFields(
                { name: "출근 시간", value: startText, inline: true },
                { name: "퇴근 시간", value: endText, inline: true },
                { name: "총 근무", value: formatMinutes(workMinutes), inline: false }
            )
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            components: createWorkButtons(userId),
        });
    },
};