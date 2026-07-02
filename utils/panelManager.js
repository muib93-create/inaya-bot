const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const db = require("../database");

const {
    now,
    getTodayKST,
    formatTimeKST,
    addHours,
    formatMinutes,
} = require("./time");

const LINE = "━━━━━━━━━━━━━━━━━━━━";

function getSetting(key) {
    const row = db.prepare(`
        SELECT value FROM bot_settings
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

function getTodayRecords() {
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

    return Array.from(latestByUser.values());
}

function getPanelStats() {
    const current = now();
    const records = getTodayRecords();

    const working = [];
    const overtime = [];
    const finished = [];

    for (const record of records) {
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

    return {
        working,
        overtime,
        finished,
        total: records.length,
    };
}

function createPersonLine(record, type, index) {
    const start = new Date(record.start_time);
    const startText = formatTimeKST(start);

    if (type === "finished") {
        const end = new Date(record.end_time);
        const endText = formatTimeKST(end);
        const workText = formatMinutes(record.work_minutes);

        return [
            `**${index + 1}. ${record.username}**`,
            `└ ${startText} ~ ${endText} · ${workText}`,
        ].join("\n");
    }

    if (type === "overtime") {
        const current = now();
        const expectedEnd = addHours(start, 9);
        const overMinutes = Math.max(0, Math.floor((current - expectedEnd) / 1000 / 60));

        return [
            `**${index + 1}. ${record.username}**`,
            `└ ${startText} 출근 · 초과 ${formatMinutes(overMinutes)}`,
        ].join("\n");
    }

    const expectedEnd = addHours(start, 9);

    return [
        `**${index + 1}. ${record.username}**`,
        `└ ${startText} 출근 · ${formatTimeKST(expectedEnd)} 퇴근예정`,
    ].join("\n");
}

function createList(records, type) {
    if (records.length === 0) {
        return "없음";
    }

    const shown = records.slice(0, 8)
        .map((record, index) => createPersonLine(record, type, index))
        .join("\n\n");

    if (records.length <= 8) {
        return shown;
    }

    return `${shown}\n\n외 ${records.length - 8}명`;
}

function createPanelEmbed() {
    const stats = getPanelStats();
    const updatedAt = formatTimeKST(now());

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 근태관리")
        .setDescription(
            [
                "오늘의 근태 현황입니다.",
                "",
                LINE,
                "",
                `🟢 **출근중**　　${stats.working.length}명`,
                `🌙 **야근중**　　${stats.overtime.length}명`,
                `🏠 **퇴근완료**　${stats.finished.length}명`,
                "",
                LINE,
            ].join("\n")
        )
        .addFields(
            {
                name: `🟢 출근중 (${stats.working.length}명)`,
                value: createList(stats.working, "working"),
                inline: false,
            },
            {
                name: `🌙 야근중 (${stats.overtime.length}명)`,
                value: createList(stats.overtime, "overtime"),
                inline: false,
            },
            {
                name: `🏠 퇴근완료 (${stats.finished.length}명)`,
                value: createList(stats.finished, "finished"),
                inline: false,
            }
        )
        .setFooter({
            text: `👥 총 ${stats.total}명 · 마지막 갱신 ${updatedAt} · 이나야 일해라`,
        })
        .setTimestamp();
}

function createPanelButtons() {
    const stats = getPanelStats();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_start")
            .setLabel("출근하기")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("work_end")
            .setLabel("퇴근하기")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_until")
            .setLabel("퇴근까지")
            .setEmoji("⏰")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("work_status")
            .setLabel(`출근현황 ${stats.total}`)
            .setEmoji("📊")
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

async function createOrUpdatePanel(channel) {
    const savedChannelId = getSetting("work_panel_channel_id");
    const savedMessageId = getSetting("work_panel_message_id");

    const payload = {
        embeds: [createPanelEmbed()],
        components: createPanelButtons(),
    };

    if (savedChannelId && savedMessageId) {
        try {
            const savedChannel = await channel.client.channels.fetch(savedChannelId);
            const savedMessage = await savedChannel.messages.fetch(savedMessageId);

            await savedMessage.edit(payload);
            return savedMessage;
        } catch (error) {
            console.log("기존 근태 패널을 찾지 못해 새로 생성합니다.");
        }
    }

    const message = await channel.send(payload);

    setSetting("work_panel_channel_id", channel.id);
    setSetting("work_panel_message_id", message.id);

    return message;
}

async function updatePanel(client) {
    const channelId = getSetting("work_panel_channel_id");
    const messageId = getSetting("work_panel_message_id");

    if (!channelId || !messageId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);

        await message.edit({
            embeds: [createPanelEmbed()],
            components: createPanelButtons(),
        });
    } catch (error) {
        console.error("근태 패널 업데이트 실패:", error);
    }
}

module.exports = {
    createOrUpdatePanel,
    updatePanel,
};