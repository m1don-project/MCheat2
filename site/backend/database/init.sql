BEGIN TRANSACTION;

INSERT OR IGNORE INTO license_keys (key_value, status, hwid, expires_at, comment, is_blocked)
VALUES (
    'DEMO-KEY-001',
    'active',
    NULL,
    DATETIME('now', '+30 day'),
    'Демо ключ для проверки панели',
    0
);

INSERT INTO activation_history (key_id, hwid, action, metadata)
SELECT id, NULL, 'seed', '{"note":"Начальная запись истории"}'
FROM license_keys
WHERE key_value = 'DEMO-KEY-001'
  AND NOT EXISTS (
    SELECT 1 FROM activation_history WHERE action = 'seed' AND key_id = license_keys.id
  );

COMMIT;

