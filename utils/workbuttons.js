const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const db = require("../database");
const { now, getTodayKST } = require("./time");

function getUserWorkStatus(userId) {
    const current = now();
    const today = getTodayKST(current);

    const record = db.prepare(`
        SELECT *
        FROM work_log
        WHERE user_id = ? AND work_date = ?
        ORDER BY id DESC
        LIMIT 1
    `).get(userId, today);

    if (!record) {
        return "none";
    }

    if (record.status === "working") {
        return "working";
    }

    if (record.status === "finished") {
        return "finished";
    }

    return "none";
}

function createWorkButtons(userId) {
    const status = getUserWorkStatus(userId);

    const isWorking = status === "working";
    const isFinished = status === "finished";
    const isNone = status === "none";

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_start")
            .setEmoji("🟢")
            .setLabel("출근")
            .setStyle(ButtonStyle.Success)
            .setDisabled(isWorking || isFinished),

        new ButtonBuilder()
            .setCustomId("work_end")
            .setEmoji("🔴")
            .setLabel("퇴근")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(isNone || isFinished)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_until")
            .setEmoji("⏰")
            .setLabel("퇴근까지")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isNone || isFinished),

        new ButtonBuilder()
            .setCustomId("work_status")
            .setEmoji("📊")
            .setLabel("출근현황")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false)
    );

    return [row1, row2];
}

module.exports = {
    createWorkButtons,
    getUserWorkStatus,
};