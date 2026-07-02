const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database");

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
        return `${minutes}분`;
    }

    return `${hours}시간 ${minutes}분`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("출근현황")
        .setDescription("오늘의 전체 출근 현황을 확인합니다"),

    async execute(interaction) {
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date();

        const records = db.prepare(`
            SELECT *
            FROM work_log
            WHERE work_date = ?
            ORDER BY id DESC
        `).all(today);

        const latestByUser = new Map();

        for (const record of records) {
            if (!latestByUser.has(record.user_id)) {
                latestByUser.set(record.user_id, record);
            }
        }

        const working = [];
        const overtime = [];
        const finished = [];

        for (const record of latestByUser.values()) {
            if (record.status === "finished") {
                finished.push(record);
                continue;
            }

            if (record.status === "working") {
                const start = new Date(record.start_time);
                const expectedEnd = new Date(start);
                expectedEnd.setHours(expectedEnd.getHours() + 9);

                if (now >= expectedEnd) {
                    overtime.push(record);
                } else {
                    working.push(record);
                }
            }
        }

        function makeWorkingList(list) {
            if (list.length === 0) return "없음";

            return list.map((record, index) => {
                const start = new Date(record.start_time);
                const expectedEnd = new Date(start);
                expectedEnd.setHours(expectedEnd.getHours() + 9);

                return `${index + 1}. **${record.username}** - ${formatTime(start)} 출근 / ${formatTime(expectedEnd)} 퇴근예정`;
            }).join("\n");
        }

        function makeOvertimeList(list) {
            if (list.length === 0) return "없음";

            return list.map((record, index) => {
                const start = new Date(record.start_time);
                const expectedEnd = new Date(start);
                expectedEnd.setHours(expectedEnd.getHours() + 9);

                const overMinutes = Math.floor((now - expectedEnd) / 1000 / 60);

                return `${index + 1}. **${record.username}** - ${formatTime(start)} 출근 / 초과 ${formatMinutes(overMinutes)}`;
            }).join("\n");
        }

        function makeFinishedList(list) {
            if (list.length === 0) return "없음";

            return list.map((record, index) => {
                const start = new Date(record.start_time);
                const end = new Date(record.end_time);

                return `${index + 1}. **${record.username}** - ${formatTime(start)} ~ ${formatTime(end)} / ${formatMinutes(record.work_minutes)}`;
            }).join("\n");
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📊 오늘의 출근 현황")
            .addFields(
                {
                    name: `🟢 출근중 ${working.length}명`,
                    value: makeWorkingList(working),
                    inline: false,
                },
                {
                    name: `🌙 야근중 ${overtime.length}명`,
                    value: makeOvertimeList(overtime),
                    inline: false,
                },
                {
                    name: `🏠 퇴근완료 ${finished.length}명`,
                    value: makeFinishedList(finished),
                    inline: false,
                }
            )
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};