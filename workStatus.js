const db = require("./database");

async function updateStatus(client) {
    const workingChannel = await client.channels.fetch(process.env.WORKING_CHANNEL_ID);
    const overtimeChannel = await client.channels.fetch(process.env.OVERTIME_CHANNEL_ID);
    const offworkChannel = await client.channels.fetch(process.env.OFFWORK_CHANNEL_ID);

    const today = new Date().toISOString().slice(0, 10);

    const records = db.prepare(`
        SELECT *
        FROM work_log
        WHERE work_date = ?
        ORDER BY id DESC
    `).all(today);

    const now = new Date();
    const latestByUser = new Map();

    for (const record of records) {
        if (!latestByUser.has(record.user_id)) {
            latestByUser.set(record.user_id, record);
        }
    }

    let working = 0;
    let overtime = 0;
    let offwork = 0;

    for (const record of latestByUser.values()) {
        if (record.status === "finished") {
            offwork++;
            continue;
        }

        if (record.status === "working") {
            const start = new Date(record.start_time);
            const end = new Date(start);
            end.setHours(end.getHours() + 9);

            if (now >= end) {
                overtime++;
            } else {
                working++;
            }
        }
    }

    console.log("스탯 갱신:", { working, overtime, offwork });

    await workingChannel.setName(`🟢 출근중 : ${working}명`);
    await overtimeChannel.setName(`🌙 야근중 : ${overtime}명`);
    await offworkChannel.setName(`🏠 퇴근완료 : ${offwork}명`);
}

module.exports = {
    updateStatus,
};