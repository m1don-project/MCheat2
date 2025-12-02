const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const {
  authenticateToken,
  permitRoles,
  generateAccessToken,
  generateRefreshToken
} = require('./utils/auth');

const configPath = path.resolve(__dirname, '..', 'config', 'config.json');
if (!fs.existsSync(configPath)) {
  throw new Error(`Файл конфигурации не найден: ${configPath}`);
}

const configFromFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Переопределение из переменных окружения (для Fly.io и других платформ)
const config = {
  server: {
    host: process.env.HOST || configFromFile.server.host,
    port: parseInt(process.env.PORT || configFromFile.server.port)
  },
  security: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || configFromFile.security.jwtAccessSecret,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || configFromFile.security.jwtRefreshSecret,
    accessTokenMinutes: configFromFile.security.accessTokenMinutes,
    refreshTokenDays: configFromFile.security.refreshTokenDays,
    passwordSaltRounds: configFromFile.security.passwordSaltRounds
  },
  database: {
    filename: process.env.DB_FILENAME || configFromFile.database.filename
  },
  defaults: {
    bootstrapAdminUsername: process.env.ADMIN_USERNAME || configFromFile.defaults.bootstrapAdminUsername,
    bootstrapAdminPassword: process.env.ADMIN_PASSWORD || configFromFile.defaults.bootstrapAdminPassword
  }
};
const dbFile = path.resolve(__dirname, 'database', config.database.filename);

const app = express();
const db = new sqlite3.Database(dbFile);

const requireAuth = authenticateToken(config);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

const runSqlFile = (fileName) => {
  const filePath = path.resolve(__dirname, 'database', fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL файл не найден: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

const ensureAdminUser = () =>
  new Promise((resolve, reject) => {
    const { bootstrapAdminUsername, bootstrapAdminPassword } = config.defaults;

    db.get(
      'SELECT id FROM users WHERE username = ?',
      [bootstrapAdminUsername],
      async (err, row) => {
        if (err) {
          return reject(err);
        }

        if (row) {
          return resolve();
        }

        try {
          const passwordHash = await bcrypt.hash(
            bootstrapAdminPassword,
            config.security.passwordSaltRounds
          );

          db.run(
            `INSERT INTO users (username, password_hash, role, is_active)
             VALUES (?, ?, 'admin', 1)`,
            [bootstrapAdminUsername, passwordHash],
            (insertErr) => {
              if (insertErr) {
                return reject(insertErr);
              }
              console.log(
                `Создан пользователь admin (${bootstrapAdminUsername}). Не забудьте сменить пароль!`
              );
              resolve();
            }
          );
        } catch (hashErr) {
          reject(hashErr);
        }
      }
    );
  });

const bootstrap = async () => {
  try {
    await runSqlFile('schema.sql');
    await runSqlFile('init.sql');
    await ensureAdminUser();
  } catch (err) {
    console.error('Не удалось подготовить базу данных:', err.message);
    process.exit(1);
  }
};

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const keyRoutes = require('./routes/keys');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(
  '/api/auth',
  authRoutes({
    db,
    config,
    generateAccessToken,
    generateRefreshToken
  })
);

app.use(
  '/api/users',
  requireAuth,
  permitRoles('admin'),
  userRoutes({ db, config })
);

app.use(
  '/api/keys',
  requireAuth,
  keyRoutes({
    db,
    config,
    permitRoles,
    requireAuth
  })
);

// клиентские API (не требуют JWT, но проверяют ключ)
const clientApiRouter = express.Router();
clientApiRouter.post('/activate_key', (req, res) => {
  const { key, hwid, comment } = req.body;
  if (!key || !hwid) {
    return res
      .status(400)
      .json({ message: 'Необходимо указать ключ и HWID для активации' });
  }

  db.get(
    'SELECT * FROM license_keys WHERE key_value = ?',
    [key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка БД' });
      }
      if (!row) {
        return res.status(404).json({ message: 'Ключ не найден' });
      }
      if (row.is_blocked) {
        return res.status(403).json({ message: 'Ключ заблокирован' });
      }

      const now = Date.now();
      const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
      if (expiresAt && expiresAt < now) {
        return res.status(403).json({ message: 'Срок действия истёк' });
      }

      if (row.hwid && row.hwid !== hwid) {
        return res.status(403).json({ message: 'HWID не совпадает' });
      }

      const statements = [];
      const params = [];
      const newHwid = row.hwid || hwid;

      statements.push(
        `UPDATE license_keys
         SET hwid = ?, status = 'active', last_activation = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      );
      params.push(newHwid, row.id);

      db.serialize(() => {
        db.run(statements[0], params, (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ message: 'Ошибка обновления ключа' });
          }

          db.run(
            `INSERT INTO activation_history (key_id, hwid, action, metadata)
             VALUES (?, ?, 'activate', ?)`,
            [
              row.id,
              hwid,
              JSON.stringify({
                comment: comment || null,
                ip: req.ip,
                userAgent: req.headers['user-agent'] || null
              })
            ],
            (historyErr) => {
              if (historyErr) {
                return res
                  .status(500)
                  .json({ message: 'Ошибка сохранения истории' });
              }

              res.json({
                message: 'Активация успешна',
                expires_at: row.expires_at,
                hwid: newHwid
              });
            }
          );
        });
      });
    }
  );
});

clientApiRouter.post('/check_key', (req, res) => {
  const { key, hwid } = req.body;
  if (!key) {
    return res.status(400).json({ message: 'Необходимо указать ключ' });
  }

  db.get(
    'SELECT key_value, status, hwid, expires_at, is_blocked FROM license_keys WHERE key_value = ?',
    [key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка БД' });
      }
      if (!row) {
        return res.status(404).json({ message: 'Ключ не найден' });
      }

      const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
      let remainingDays = null;
      if (expiresAt) {
        remainingDays = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      }

      res.json({
        key: row.key_value,
        status: row.status,
        hwid: row.hwid,
        expires_at: row.expires_at,
        is_blocked: !!row.is_blocked,
        hwid_matches: row.hwid ? row.hwid === hwid : null,
        remaining_days: remainingDays
      });
    }
  );
});

clientApiRouter.get('/get_remaining_days', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ message: 'Передайте параметр key' });
  }
  db.get(
    'SELECT expires_at FROM license_keys WHERE key_value = ?',
    [key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка БД' });
      }
      if (!row) {
        return res.status(404).json({ message: 'Ключ не найден' });
      }

      if (!row.expires_at) {
        return res.json({ remaining_days: null });
      }

      const remainingMs = Date.parse(row.expires_at) - Date.now();
      const remaining = Math.max(
        0,
        Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
      );
      res.json({ remaining_days: remaining });
    }
  );
});

app.use('/api', clientApiRouter);

app.use((err, req, res, next) => {
  console.error('API error', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

bootstrap().then(() => {
  app.listen(config.server.port, config.server.host, () => {
    console.log(
      `License server listening on http://${config.server.host}:${config.server.port}`
    );
  });
});

