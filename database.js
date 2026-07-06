const Database = require("better-sqlite3");

const db = new Database("work.db");

db.exec(`
CREATE TABLE IF NOT EXISTS work_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    work_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    break_minutes INTEGER DEFAULT 0,
    work_minutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'working',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notification_state INTEGER DEFAULT 0
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS user_work_settings (
    user_id TEXT PRIMARY KEY,
    target_minutes INTEGER NOT NULL DEFAULT 540,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS dock_status (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    dock_date TEXT,
    started_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const dockColumns = db.prepare(`PRAGMA table_info(dock_status)`).all();
const hasDockDate = dockColumns.some(column => column.name === "dock_date");

if (!hasDockDate) {
    db.exec(`ALTER TABLE dock_status ADD COLUMN dock_date TEXT;`);
}

module.exports = db;