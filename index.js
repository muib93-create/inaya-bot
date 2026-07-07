require("dotenv").config();

const db = require("./database");
const { updatePanel } = require("./utils/panelManager");
const { updateRankingPanel } = require("./utils/rankingManager");
const { getUserWorkMinutes } = require("./utils/workConfig");
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const {
    now,
    formatTimeKST,
} = require("./utils/time");

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function sendDm(userId, embed, client) {
    try {
        const user = await client.users.fetch(userId);

        await user.send({
            embeds: [embed],
        });
    } catch (error) {
        console.log(`⚠️ ${userId}님에게 DM을 보낼 수 없습니다.`);
    }
}

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

    updatePanel(client).catch(console.error);
    updateRankingPanel(client).catch(console.error);

    setInterval(async () => {
        const records = db.prepare(`
            SELECT * FROM work_log
            WHERE status = 'working'
        `).all();

        const current = now();

        for (const record of records) {
            const start = new Date(record.start_time);
            const targetMinutes = getUserWorkMinutes(record.user_id);
            const end = addMinutes(start, targetMinutes);

            const diffMinutes = Math.floor((end - current) / 1000 / 60);
            const endText = formatTimeKST(end);

            let embed = null;
            let nextState = record.notification_state;

            if (diffMinutes <= 5 && diffMinutes > 0 && record.notification_state < 1) {
                embed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⏰ 퇴근까지 5분 남았습니다")
                    .setDescription("조금만 더 힘내세요!")
                    .addFields({ name: "퇴근 예정", value: endText, inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 1;
            }

            if (diffMinutes <= 0 && diffMinutes > -60 && record.notification_state < 2) {
                embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("🎉 퇴근 시간입니다")
                    .setDescription("오늘도 고생하셨습니다.\n퇴근 버튼을 눌러 근무를 종료해주세요.")
                    .addFields({ name: "퇴근 예정", value: endText, inline: true })
                    .setFooter({ text: "이나야 일해라" })
                    .setTimestamp();

                nextState = 2;
            }

            if (embed && nextState !== record.notification_state) {
                await sendDm(record.user_id, embed, client);

                db.prepare(`
                    UPDATE work_log
                    SET notification_state = ?
                    WHERE id = ?
                `).run(nextState, record.id);
            }
        }

        await updatePanel(client).catch(console.error);
        await updateRankingPanel(client).catch(console.error);
    }, 60 * 1000);
});

client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isButton()) {
            const buttonCommandMap = {
                work_start: "출근",
                work_end: "퇴근",
                work_dock: "도킹",
                work_reset: "초기화",
            };

            const commandName = buttonCommandMap[interaction.customId];
            if (!commandName) return;

            const command = client.commands.get(commandName);
            if (!command) return;

            await interaction.deferUpdate();
            await command.execute(interaction, true);
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction, false);
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