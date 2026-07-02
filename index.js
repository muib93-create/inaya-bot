require("dotenv").config();

const db = require("./database");
const workStatus = require("./workStatus");
const { updatePanel } = require("./utils/panelManager");
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const {
    now,
    formatTimeKST,
    addHours,
} = require("./utils/time");

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
        console.log(`⚠️ 명령어 파일 오류: ${file}`);
        continue;
    }

    client.commands.set(command.data.name, command);
}

client.once("clientReady", () => {
    console.log(`✅ ${client.user.tag} 로그인 완료!`);
    console.log("⏰ 자동 퇴근 알림 시스템 시작!");

    workStatus.updateStatus(client).catch(console.error);
    updatePanel(client).catch(console.error);

    setInterval(async () => {
        const records = db.prepare(`
            SELECT * FROM work_log
            WHERE status = 'working'
        `).all();

        const current = now();

        for (const record of records) {
            const start = new Date(record.start_time);
            const end = addHours(start, 9);

            const diffMinutes = Math.floor((end - current) / 1000 / 60);
            const endText = formatTimeKST(end);

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
        await updatePanel(client).catch(console.error);
    }, 60 * 1000);
});

function makeButtonReplyEphemeral(interaction) {
    const originalReply = interaction.reply.bind(interaction);

    interaction.reply = async (options) => {
        if (typeof options === "string") {
            return originalReply({
                content: options,
                ephemeral: true,
            });
        }

        return originalReply({
            ...options,
            ephemeral: true,
        });
    };
}

client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isButton()) {
            const buttonCommandMap = {
                work_start: "출근",
                work_end: "퇴근",
                work_until: "퇴근까지",
                work_status: "출근현황",
            };

            const commandName = buttonCommandMap[interaction.customId];
            if (!commandName) return;

            const command = client.commands.get(commandName);
            if (!command) return;

            makeButtonReplyEphemeral(interaction);

            await command.execute(interaction);
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
    } catch (err) {
        console.error("명령어 오류:", err);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ 오류가 발생했습니다.",
                ephemeral: true,
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);