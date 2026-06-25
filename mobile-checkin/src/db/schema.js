export const DB_SCHEMA = `
  -- Bảng lưu thông tin vé local
  CREATE TABLE IF NOT EXISTS local_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    qr_token TEXT NOT NULL,
    owner_id TEXT, -- Đã thêm để khớp với Backend
    ticket_type TEXT,
    concert_id TEXT,
    status TEXT DEFAULT 'VALID',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Bảng log check-in
  CREATE TABLE IF NOT EXISTS checkin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    staff_id TEXT,
    device_id TEXT,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sync_mode TEXT DEFAULT 'OFFLINE',
    status TEXT DEFAULT 'SUCCESS',
    is_synced INTEGER DEFAULT 0, -- Tối ưu cho truy vấn sync
    sync_at TEXT,
    error_message TEXT,
    client_event_id TEXT UNIQUE,
    conflict_reason TEXT,
    FOREIGN KEY(ticket_id) REFERENCES local_tickets(ticket_id)
  );

  -- Bảng hàng đợi đồng bộ (Offline-first architecture)
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL, -- VD: 'CHECKIN', 'UPDATE_STATUS'
    payload TEXT NOT NULL,     -- JSON string dữ liệu
    status TEXT DEFAULT 'PENDING',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_local_tickets_ticket_id ON local_tickets(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_checkin_logs_is_synced ON checkin_logs(is_synced);
`;