const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");

const {
    now,
    getTodayKST,
    formatTimeKST,
    formatMinutes,
} = require("../utils/time");

const {
    getUserWorkMinutes,
} = require("../utils/workConfig");

function createProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;

    return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("퇴근까지")
        .setDescription("퇴근까지 남은 시간을 알려줍니다"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const current = now();
        const workDate = getTodayKST(current);

        const record = db.prepare(`
            SELECT *
            FROM work_log
            WHERE user_id = ? AND work_date = ? AND status = 'working'
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, workDate);

        if (!record) {
            await interaction.reply("오늘 출근 기록이 없어요. 먼저 `/출근` 해주세요.");
            return;
        }

        const start = new Date(record.start_time);
        const totalMinutes = getUserWorkMinutes(userId);
        const end = addMinutes(start, totalMinutes);

        const workedMinutes = Math.floor((current - start) / 1000 / 60);
        const progressPercent = Math.min(
            100,
            Math.max(0, Math.floor((workedMinutes / totalMinutes) * 100))
        );

        const remainMinutes = Math.floor((end - current) / 1000 / 60);

        const startText = formatTimeKST(start);
        const endText = formatTimeKST(end);
        const progressBar = createProgressBar(progressPercent);

        if (remainMinutes <= 0) {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔴 퇴근 시간이 지났습니다")
                .setDescription(`진행도\n${progressBar} ${progressPercent}%\n\n이제 \`/퇴근\`을 눌러주세요.`)
                .addFields(
                    { name: "출근 시간", value: startText, inline: true },
                    { name: "퇴근 예정", value: endText, inline: true },
                    { name: "목표 근무", value: formatMinutes(totalMinutes), inline: true }
                )
                .setFooter({ text: "이나봇" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("⏰ 퇴근까지")
            .setDescription(`진행도\n${progressBar} ${progressPercent}%`)
            .addFields(
                { name: "남은 시간", value: formatMinutes(remainMinutes), inline: false },
                { name: "출근 시간", value: startText, inline: true },
                { name: "퇴근 예정", value: endText, inline: true },
                { name: "목표 근무", value: formatMinutes(totalMinutes), inline: true }
            )
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};