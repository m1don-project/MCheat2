# Развертывание панели лицензий на хостинге

## Вариант 1: Linux VPS (Ubuntu/Debian)

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версии
node --version
npm --version
```

### 2. Загрузка проекта на сервер

```bash
# Создайте директорию для проекта
sudo mkdir -p /opt/license-panel
sudo chown $USER:$USER /opt/license-panel
cd /opt/license-panel

# Загрузите файлы проекта (через git, scp, или ftp)
# Структура должна быть:
# /opt/license-panel/
#   backend/
#   public/
#   config/
```

### 3. Установка зависимостей

```bash
cd /opt/license-panel/backend
npm install --production
```

### 4. Настройка конфигурации

Отредактируйте `config/config.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 4000
  },
  "security": {
    "jwtAccessSecret": "ВАШ_СЛУЧАЙНЫЙ_СЕКРЕТ_ДОСТУПА_МИНИМУМ_32_СИМВОЛА",
    "jwtRefreshSecret": "ВАШ_СЛУЧАЙНЫЙ_СЕКРЕТ_ОБНОВЛЕНИЯ_МИНИМУМ_32_СИМВОЛА",
    "accessTokenMinutes": 15,
    "refreshTokenDays": 7,
    "passwordSaltRounds": 10
  },
  "database": {
    "filename": "license.db"
  },
  "defaults": {
    "bootstrapAdminUsername": "admin",
    "bootstrapAdminPassword": "СМЕНИТЕ_ЭТОТ_ПАРОЛЬ"
  }
}
```

**Важно:** Сгенерируйте случайные секреты:
```bash
openssl rand -hex 32
```

### 5. Автозапуск через systemd

Создайте файл `/etc/systemd/system/license-panel.service`:

```ini
[Unit]
Description=License Panel API Server
After=network.target

[Service]
Type=simple
User=ваш_пользователь
WorkingDirectory=/opt/license-panel/backend
ExecStart=/usr/bin/node /opt/license-panel/backend/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Ограничения безопасности
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Активируйте службу:

```bash
sudo systemctl daemon-reload
sudo systemctl enable license-panel
sudo systemctl start license-panel
sudo systemctl status license-panel
```

Просмотр логов:
```bash
sudo journalctl -u license-panel -f
```

### 6. Настройка Nginx (реверс-прокси + HTTPS)

Установите Nginx и Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Создайте конфигурацию `/etc/nginx/sites-available/license-panel`:

```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/license-panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Получите SSL-сертификат:

```bash
sudo certbot --nginx -d ваш-домен.com
```

### 7. Настройка файрвола

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Вариант 2: Windows Server

### 1. Установка Node.js

Скачайте и установите Node.js LTS с https://nodejs.org/

### 2. Размещение проекта

Создайте папку, например `C:\LicensePanel\`, и скопируйте туда:
- `backend/`
- `public/`
- `config/`

### 3. Установка зависимостей

```powershell
cd C:\LicensePanel\backend
npm install --production
```

### 4. Настройка config.json

Отредактируйте `C:\LicensePanel\config\config.json` (см. раздел выше).

### 5. Автозапуск через NSSM (Non-Sucking Service Manager)

Скачайте NSSM: https://nssm.cc/download

```powershell
# Распакуйте nssm.exe в C:\nssm\
cd C:\nssm\win64

# Создайте службу
.\nssm.exe install LicensePanel "C:\Program Files\nodejs\node.exe" "C:\LicensePanel\backend\server.js"
.\nssm.exe set LicensePanel AppDirectory "C:\LicensePanel\backend"
.\nssm.exe set LicensePanel DisplayName "License Panel API"
.\nssm.exe set LicensePanel Description "REST API для управления лицензиями"
.\nssm.exe set LicensePanel Start SERVICE_AUTO_START

# Запустите службу
.\nssm.exe start LicensePanel
```

Проверка статуса:
```powershell
.\nssm.exe status LicensePanel
```

### 6. Альтернатива: Автозапуск через планировщик задач

1. Откройте "Планировщик заданий"
2. Создайте задачу:
   - Триггер: "При входе в систему"
   - Действие: Запустить программу
   - Программа: `C:\Program Files\nodejs\node.exe`
   - Аргументы: `C:\LicensePanel\backend\server.js`
   - Рабочая папка: `C:\LicensePanel\backend`

---

## Вариант 3: PM2 (рекомендуется для production)

### Установка PM2

```bash
npm install -g pm2
```

### Запуск приложения

```bash
cd /opt/license-panel/backend
pm2 start server.js --name license-panel
pm2 save
pm2 startup  # Настройка автозапуска при перезагрузке
```

### Управление

```bash
pm2 list              # Список процессов
pm2 logs license-panel  # Логи
pm2 restart license-panel  # Перезапуск
pm2 stop license-panel     # Остановка
pm2 monit              # Мониторинг
```

---

## Проверка работы

После запуска проверьте:

```bash
# Проверка здоровья API
curl http://localhost:4000/api/health

# Должен вернуть: {"status":"ok","timestamp":"..."}
```

Откройте в браузере: `http://ваш-сервер:4000/login.html`

---

## Резервное копирование

### Автоматический бэкап БД (Linux cron)

Создайте скрипт `/opt/license-panel/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/license-panel/backups"
DB_FILE="/opt/license-panel/backend/database/license.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_FILE" "$BACKUP_DIR/license_$DATE.db"
# Удаляем старые бэкапы (старше 30 дней)
find "$BACKUP_DIR" -name "license_*.db" -mtime +30 -delete
```

Сделайте исполняемым и добавьте в cron:

```bash
chmod +x /opt/license-panel/backup.sh
crontab -e
# Добавьте строку (бэкап каждый день в 3:00):
0 3 * * * /opt/license-panel/backup.sh
```

---

## Обновление приложения

```bash
# Остановите службу
sudo systemctl stop license-panel
# или
pm2 stop license-panel

# Обновите файлы проекта

# Переустановите зависимости (если изменился package.json)
cd /opt/license-panel/backend
npm install --production

# Запустите снова
sudo systemctl start license-panel
# или
pm2 restart license-panel
```

---

## Мониторинг и логи

### Systemd
```bash
sudo journalctl -u license-panel -n 100  # Последние 100 строк
sudo journalctl -u license-panel --since "1 hour ago"
```

### PM2
```bash
pm2 logs license-panel --lines 100
```

### Ручной запуск для отладки
```bash
cd /opt/license-panel/backend
node server.js
```

