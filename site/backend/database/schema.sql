BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','user')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_value TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'new',
    hwid TEXT,
    expires_at TEXT,
    comment TEXT,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    last_activation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_id TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER NOT NULL,
    hwid TEXT,
    action TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (key_id) REFERENCES license_keys(id)
);

CREATE TRIGGER IF NOT EXISTS trg_license_keys_updated
AFTER UPDATE ON license_keys
FOR EACH ROW
BEGIN
    UPDATE license_keys
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

COMMIT;

