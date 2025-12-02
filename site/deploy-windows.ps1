# Скрипт автоматического развертывания на Windows Server
# Запуск: powershell -ExecutionPolicy Bypass -File deploy-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Развертывание панели лицензий ===" -ForegroundColor Cyan

# Проверка Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js не установлен!" -ForegroundColor Red
    Write-Host "Скачайте и установите Node.js LTS с https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Node.js версия: $(node --version)" -ForegroundColor Green
Write-Host "npm версия: $(npm --version)" -ForegroundColor Green

# Определение пути установки
$InstallDir = if ($args[0]) { $args[0] } else { "C:\LicensePanel" }
Write-Host "Установка в: $InstallDir" -ForegroundColor Cyan

# Создание директории
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Копирование файлов
if ((Test-Path "backend") -and (Test-Path "public") -and (Test-Path "config")) {
    Write-Host "Копирование файлов проекта..." -ForegroundColor Cyan
    Copy-Item -Path "backend" -Destination $InstallDir -Recurse -Force
    Copy-Item -Path "public" -Destination $InstallDir -Recurse -Force
    Copy-Item -Path "config" -Destination $InstallDir -Recurse -Force
} elseif ((Test-Path "..\site\backend") -and (Test-Path "..\site\public") -and (Test-Path "..\site\config")) {
    Write-Host "Копирование файлов проекта из папки site..." -ForegroundColor Cyan
    Copy-Item -Path "..\site\backend" -Destination $InstallDir -Recurse -Force
    Copy-Item -Path "..\site\public" -Destination $InstallDir -Recurse -Force
    Copy-Item -Path "..\site\config" -Destination $InstallDir -Recurse -Force
} else {
    Write-Host "❌ Файлы проекта не найдены. Убедитесь, что скрипт запущен из папки site или корня проекта." -ForegroundColor Red
    exit 1
}

# Установка зависимостей
Write-Host "Установка зависимостей..." -ForegroundColor Cyan
Set-Location "$InstallDir\backend"
npm install --production

# Проверка конфигурации
$ConfigFile = "$InstallDir\config\config.json"
if (Test-Path $ConfigFile) {
    $configContent = Get-Content $ConfigFile -Raw
    if ($configContent -match "change-this") {
        Write-Host "⚠️  ВНИМАНИЕ: В config.json используются стандартные секреты!" -ForegroundColor Yellow
        Write-Host "Замените jwtAccessSecret и jwtRefreshSecret в $ConfigFile" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Файл config.json не найден! Создайте его вручную." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Установка завершена ===" -ForegroundColor Green
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Отредактируйте $ConfigFile (секреты, пароль админа)"
Write-Host "2. Для автозапуска используйте NSSM или Планировщик заданий"
Write-Host "3. Запустите вручную: cd $InstallDir\backend && node server.js"
Write-Host ""
Write-Host "Панель будет доступна на: http://localhost:4000/login.html" -ForegroundColor Green

