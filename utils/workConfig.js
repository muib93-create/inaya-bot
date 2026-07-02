const db = require("../database");

const DEFAULT_WORK_MINUTES = 9 * 60;

function getUserWorkMinutes(userId) {
    const row = db.prepare(`
        SELECT target_minutes
        FROM user_work_settings
        WHERE user_id = ?
    `).get(userId);

    return row ? row.target_minutes : DEFAULT_WORK_MINUTES;
}

function setUserWorkMinutes(userId, minutes) {
    db.prepare(`
        INSERT INTO user_work_settings (
            user_id,
            target_minutes,
            updated_at
        ) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id)
        DO UPDATE SET
            target_minutes = excluded.target_minutes,
            updated_at = CURRENT_TIMESTAMP
    `).run(userId, minutes);
}

module.exports = {
    DEFAULT_WORK_MINUTES,
    getUserWorkMinutes,
    setUserWorkMinutes,
};