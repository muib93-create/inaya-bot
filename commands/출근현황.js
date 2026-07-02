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
        .setName("출근현황")
        .setDescription("오늘의 전체 출근 현황을 확인합니다"),

    async execute(interaction) {
        const current = now();
        const today = getTodayKST(current);

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
                const expectedEnd = addHours(start, 9);

                if (current >= expectedEnd) {
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
                const expectedEnd = addHours(start, 9);

                return `${index + 1}. **${record.username}** - ${formatTimeKST(start)} 출근 / ${formatTimeKST(expectedEnd)} 퇴근예정`;
            }).join("\n");
        }

        function makeOvertimeList(list) {
            if (list.length === 0) return "없음";

            return list.map((record, index) => {
                const start = new Date(record.start_time);
                const expectedEnd = addHours(start, 9);

                const overMinutes = Math.max(0, Math.floor((current - expectedEnd) / 1000 / 60));

                return `${index + 1}. **${record.username}** - ${formatTimeKST(start)} 출근 / 초과 ${formatMinutes(overMinutes)}`;
            }).join("\n");
        }

        function makeFinishedList(list) {
            if (list.length === 0) return "없음";

            return list.map((record, index) => {
                const start = new Date(record.start_time);
                const end = new Date(record.end_time);

                return `${index + 1}. **${record.username}** - ${formatTimeKST(start)} ~ ${formatTimeKST(end)} / ${formatMinutes(record.work_minutes)}`;
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