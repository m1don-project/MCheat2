# Инструкция: Загрузка в GitHub и подключение к Fly.io

## Шаг 1: Загрузка в репозиторий GitHub

### Автоматически (рекомендуется):

```powershell
# Из корня проекта
powershell -ExecutionPolicy Bypass -File upload_license_panel.ps1
```

Скрипт:
- Добавит все файлы панели лицензий (`site/`)
- Добавит файлы интеграции с MCheat
- Создаст коммит
- Загрузит в репозиторий `m1don-project/MCheat2`

### Вручную:

```bash
# Добавить файлы
git add site/
git add CS2Cheats/Helpers/LicenseManager.h
git add CS2Cheats/main.cpp
git add CS2Cheats/Core/Config.h
git add upload_license_panel.ps1

# Создать коммит
git commit -m "Add license panel and integration with MCheat"

# Загрузить в репозиторий
git push mcheat2 main
```

Если репозиторий пустой, возможно нужно сначала создать ветку:
```bash
git branch -M main
git push -u mcheat2 main
```

## Шаг 2: Подключение к Fly.io

### 2.1. Установите Fly CLI

**Windows:**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Или через winget:
```powershell
winget install -e --id Fly.Flyctl
```

### 2.2. Войдите в Fly.io

```bash
fly auth login
```

Откроется браузер для авторизации через GitHub.

### 2.3. Создайте приложение через веб-интерфейс

1. Перейдите на https://fly.io/dashboard
2. Нажмите **"New App"** (или **"Create App"**)
3. Выберите **"GitHub"** как источник
4. Выберите ваш репозиторий: `m1don-project/MCheat2`
5. **Важно:** Укажите путь к приложению: `site`
6. Выберите регион (например, `iad` - Washington, D.C.)
7. Нажмите **"Deploy"**

### 2.4. Настройте секреты

После первого развертывания нужно установить секреты:

**Через веб-интерфейс:**
1. Откройте ваше приложение в Fly.io dashboard
2. Перейдите в **"Secrets"**
3. Добавьте:
   - `JWT_ACCESS_SECRET` = сгенерируйте: `openssl rand -hex 32`
   - `JWT_REFRESH_SECRET` = сгенерируйте: `openssl rand -hex 32`
   - `ADMIN_PASSWORD` = ваш пароль администратора

**Или через CLI:**
```bash
fly secrets set JWT_ACCESS_SECRET="ваш_секрет_1"
fly secrets set JWT_REFRESH_SECRET="ваш_секрет_2"
fly secrets set ADMIN_PASSWORD="ваш_пароль"
```

### 2.5. Получите URL приложения

После развертывания в дашборде Fly.io вы увидите URL вида:
```
https://your-app-name.fly.dev
```

Или через CLI:
```bash
fly status
```

## Шаг 3: Настройка MCheat

Откройте файл `CS2Cheats/Core/Config.h` и измените:

```cpp
inline std::string LicenseServerURL = "https://your-app-name.fly.dev";
```

Замените `your-app-name` на имя вашего приложения из Fly.io.

## Шаг 4: Проверка работы

### Проверка API:

```bash
curl https://your-app-name.fly.dev/api/health
```

Должен вернуть: `{"status":"ok","timestamp":"..."}`

### Проверка панели:

Откройте в браузере:
```
https://your-app-name.fly.dev/login.html
```

Войдите с:
- Логин: `m1don` (или из config.json)
- Пароль: тот, что установили в секретах Fly.io

## Обновление приложения

После изменений в коде:

```bash
# Загрузите изменения в GitHub
git push mcheat2 main

# Fly.io автоматически переразвернет приложение
# Или вручную:
cd site
fly deploy
```

## Полезные команды Fly.io

```bash
# Просмотр логов
fly logs

# Статус приложения
fly status

# SSH в контейнер
fly ssh console

# Просмотр секретов
fly secrets list

# Перезапуск
fly apps restart your-app-name
```

## Решение проблем

### Приложение не запускается

1. Проверьте логи: `fly logs`
2. Убедитесь, что секреты установлены: `fly secrets list`
3. Проверьте, что путь к приложению указан как `site`

### Ошибка "Cannot find module"

Убедитесь, что `package.json` находится в `site/backend/` и содержит все зависимости.

### База данных не создается

SQLite файлы создаются автоматически при первом запуске. Проверьте логи на наличие ошибок.

### Ошибки подключения из MCheat

- Проверьте URL в `CS2Cheats/Core/Config.h`
- Убедитесь, что используется HTTPS (не HTTP)
- Проверьте, что приложение запущено: `fly status`

## Структура для Fly.io

```
MCheat2/
└── site/              # Fly.io развертывает из этой папки
    ├── backend/       # Node.js сервер
    ├── public/       # Frontend
    ├── config/       # Конфигурация
    ├── Dockerfile    # Для Fly.io
    └── fly.toml      # Конфигурация Fly.io
```

## Дополнительная документация

- `site/Fly.io_DEPLOYMENT.md` - Подробная инструкция по развертыванию
- `site/README.md` - Общая информация о панели
- `site/QUICK_START.md` - Быстрый старт

