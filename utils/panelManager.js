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

const { getUserWorkMinutes } = require("./workConfig");

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

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
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

function getDockRecords() {
    const today = getTodayKST(now());

    // 어제 이전 도킹 기록 자동 삭제
    db.prepare(`
        DELETE FROM dock_status
        WHERE dock_date IS NOT NULL
          AND dock_date <> ?
    `).run(today);

    return db.prepare(`
        SELECT *
        FROM dock_status
        WHERE dock_date = ?
        ORDER BY started_at ASC
    `).all(today);
}

function getPanelStats() {
    const records = getTodayRecords();

    const working = [];
    const finished = [];

    for (const record of records) {
        if (record.status === "finished") {
            finished.push(record);
            continue;
        }

        if (record.status === "working") {
            working.push(record);
        }
    }

    const dock = getDockRecords();

    return {
        working,
        finished,
        dock,
        total: records.length,
    };
}

async function createWorkLine(client, record) {
    const displayName = await getDisplayName(client, record.user_id, record.username);

    const current = now();
    const start = new Date(record.start_time);
    const targetMinutes = getUserWorkMinutes(record.user_id);
    const expectedEnd = addMinutes(start, targetMinutes);

    const startText = formatTimeKST(start);
    const endText = formatTimeKST(expectedEnd);

    const diffMinutes = Math.floor((expectedEnd - current) / 1000 / 60);

    if (diffMinutes > 0) {
        return [
            `👤 **${displayName}**`,
            `└ ${startText} → ${endText}`,
            `└ 남은 ${formatMinutes(diffMinutes)}`,
        ].join("\n");
    }

    const overMinutes = Math.abs(diffMinutes);

    return [
        `👤 **${displayName}**`,
        `└ ${startText} → ${endText}`,
        `└ 초과 ${formatMinutes(overMinutes)}`,
    ].join("\n");
}

async function createFinishedLine(client, record) {
    const displayName = await getDisplayName(client, record.user_id, record.username);

    const start = new Date(record.start_time);
    const end = new Date(record.end_time);

    return [
        `👤 **${displayName}**`,
        `└ ${formatTimeKST(start)} → ${formatTimeKST(end)}`,
        `└ 총 근무 ${formatMinutes(record.work_minutes)}`,
    ].join("\n");
}

async function createDockLine(client, record) {
    const displayName = await getDisplayName(client, record.user_id, record.username);

    const current = now();
    const startedAt = new Date(record.started_at);
    const waitingMinutes = Math.max(1, Math.floor((current - startedAt) / 1000 / 60));

    return [
        `👤 **${displayName}**`,
        `└ 대기 ${formatMinutes(waitingMinutes)}째`,
    ].join("\n");
}

async function createList(client, records, type) {
    if (records.length === 0) return "없음";

    const lines = [];
    const sliced = records.slice(0, 8);

    for (const record of sliced) {
        if (type === "working") {
            lines.push(await createWorkLine(client, record));
        }

        if (type === "finished") {
            lines.push(await createFinishedLine(client, record));
        }

        if (type === "dock") {
            lines.push(await createDockLine(client, record));
        }
    }

    const shown = lines.join("\n\n");

    if (records.length <= 8) return shown;

    return `${shown}\n\n외 ${records.length - 8}명`;
}

async function createPanelEmbed(client) {
    const stats = getPanelStats();
    const updatedAt = formatTimeKST(now());

    const workingList = await createList(client, stats.working, "working");
    const finishedList = await createList(client, stats.finished, "finished");
    const dockList = await createList(client, stats.dock, "dock");

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 근태관리")
        .setDescription(
            [
                "오늘의 근태 현황입니다.",
                "",
                LINE,
                "",
                `🟢 **근무중**　　${stats.working.length}명`,
                `🏠 **퇴근완료**　${stats.finished.length}명`,
                `🔞 **도킹가능**　${stats.dock.length}명`,
                "",
                LINE,
            ].join("\n")
        )
        .addFields(
            {
                name: `🟢 근무중 (${stats.working.length}명)`,
                value: workingList,
                inline: false,
            },
            {
                name: `🏠 퇴근완료 (${stats.finished.length}명)`,
                value: finishedList,
                inline: false,
            },
            {
                name: `🔞 도킹가능 (${stats.dock.length}명)`,
                value: dockList,
                inline: false,
            }
        )
        .setFooter({
            text: `👥 총 ${stats.total}명 · 마지막 갱신 ${updatedAt} · 이나야 일해라`,
        })
        .setTimestamp();
}

function createPanelButtons() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_start")
            .setLabel("출근")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("work_end")
            .setLabel("퇴근")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("work_dock")
            .setLabel("도킹")
            .setEmoji("🔞")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("work_reset")
            .setLabel("초기화")
            .setEmoji("🧹")
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
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