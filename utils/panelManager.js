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
    formatMinutes,
} = require("./time");

const {
    getUserWorkMinutes,
} = require("./workConfig");

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

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

function getExpectedEnd(record) {
    const start = new Date(record.start_time);
    const workMinutes = getUserWorkMinutes(record.user_id);

    return addMinutes(start, workMinutes);
}

function getTodayRecords() {
    const today = getTodayKST(now());

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
            const expectedEnd = getExpectedEnd(record);

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

async function getDisplayName(client, userId, fallbackName) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(userId);
        return member.displayName;
    } catch {
        return fallbackName || userId;
    }
}

async function createPersonLine(client, record, type) {
    const displayName = await getDisplayName(client, record.user_id, record.username);

    const start = new Date(record.start_time);
    const startText = formatTimeKST(start);
    const targetText = formatMinutes(getUserWorkMinutes(record.user_id));

    if (type === "finished") {
        const end = new Date(record.end_time);
        const endText = formatTimeKST(end);
        const workText = formatMinutes(record.work_minutes);

        return [
            `👤 **${displayName}**`,
            `└ ${startText} ~ ${endText} · ${workText}`,
        ].join("\n");
    }

    if (type === "overtime") {
        const current = now();
        const expectedEnd = getExpectedEnd(record);
        const overMinutes = Math.max(0, Math.floor((current - expectedEnd) / 1000 / 60));

        return [
            `👤 **${displayName}**`,
            `└ ${startText} 출근 · ${formatTimeKST(expectedEnd)} 예정 · 초과 ${formatMinutes(overMinutes)}`,
            `└ 목표 ${targetText}`,
        ].join("\n");
    }

    const expectedEnd = getExpectedEnd(record);

    return [
        `👤 **${displayName}**`,
        `└ ${startText} 출근 · ${formatTimeKST(expectedEnd)} 퇴근예정`,
        `└ 목표 ${targetText}`,
    ].join("\n");
}

async function createList(client, records, type) {
    if (records.length === 0) {
        return "없음";
    }

    const lines = [];

    for (const record of records.slice(0, 8)) {
        lines.push(await createPersonLine(client, record, type));
    }

    const shown = lines.join("\n");

    if (records.length <= 8) {
        return shown;
    }

    return `${shown}\n외 ${records.length - 8}명`;
}

async function createPanelEmbed(client) {
    const stats = getPanelStats();
    const updatedAt = formatTimeKST(now());

    const workingList = await createList(client, stats.working, "working");
    const overtimeList = await createList(client, stats.overtime, "overtime");
    const finishedList = await createList(client, stats.finished, "finished");

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
                value: workingList,
                inline: false,
            },
            {
                name: `🌙 야근중 (${stats.overtime.length}명)`,
                value: overtimeList,
                inline: false,
            },
            {
                name: `🏠 퇴근완료 (${stats.finished.length}명)`,
                value: finishedList,
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
        embeds: [await createPanelEmbed(channel.client)],
        components: createPanelButtons(),
    };

    if (savedChannelId && savedMessageId) {
        try {
            const savedChannel = await channel.client.channels.fetch(savedChannelId);
            const savedMessage = await savedChannel.messages.fetch(savedMessageId);

            await savedMessage.edit(payload);
            return savedMessage;
        } catch {
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
            embeds: [await createPanelEmbed(client)],
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