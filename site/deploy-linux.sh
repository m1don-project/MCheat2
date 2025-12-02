#!/bin/bash
# Скрипт автоматического развертывания на Linux VPS

set -e

echo "=== Развертывание панели лицензий ==="

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "Установка Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "Node.js версия: $(node --version)"
echo "npm версия: $(npm --version)"

# Определение пути установки
INSTALL_DIR="${1:-/opt/license-panel}"
echo "Установка в: $INSTALL_DIR"

# Создание директории
sudo mkdir -p "$INSTALL_DIR"
sudo chown -R $USER:$USER "$INSTALL_DIR"

# Копирование файлов (если скрипт запущен из папки site)
if [ -d "backend" ] && [ -d "public" ] && [ -d "config" ]; then
    echo "Копирование файлов проекта..."
    cp -r backend "$INSTALL_DIR/"
    cp -r public "$INSTALL_DIR/"
    cp -r config "$INSTALL_DIR/"
elif [ -d "../site/backend" ] && [ -d "../site/public" ] && [ -d "../site/config" ]; then
    echo "Копирование файлов проекта из папки site..."
    cp -r ../site/backend "$INSTALL_DIR/"
    cp -r ../site/public "$INSTALL_DIR/"
    cp -r ../site/config "$INSTALL_DIR/"
else
    echo "⚠️  Файлы проекта не найдены. Убедитесь, что скрипт запущен из папки site или корня проекта."
    exit 1
fi

# Установка зависимостей
echo "Установка зависимостей..."
cd "$INSTALL_DIR/backend"
npm install --production

# Генерация секретов, если их нет
CONFIG_FILE="$INSTALL_DIR/config/config.json"
if [ -f "$CONFIG_FILE" ]; then
    if grep -q "change-this" "$CONFIG_FILE"; then
        echo "⚠️  ВНИМАНИЕ: В config.json используются стандартные секреты!"
        echo "Сгенерируйте новые секреты командой:"
        echo "  openssl rand -hex 32"
        echo "И замените jwtAccessSecret и jwtRefreshSecret в $CONFIG_FILE"
    fi
else
    echo "⚠️  Файл config.json не найден! Создайте его вручную."
fi

# Создание systemd service
SERVICE_FILE="/etc/systemd/system/license-panel.service"
echo "Создание systemd service..."

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=License Panel API Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$(which node) $INSTALL_DIR/backend/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Активация службы
echo "Активация службы..."
sudo systemctl daemon-reload
sudo systemctl enable license-panel

echo ""
echo "=== Установка завершена ==="
echo ""
echo "Следующие шаги:"
echo "1. Отредактируйте $CONFIG_FILE (секреты, пароль админа)"
echo "2. Запустите службу: sudo systemctl start license-panel"
echo "3. Проверьте статус: sudo systemctl status license-panel"
echo "4. Просмотр логов: sudo journalctl -u license-panel -f"
echo ""
echo "Панель будет доступна на: http://$(hostname -I | awk '{print $1}'):4000/login.html"

