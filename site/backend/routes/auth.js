const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../utils/auth');

module.exports = ({ db, config, generateAccessToken, generateRefreshToken }) => {
  const router = express.Router();
  const requireAuth = authenticateToken(config);

  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Введите логин и пароль' });
    }

    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Ошибка БД' });
        }
        if (!user) {
          return res.status(401).json({ message: 'Неверный логин или пароль' });
        }
        if (!user.is_active) {
          return res.status(403).json({ message: 'Учетная запись отключена' });
        }

        const passwordMatch = await bcrypt.compare(
          password,
          user.password_hash
        );
        if (!passwordMatch) {
          return res.status(401).json({ message: 'Неверный логин или пароль' });
        }

        const accessToken = generateAccessToken(user, config);
        const refreshPayload = generateRefreshToken(user, config);

        db.run(
          `INSERT INTO refresh_tokens (user_id, token_id, token, expires_at)
           VALUES (?, ?, ?, ?)`,
          [user.id, refreshPayload.tokenId, refreshPayload.token, refreshPayload.expiresAt],
          (tokenErr) => {
            if (tokenErr) {
              return res.status(500).json({ message: 'Ошибка сохранения токена' });
            }

            res.json({
              accessToken,
              refreshToken: refreshPayload.token,
              user: {
                id: user.id,
                username: user.username,
                role: user.role
              }
            });
          }
        );
      }
    );
  });

  router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Не передан refresh токен' });
    }

    jwt.verify(
      refreshToken,
      config.security.jwtRefreshSecret,
      (err, payload) => {
        if (err || payload.type !== 'refresh') {
          return res.status(401).json({ message: 'Неверный refresh токен' });
        }

        db.get(
          'SELECT * FROM refresh_tokens WHERE token_id = ? AND revoked = 0',
          [payload.tokenId],
          (tokenErr, tokenRow) => {
            if (tokenErr) {
              return res.status(500).json({ message: 'Ошибка БД' });
            }
            if (!tokenRow) {
              return res.status(401).json({ message: 'Токен недействителен' });
            }
            if (Date.parse(tokenRow.expires_at) < Date.now()) {
              return res.status(401).json({ message: 'Refresh токен истёк' });
            }

            db.get(
              'SELECT id, username, role FROM users WHERE id = ?',
              [tokenRow.user_id],
              (userErr, user) => {
                if (userErr || !user) {
                  return res.status(401).json({ message: 'Пользователь не найден' });
                }

                const accessToken = generateAccessToken(user, config);
                const newRefresh = generateRefreshToken(user, config);

                db.serialize(() => {
                  db.run(
                    'UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?',
                    [payload.tokenId]
                  );
                  db.run(
                    `INSERT INTO refresh_tokens (user_id, token_id, token, expires_at)
                     VALUES (?, ?, ?, ?)`,
                    [
                      user.id,
                      newRefresh.tokenId,
                      newRefresh.token,
                      newRefresh.expiresAt
                    ],
                    (insertErr) => {
                      if (insertErr) {
                        return res.status(500).json({ message: 'Ошибка обновления токена' });
                      }

                      res.json({
                        accessToken,
                        refreshToken: newRefresh.token
                      });
                    }
                  );
                });
              }
            );
          }
        );
      }
    );
  });

  router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Не передан refresh токен' });
    }

    jwt.verify(
      refreshToken,
      config.security.jwtRefreshSecret,
      (err, payload) => {
        if (err || payload.type !== 'refresh') {
          return res.status(200).json({ message: 'Выход выполнен' });
        }

        db.run(
          'UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?',
          [payload.tokenId],
          () => res.json({ message: 'Выход выполнен' })
        );
      }
    );
  });

  router.get('/profile', requireAuth, (req, res) => {
    db.get(
      'SELECT id, username, role, created_at FROM users WHERE id = ?',
      [req.user.id],
      (err, row) => {
        if (err || !row) {
          return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(row);
      }
    );
  });

  return router;
};

