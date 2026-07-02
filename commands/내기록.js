const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("내기록")
        .setDescription("오늘 근무 기록을 확인합니다")
        .addUserOption(option =>
            option
                .setName("대상")
                .setDescription("조회할 사람을 선택합니다")
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("대상") || interaction.user;

        const userId = targetUser.id;
        const username = targetUser.username;

        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        const record = db.prepare(`
            SELECT *
            FROM work_log
            WHERE user_id = ? AND work_date = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(userId, today);

        if (!record) {
            await interaction.reply({
                content: `📭 ${username}님의 오늘 기록이 없어요.`,
            });
            return;
        }

        const start = new Date(record.start_time);
        const startText = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;

        if (record.status === "working") {
            const expectedEnd = new Date(start);
            expectedEnd.setHours(expectedEnd.getHours() + 9);

            const diffMinutes = Math.floor((expectedEnd - now) / 1000 / 60);
            const isOvertime = diffMinutes <= 0;

            const remainHours = Math.floor(Math.abs(diffMinutes) / 60);
            const remainMinutes = Math.abs(diffMinutes) % 60;

            const expectedEndText = `${String(expectedEnd.getHours()).padStart(2, "0")}:${String(expectedEnd.getMinutes()).padStart(2, "0")}`;

            const embed = new EmbedBuilder()
                .setColor(isOvertime ? 0xFEE75C : 0x57F287)
                .setTitle(`📋 ${username}님의 근무 기록`)
                .addFields(
                    { name: "상태", value: isOvertime ? "🌙 야근중" : "🟢 근무중", inline: true },
                    { name: "출근", value: startText, inline: true },
                    { name: "퇴근 예정", value: expectedEndText, inline: true },
                    {
                        name: isOvertime ? "초과 시간" : "남은 시간",
                        value: `${remainHours}시간 ${remainMinutes}분`,
                        inline: false,
                    }
                )
                .setFooter({ text: "이나봇" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const end = new Date(record.end_time);
        const endText = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

        const hours = Math.floor(record.work_minutes / 60);
        const minutes = record.work_minutes % 60;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`📋 ${username}님의 근무 기록`)
            .addFields(
                { name: "상태", value: "🏠 퇴근완료", inline: true },
                { name: "출근", value: startText, inline: true },
                { name: "퇴근", value: endText, inline: true },
                { name: "총 근무", value: `${hours}시간 ${minutes}분`, inline: false }
            )
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};