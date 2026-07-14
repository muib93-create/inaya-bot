const { EmbedBuilder } = require("discord.js");
const db = require("../database");

const {
    now,
    getTodayKST,
    formatTimeKST,
    formatMinutes,
} = require("./time");

const LINE = "━━━━━━━━━━━━━━━━━━━━";
const MAX_DAILY_WORK_MINUTES = 24 * 60;

function getSetting(key) {
    const row = db.prepare(`
        SELECT value
        FROM bot_settings
        WHERE key = ?
    `).get(key);

    return row ? row.value : null;
}

function setSetting(key, value) {
    db.prepare(`
        INSERT INTO bot_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
}

function getAllWorkRecords() {
    return db.prepare(`
        SELECT *
        FROM work_log
        WHERE start_time IS NOT NULL
        ORDER BY start_time ASC
    `).all();
}

function getRecordDateKST(record) {
    if (record.work_date) {
        return record.work_date;
    }

    return getTodayKST(new Date(record.start_time));
}

function isTodayRecord(record, today) {
    const recordDate = getRecordDateKST(record);
    const startDateKST = getTodayKST(new Date(record.start_time));

    return recordDate === today || startDateKST === today;
}

function getSafeFinishedMinutes(record) {
    const savedMinutes = Number(record.work_minutes || 0);

    if (
        !Number.isFinite(savedMinutes) ||
        savedMinutes <= 0 ||
        savedMinutes > MAX_DAILY_WORK_MINUTES
    ) {
        return 0;
    }

    return savedMinutes;
}

function getSafeWorkingMinutes(record, current) {
    const start = new Date(record.start_time);

    if (Number.isNaN(start.getTime())) {
        return 0;
    }

    const elapsedMinutes = Math.floor((current - start) / 1000 / 60);

    return Math.max(
        0,
        Math.min(elapsedMinutes, MAX_DAILY_WORK_MINUTES)
    );
}

function getTodayStartRecords() {
    const today = getTodayKST(now());

    const records = getAllWorkRecords()
        .filter(record => isTodayRecord(record, today));

    const firstByUser = new Map();

    for (const record of records) {
        if (!firstByUser.has(record.user_id)) {
            firstByUser.set(record.user_id, record);
        }
    }

    return Array.from(firstByUser.values())
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function getTodayTotalWorkMinutes() {
    const current = now();
    const today = getTodayKST(current);

    const records = getAllWorkRecords()
        .filter(record => isTodayRecord(record, today));

    let totalMinutes = 0;

    for (const record of records) {
        if (record.status === "finished") {
            totalMinutes += getSafeFinishedMinutes(record);
            continue;
        }

        if (record.status === "working") {
            totalMinutes += getSafeWorkingMinutes(record, current);
        }
    }

    return totalMinutes;
}

function getThisMonthStats() {
    const current = now();
    const today = getTodayKST(current);
    const monthPrefix = today.slice(0, 7);

    const records = getAllWorkRecords().filter(record => {
        const recordDate = getRecordDateKST(record);
        const startDateKST = getTodayKST(new Date(record.start_time));

        return (
            recordDate.startsWith(monthPrefix) ||
            startDateKST.startsWith(monthPrefix)
        );
    });

    const statsByUser = new Map();

    for (const record of records) {
        const workDate = getRecordDateKST(record);

        let validMinutes = 0;

        if (record.status === "finished") {
            validMinutes = getSafeFinishedMinutes(record);
        } else if (
            record.status === "working" &&
            workDate === today
        ) {
            validMinutes = getSafeWorkingMinutes(record, current);
        }

        // 비정상 기록이나 과거 미퇴근 기록은 통계에서 제외
        if (validMinutes <= 0) {
            continue;
        }

        if (!statsByUser.has(record.user_id)) {
            statsByUser.set(record.user_id, {
                userId: record.user_id,
                username: record.username,
                days: new Set(),
                totalMinutes: 0,
            });
        }

        const stat = statsByUser.get(record.user_id);

        stat.username = record.username;
        stat.days.add(workDate);
        stat.totalMinutes += validMinutes;
    }

    return Array.from(statsByUser.values())
        .map(stat => ({
            userId: stat.userId,
            username: stat.username,
            workDays: stat.days.size,
            totalMinutes: stat.totalMinutes,
        }))
        .sort((a, b) => {
            if (b.totalMinutes !== a.totalMinutes) {
                return b.totalMinutes - a.totalMinutes;
            }

            return b.workDays - a.workDays;
        })
        .slice(0, 5);
}

function getMedal(index) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";

    return `${index + 1}위`;
}

function createRankLine(record, index, firstStart) {
    const start = new Date(record.start_time);
    const startText = formatTimeKST(start);

    if (index === 0) {
        return `${getMedal(index)} **${record.username}**　${startText}`;
    }

    const diffMinutes = Math.max(
        0,
        Math.floor((start - firstStart) / 1000 / 60)
    );

    return `${getMedal(index)} **${record.username}**　${startText} (+${formatMinutes(diffMinutes)})`;
}

function createMonthlyStatsText() {
    const stats = getThisMonthStats();

    if (stats.length === 0) {
        return "아직 이번 달 정상 근무 기록이 없어요.";
    }

    return stats
        .map((stat, index) => {
            return [
                `${getMedal(index)} **${stat.username}**`,
                `└ 출근 ${stat.workDays}일 · 총 ${formatMinutes(stat.totalMinutes)}`,
            ].join("\n");
        })
        .join("\n\n");
}

function createRankingEmbed() {
    const records = getTodayStartRecords();
    const updatedAt = formatTimeKST(now());

    const totalWorkMinutes = getTodayTotalWorkMinutes();
    const totalWorkText = formatMinutes(totalWorkMinutes);
    const monthlyStatsText = createMonthlyStatsText();

    if (records.length === 0) {
        return new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("👑 오늘의 얼리버드")
            .setDescription(
                [
                    "아직 오늘 출근한 사람이 없어요.",
                    "",
                    LINE,
                    "",
                    "첫 출근자가 오늘의 얼리버드가 됩니다.",
                    "",
                    LINE,
                    "",
                    "📅 **이번 달 근무 통계**",
                    "",
                    monthlyStatsText,
                ].join("\n")
            )
            .setFooter({
                text: `👥 오늘 출근 0명 · ⏱️ 오늘 누적근무 ${totalWorkText} · 마지막 갱신 ${updatedAt}`,
            })
            .setTimestamp();
    }

    const earlyBird = records[0];
    const firstStart = new Date(earlyBird.start_time);

    const rankingLines = records
        .slice(0, 10)
        .map((record, index) => {
            return createRankLine(record, index, firstStart);
        })
        .join("\n");

    return new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("👑 오늘의 얼리버드")
        .setDescription(
            [
                `🥇 **${earlyBird.username}**`,
                `🕗 ${formatTimeKST(firstStart)} 출근`,
                "",
                LINE,
                "",
                "🏆 **출근 랭킹**",
                "",
                rankingLines,
                "",
                LINE,
                "",
                "📅 **이번 달 근무 통계**",
                "",
                monthlyStatsText,
                "",
                LINE,
            ].join("\n")
        )
        .setFooter({
            text: `👥 오늘 출근 ${records.length}명 · ⏱️ 오늘 누적근무 ${totalWorkText} · 마지막 갱신 ${updatedAt}`,
        })
        .setTimestamp();
}

async function createOrUpdateRankingPanel(channel) {
    const savedChannelId = getSetting("ranking_panel_channel_id");
    const savedMessageId = getSetting("ranking_panel_message_id");

    const payload = {
        embeds: [createRankingEmbed()],
    };

    if (savedChannelId && savedMessageId) {
        try {
            const savedChannel =
                await channel.client.channels.fetch(savedChannelId);

            const savedMessage =
                await savedChannel.messages.fetch(savedMessageId);

            await savedMessage.edit(payload);
            return savedMessage;
        } catch {
            console.log("기존 랭킹 패널을 찾지 못해 새로 생성합니다.");
        }
    }

    const message = await channel.send(payload);

    setSetting("ranking_panel_channel_id", channel.id);
    setSetting("ranking_panel_message_id", message.id);

    return message;
}

async function updateRankingPanel(client) {
    const channelId = getSetting("ranking_panel_channel_id");
    const messageId = getSetting("ranking_panel_message_id");

    if (!channelId || !messageId) {
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        await message.edit({
            embeds: [createRankingEmbed()],
        });
    } catch (error) {
        console.error("랭킹 패널 업데이트 실패:", error);
    }
}

module.exports = {
    createOrUpdateRankingPanel,
    updateRankingPanel,
};