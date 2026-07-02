const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");

function createProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;

    return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("퇴근까지")
        .setDescription("퇴근까지 남은 시간을 알려줍니다"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const now = new Date();
        const workDate = now.toISOString().slice(0, 10);

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
        const end = new Date(start);
        end.setHours(end.getHours() + 9);

        const totalMinutes = 9 * 60;
        const workedMinutes = Math.floor((now - start) / 1000 / 60);
        const progressPercent = Math.min(100, Math.max(0, Math.floor((workedMinutes / totalMinutes) * 100)));

        const diff = end - now;

        const startText = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
        const endText = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
        const progressBar = createProgressBar(progressPercent);

        if (diff <= 0) {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔴 퇴근 시간이 지났습니다")
                .setDescription(`진행도\n${progressBar} ${progressPercent}%\n\n이제 \`/퇴근\`을 눌러주세요.`)
                .addFields(
                    { name: "출근 시간", value: startText, inline: true },
                    { name: "퇴근 예정", value: endText, inline: true }
                )
                .setFooter({ text: "이나봇" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const hours = Math.floor(diff / 1000 / 60 / 60);
        const minutes = Math.floor((diff / 1000 / 60) % 60);

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("⏰ 퇴근까지")
            .setDescription(`진행도\n${progressBar} ${progressPercent}%`)
            .addFields(
                { name: "남은 시간", value: `${hours}시간 ${minutes}분`, inline: false },
                { name: "출근 시간", value: startText, inline: true },
                { name: "퇴근 예정", value: endText, inline: true }
            )
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};