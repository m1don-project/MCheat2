const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { permitRoles } = require('../utils/auth');

const buildKeyValue = () => {
  const raw = uuidv4().replace(/-/g, '').toUpperCase();
  return raw.match(/.{1,4}/g).slice(0, 4).join('-');
};

module.exports = ({ db, config }) => {
  const router = express.Router();

  router.get('/activity/latest', permitRoles('admin'), (req, res) => {
    db.all(
      `SELECT ah.id, lk.key_value, ah.hwid, ah.action, ah.metadata, ah.created_at
       FROM activation_history ah
       JOIN license_keys lk ON lk.id = ah.key_id
       ORDER BY ah.created_at DESC
       LIMIT 15`,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка получения истории' });
        }
        res.json(rows);
      }
    );
  });

  router.get('/', permitRoles('admin'), (req, res) => {
    const { status, search } = req.query;
    const clauses = [];
    const params = [];

    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    if (search) {
      clauses.push('(key_value LIKE ? OR hwid LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    db.all(
      `SELECT id, key_value, status, hwid, expires_at, comment, is_blocked,
              last_activation, created_at, updated_at
       FROM license_keys
       ${whereClause}
       ORDER BY created_at DESC`,
      params,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка получения ключей' });
        }
        res.json(rows);
      }
    );
  });

  router.get('/stats', permitRoles('admin'), (req, res) => {
    db.get(
      `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) AS blocked
       FROM license_keys`,
      [],
      (err, row) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка статистики' });
        }
        res.json(row);
      }
    );
  });

  router.post('/', permitRoles('admin'), (req, res) => {
    const {
      key_value,
      expires_at,
      valid_days,
      hwid,
      status = 'new',
      comment
    } = req.body;

    const key = key_value || buildKeyValue();
    let expiration = expires_at;
    if (!expiration && valid_days) {
      expiration = new Date(
        Date.now() + Number(valid_days) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
    }

    db.run(
      `INSERT INTO license_keys (key_value, status, hwid, expires_at, comment, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [key, status, hwid || null, expiration || null, comment || null, req.user.id],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ message: 'Ключ уже существует' });
          }
          return res.status(500).json({ message: 'Ошибка создания ключа' });
        }
        res.status(201).json({
          id: this.lastID,
          key_value: key,
          status,
          expires_at: expiration
        });
      }
    );
  });

  router.put('/:id/block', permitRoles('admin'), (req, res) => {
    const { is_blocked } = req.body;
    if (typeof is_blocked !== 'boolean') {
      return res.status(400).json({ message: 'Передайте is_blocked true/false' });
    }

    db.run(
      `UPDATE license_keys
       SET is_blocked = ?, status = CASE WHEN ? THEN 'blocked' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [is_blocked ? 1 : 0, is_blocked ? 1 : 0, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ message: 'Ошибка обновления' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Ключ не найден' });
        }
        res.json({ id: req.params.id, is_blocked });
      }
    );
  });

  router.put('/:id/hwid', permitRoles('admin'), (req, res) => {
    const { hwid } = req.body;
    db.run(
      `UPDATE license_keys
       SET hwid = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [hwid || null, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ message: 'Ошибка изменения HWID' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Ключ не найден' });
        }
        res.json({ id: req.params.id, hwid: hwid || null });
      }
    );
  });

  router.put('/:id/extend', permitRoles('admin'), (req, res) => {
    const { days } = req.body;
    if (!days) {
      return res.status(400).json({ message: 'Укажите количество дней' });
    }

    db.get(
      'SELECT expires_at FROM license_keys WHERE id = ?',
      [req.params.id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка чтения ключа' });
        }
        if (!row) {
          return res.status(404).json({ message: 'Ключ не найден' });
        }

        let baseDate = row.expires_at ? Date.parse(row.expires_at) : Date.now();
        if (baseDate < Date.now()) {
          baseDate = Date.now();
        }
        const newDate = new Date(
          baseDate + Number(days) * 24 * 60 * 60 * 1000
        );

        const formatted = newDate.toISOString().slice(0, 19).replace('T', ' ');
        db.run(
          `UPDATE license_keys
           SET expires_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [formatted, req.params.id],
          function (updateErr) {
            if (updateErr) {
              return res.status(500).json({ message: 'Ошибка продления' });
            }
            res.json({ id: req.params.id, expires_at: formatted });
          }
        );
      }
    );
  });

  router.get('/:id/history', permitRoles('admin'), (req, res) => {
    db.all(
      `SELECT hwid, action, metadata, created_at
       FROM activation_history
       WHERE key_id = ?
       ORDER BY created_at DESC`,
      [req.params.id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка истории' });
        }
        res.json(rows);
      }
    );
  });

  return router;
};

