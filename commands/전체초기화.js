const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const db = require("../database");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("전체초기화")
        .setDescription("오늘의 모든 근무 기록을 삭제합니다.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const today = new Date().toISOString().slice(0, 10);

        const warningEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("⚠️ 전체 초기화 확인")
            .setDescription(
                "정말 오늘의 모든 근무 기록을 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다."
            )
            .setFooter({ text: "이나봇" })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_reset_all")
                .setLabel("삭제")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("cancel_reset_all")
                .setLabel("취소")
                .setStyle(ButtonStyle.Secondary)
        );

        const message = await interaction.reply({
            embeds: [warningEmbed],
            components: [buttons],
            ephemeral: true,
            fetchReply: true,
        });

        const collector = message.createMessageComponentCollector({
            time: 30000,
        });

        collector.on("collect", async buttonInteraction => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: "이 버튼은 명령어를 실행한 사람만 사용할 수 있어요.",
                    ephemeral: true,
                });
                return;
            }

            if (buttonInteraction.customId === "cancel_reset_all") {
                collector.stop();

                await buttonInteraction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle("취소 완료")
                            .setDescription("전체 초기화를 취소했습니다.")
                            .setFooter({ text: "이나봇" })
                            .setTimestamp(),
                    ],
                    components: [],
                });

                return;
            }

            if (buttonInteraction.customId === "confirm_reset_all") {
                const result = db.prepare(`
                    DELETE FROM work_log
                    WHERE work_date = ?
                `).run(today);

                collector.stop();

                await buttonInteraction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle("🧹 전체 초기화 완료")
                            .setDescription(`오늘 기록 ${result.changes}건을 삭제했습니다.`)
                            .setFooter({ text: "이나봇" })
                            .setTimestamp(),
                    ],
                    components: [],
                });
            }
        });

        collector.on("end", async collected => {
            if (collected.size > 0) return;

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("시간 초과")
                        .setDescription("30초 동안 응답이 없어 전체 초기화를 취소했습니다.")
                        .setFooter({ text: "이나봇" })
                        .setTimestamp(),
                ],
                components: [],
            });
        });
    },
};