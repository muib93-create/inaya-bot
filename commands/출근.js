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

const {
    getUserWorkMinutes,
} = require("../utils/workConfig");

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("출근")
        .setDescription("현재 시간으로 출근을 등록합니다"),

    async execute(interaction) {
        const current = now();

        const workDate = getTodayKST(current);
        const startTime = current.toISOString();

        const username = interaction.member?.displayName ?? interaction.user.username;
        const userId = interaction.user.id;
        const targetMinutes = getUserWorkMinutes(userId);

        const existing = db.prepare(`
            SELECT * FROM work_log
            WHERE user_id = ? AND work_date = ? AND status = 'working'
        `).get(userId, workDate);

        if (existing) {
            await interaction.reply({
                content: "이미 오늘 출근 등록이 되어 있어요.",
                components: createWorkButtons(userId),
            });
            return;
        }

        db.prepare(`
            INSERT INTO work_log (
                user_id,
                username,
                work_date,
                start_time,
                status
            ) VALUES (?, ?, ?, ?, 'working')
        `).run(userId, username, workDate, startTime);

        updatePanel(interaction.client).catch(console.error);

        const end = addMinutes(current, targetMinutes);

        const start = formatTimeKST(current);
        const finish = formatTimeKST(end);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("🟢 출근 완료")
            .setDescription("오늘도 힘내서 일해봅시다.")
            .addFields(
                { name: "출근 시간", value: start, inline: true },
                { name: "퇴근 예정", value: finish, inline: true },
                { name: "목표 근무", value: formatMinutes(targetMinutes), inline: true }
            )
            .setFooter({ text: "이나야 일해라" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            components: createWorkButtons(userId),
        });
    },
};