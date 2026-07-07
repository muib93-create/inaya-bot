const { EmbedBuilder } = require("discord.js");
const db = require("../database");

const {
    now,
    getTodayKST,
    formatTimeKST,
    formatMinutes,
} = require("./time");

const LINE = "━━━━━━━━━━━━━━━━━━━━";

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

function getTodayStartRecords() {
    const today = getTodayKST(now());

    const records = db.prepare(`
        SELECT *
        FROM work_log
        ORDER BY start_time ASC
    `).all();

    const todayRecords = records.filter(record => {
        if (!record.start_time) return false;

        const startDateKST = getTodayKST(new Date(record.start_time));

        return record.work_date === today || startDateKST === today;
    });

    const firstByUser = new Map();

    for (const record of todayRecords) {
        if (!firstByUser.has(record.user_id)) {
            firstByUser.set(record.user_id, record);
        }
    }

    return Array.from(firstByUser.values())
        .filter(record => record.start_time)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
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

    const diffMinutes = Math.max(0, Math.floor((start - firstStart) / 1000 / 60));

    return `${getMedal(index)} **${record.username}**　${startText} (+${formatMinutes(diffMinutes)})`;
}

function createRankingEmbed() {
    const records = getTodayStartRecords();
    const updatedAt = formatTimeKST(now());

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
                ].join("\n")
            )
            .setFooter({
                text: `👥 오늘 출근 0명 · 마지막 갱신 ${updatedAt}`,
            })
            .setTimestamp();
    }

    const earlyBird = records[0];
    const firstStart = new Date(earlyBird.start_time);

    const rankingLines = records
        .slice(0, 10)
        .map((record, index) => createRankLine(record, index, firstStart))
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
            ].join("\n")
        )
        .setFooter({
            text: `👥 오늘 출근 ${records.length}명 · 마지막 갱신 ${updatedAt}`,
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
            const savedChannel = await channel.client.channels.fetch(savedChannelId);
            const savedMessage = await savedChannel.messages.fetch(savedMessageId);

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

    if (!channelId || !messageId) return;

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