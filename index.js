require("dotenv").config();

const db = require("./database");
const workStatus = require("./workStatus");
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.once("clientReady", () => {
    console.log(`✅ ${client.user.tag} 로그인 완료!`);
    console.log("⏰ 자동 퇴근 알림 시스템 시작!");

    workStatus.updateStatus(client).catch(console.error);

    setInterval(async () => {
        const records = db.prepare(`
            SELECT * FROM work_log
            WHERE status = 'working'
        `).all();

        const now = new Date();

        for (const record of records) {
            const start = new Date(record.start_time);
            const end = new Date(start);
            end.setHours(end.getHours() + 9);

            const diffMinutes = Math.floor((end - now) / 1000 / 60);
            const endText = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

            let embed = null;
            let nextState = record.notification_state;

            if (diffMinutes <= 10 && diffMinutes > 5 && record.notification_state < 1) {
                embed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⏰ 퇴근 10분 전")
                    .setDescription(`<@${record.user_id}> 슬슬 마무리할 시간이에요.`)
                    .addFields({ name: "퇴근 예정", value: endText, inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 1;
            }

            if (diffMinutes <= 5 && diffMinutes > 0 && record.notification_state < 2) {
                embed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⏰ 퇴근 5분 전")
                    .setDescription(`<@${record.user_id}> 거의 다 왔어요. 마무리하세요!`)
                    .addFields({ name: "퇴근 예정", value: endText, inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 2;
            }

            if (diffMinutes <= 0 && diffMinutes > -60 && record.notification_state < 3) {
                embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("🔴 퇴근 시간이 지났습니다")
                    .setDescription(`<@${record.user_id}> /퇴근 을 눌러주세요.`)
                    .addFields({ name: "퇴근 예정", value: endText, inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 3;
            }

            const isPastMidnight = now.getHours() === 0 && record.notification_state < 4;

            if (isPastMidnight) {
                embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("🌙 자정 경고")
                    .setDescription(`<@${record.user_id}> 자정이 지났는데 아직 퇴근 기록이 없어요.`)
                    .addFields({ name: "상태", value: "퇴근 기록 없음", inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 4;
            }

            if (embed && nextState !== record.notification_state) {
                const channel = await client.channels.fetch(process.env.NOTIFY_CHANNEL_ID);

                await channel.send({
                    content: `<@${record.user_id}>`,
                    embeds: [embed],
                });

                db.prepare(`
                    UPDATE work_log
                    SET notification_state = ?
                    WHERE id = ?
                `).run(nextState, record.id);
            }
        }

        await workStatus.updateStatus(client).catch(console.error);
    }, 60 * 1000);
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction);
});

client.login(process.env.DISCORD_TOKEN);