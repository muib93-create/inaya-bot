const { SlashCommandBuilder } = require("discord.js");
const db = require("../database");
const { updatePanel } = require("../utils/panelManager");

const {
    now,
    getTodayKST,
} = require("../utils/time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("도킹")
        .setDescription("도킹 가능 상태를 켜거나 끕니다."),

    async execute(interaction, fromButton = false) {
        const userId = interaction.user.id;
        const username = interaction.member?.displayName ?? interaction.user.username;
        const today = getTodayKST(now());

        const existing = db.prepare(`
            SELECT *
            FROM dock_status
            WHERE user_id = ?
        `).get(userId);

        if (existing) {
            db.prepare(`
                DELETE FROM dock_status
                WHERE user_id = ?
            `).run(userId);

            updatePanel(interaction.client).catch(console.error);

            if (!fromButton) {
                await interaction.reply({
                    content: "🔞 도킹 가능 상태를 해제했어요.",
                    ephemeral: true,
                });
            }

            return;
        }

        db.prepare(`
            DELETE FROM work_log
            WHERE user_id = ?
              AND work_date = ?
        `).run(userId, today);

        db.prepare(`
            INSERT INTO dock_status (
                user_id,
                username,
                started_at
            ) VALUES (?, ?, ?)
        `).run(userId, username, now().toISOString());

        updatePanel(interaction.client).catch(console.error);

        if (!fromButton) {
            await interaction.reply({
                content: "🔞 도킹 가능 상태로 변경했어요.",
                ephemeral: true,
            });
        }
    },
};