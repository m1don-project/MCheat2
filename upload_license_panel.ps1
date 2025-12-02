# Скрипт для загрузки файлов панели лицензий в репозиторий
# Использование: powershell -ExecutionPolicy Bypass -File upload_license_panel.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Загрузка панели лицензий в репозиторий ===" -ForegroundColor Cyan

# Проверка git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git не установлен!" -ForegroundColor Red
    exit 1
}

# Добавление нового remote (если нужно)
$newRemote = "https://github.com/m1don-project/MCheat2.git"
$currentRemotes = git remote -v

if ($currentRemotes -notmatch "MCheat2") {
    Write-Host "Добавление remote для MCheat2..." -ForegroundColor Yellow
    git remote add mcheat2 $newRemote 2>$null
    if ($LASTEXITCODE -ne 0) {
        git remote set-url mcheat2 $newRemote
    }
}

# Файлы панели лицензий для добавления
$filesToAdd = @(
    "site",
    "CS2Cheats/Helpers/LicenseManager.h",
    "CS2Cheats/main.cpp",
    "CS2Cheats/Core/Config.h",
    "upload_license_panel.ps1"
)

Write-Host "Добавление файлов..." -ForegroundColor Cyan

foreach ($file in $filesToAdd) {
    if (Test-Path $file) {
        git add $file
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Файл не найден: $file" -ForegroundColor Yellow
    }
}

# Добавляем .gitignore если его нет
if (Test-Path ".gitignore") {
    git add .gitignore
}

# Проверка статуса
Write-Host "`nПроверка статуса..." -ForegroundColor Cyan
git status --short

Write-Host "`n=== Готово к коммиту ===" -ForegroundColor Green
Write-Host "`nСледующие шаги:" -ForegroundColor Yellow
Write-Host "1. Проверьте изменения: git status"
Write-Host "2. Создайте коммит: git commit -m 'Add license panel and integration'"
Write-Host "3. Загрузите в репозиторий: git push mcheat2 main"
Write-Host "`nИли выполните автоматически:" -ForegroundColor Cyan
Write-Host "  git commit -m 'Add license panel and integration with MCheat'"
Write-Host "  git push mcheat2 main"

$auto = Read-Host "`nВыполнить коммит и push автоматически? (y/n)"
if ($auto -eq "y" -or $auto -eq "Y") {
    Write-Host "Создание коммита..." -ForegroundColor Cyan
    git commit -m "Add license panel and integration with MCheat"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Загрузка в репозиторий..." -ForegroundColor Cyan
        git push mcheat2 main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Успешно загружено в репозиторий!" -ForegroundColor Green
        } else {
            Write-Host "`n❌ Ошибка при загрузке. Проверьте права доступа." -ForegroundColor Red
        }
    } else {
        Write-Host "`n❌ Ошибка при создании коммита." -ForegroundColor Red
    }
}

