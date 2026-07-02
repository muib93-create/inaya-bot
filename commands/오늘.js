const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");

const {
    now,
    getTodayKST,
    formatTimeKST,
    addHours,
    formatMinutes,
} = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("오늘")
        .setDescription("오늘 근무 현황을 확인합니다"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const current = now();
        const workDate = getTodayKST(current);

        const record = db.prepare(`
            SELECT * FROM work_log
            WHERE user_id = ? AND work_date = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, workDate);

        if (!record) {
            await interaction.reply("📅 오늘 출근 기록이 없습니다.");
            return;
        }

        const start = new Date(record.start_time);
        const startText = formatTimeKST(start);

        if (record.status === "working") {
            const end = addHours(start, 9);
            const remainMinutes = Math.max(0, Math.floor((end - current) / 1000 / 60));
            const endText = formatTimeKST(end);

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("📅 오늘 근무")
                .addFields(
                    { name: "상태", value: "🟢 근무중", inline: true },
                    { name: "출근", value: startText, inline: true },
                    { name: "퇴근 예정", value: endText, inline: true },
                    { name: "남은 시간", value: formatMinutes(remainMinutes), inline: true }
                )
                .setFooter({ text: "이나야 일해라" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const end = new Date(record.end_time);
        const endText = formatTimeKST(end);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("📅 오늘 근무")
            .addFields(
                { name: "상태", value: "🔴 퇴근완료", inline: true },
                { name: "출근", value: startText, inline: true },
                { name: "퇴근", value: endText, inline: true },
                { name: "총 근무", value: formatMinutes(record.work_minutes), inline: true }
            )
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};