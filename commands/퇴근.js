const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");
const workStatus = require("../workStatus");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("퇴근")
        .setDescription("오늘 근무를 종료합니다"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const now = new Date();
        const workDate = now.toISOString().slice(0, 10);

        const record = db.prepare(`
            SELECT * FROM work_log
            WHERE user_id = ? AND work_date = ? AND status = 'working'
        `).get(userId, workDate);

        if (!record) {
            await interaction.reply("오늘 출근 중인 기록이 없어요. 먼저 `/출근` 해주세요.");
            return;
        }

        const start = new Date(record.start_time);
        const end = now;
        const workMinutes = Math.floor((end - start) / 1000 / 60);

        db.prepare(`
            UPDATE work_log
            SET end_time = ?,
                work_minutes = ?,
                status = 'finished'
            WHERE id = ?
        `).run(end.toISOString(), workMinutes, record.id);

        workStatus.updateStatus(interaction.client).catch(console.error);

        const startText = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
        const endText = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

        const hours = Math.floor(workMinutes / 60);
        const minutes = workMinutes % 60;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔴 퇴근 완료")
            .setDescription("오늘도 고생하셨습니다.")
            .addFields(
                { name: "출근 시간", value: startText, inline: true },
                { name: "퇴근 시간", value: endText, inline: true },
                { name: "총 근무", value: `${hours}시간 ${minutes}분`, inline: false }
            )
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};