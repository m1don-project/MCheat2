const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = ({ db, config }) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    db.all(
      `SELECT id, username, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC`,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Не удалось получить пользователей' });
        }
        res.json(rows);
      }
    );
  });

  router.post('/', async (req, res) => {
    const { username, password, role = 'user', is_active = true } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Укажите логин и пароль' });
    }
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Неизвестная роль' });
    }

    try {
      const hash = await bcrypt.hash(password, config.security.passwordSaltRounds);
      db.run(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        [username, hash, role, is_active ? 1 : 0],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(409).json({ message: 'Логин уже используется' });
            }
            return res.status(500).json({ message: 'Ошибка создания пользователя' });
          }
          res.status(201).json({
            id: this.lastID,
            username,
            role,
            is_active: is_active ? 1 : 0
          });
        }
      );
    } catch (hashErr) {
      res.status(500).json({ message: 'Ошибка шифрования пароля' });
    }
  });

  router.put('/:id/status', (req, res) => {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'Передайте is_active = true/false' });
    }

    db.run(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [is_active ? 1 : 0, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ message: 'Ошибка обновления' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json({ id: req.params.id, is_active });
      }
    );
  });

  router.get('/:id/keys', (req, res) => {
    db.all(
      `SELECT id, key_value, status, expires_at, is_blocked, last_activation
       FROM license_keys
       WHERE created_by = ?
       ORDER BY created_at DESC`,
      [req.params.id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка получения ключей' });
        }
        res.json(rows);
      }
    );
  });

  return router;
};

