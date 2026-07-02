const Database = require("better-sqlite3");

// work.db 파일이 없으면 자동 생성
const db = new Database("work.db");

// 출근 기록 테이블
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

module.exports = db;