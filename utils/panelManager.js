const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const db = require("../database");

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

function createPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 근태관리")
        .setDescription(
            [
                "아래 버튼으로 근태를 관리하세요.",
                "",
                "🟢 출근",
                "🔴 퇴근",
                "⏰ 퇴근까지",
                "📊 출근현황",
            ].join("\n")
        )
        .setFooter({ text: "이나야 일해라" })
        .setTimestamp();
}

function createPanelButtons() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_start")
            .setEmoji("🟢")
            .setLabel("출근")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("work_end")
            .setEmoji("🔴")
            .setLabel("퇴근")
            .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("work_until")
            .setEmoji("⏰")
            .setLabel("퇴근까지")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("work_status")
            .setEmoji("📊")
            .setLabel("출근현황")
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