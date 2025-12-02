# Интеграция системы лицензий с MCheat

## Структура проекта

Все файлы веб-панели находятся в папке `site/`:
- `site/backend/` - Node.js сервер
- `site/public/` - Frontend
- `site/config/` - Конфигурация

Файлы интеграции с MCheat остаются в корне:
- `CS2Cheats/Helpers/LicenseManager.h` - модуль лицензий
- `CS2Cheats/main.cpp` - проверка лицензии при запуске
- `CS2Cheats/Core/Config.h` - настройка URL сервера

## Что было сделано

### 1. Создана панель управления лицензиями
- **Backend** (Node.js + Express + SQLite) - в `site/backend/`
- **Frontend** (HTML/CSS/JavaScript) - в `site/public/`
- **REST API** для управления ключами
- **Клиентское API** для активации и проверки ключей

### 2. Интегрировано в MCheat

#### Новые файлы:
- `CS2Cheats/Helpers/LicenseManager.h` - модуль управления лицензиями

#### Изменённые файлы:
- `CS2Cheats/main.cpp` - добавлена проверка лицензии при запуске
- `CS2Cheats/Core/Config.h` - добавлен `LicenseServerURL` для настройки адреса сервера

## Как это работает

### При запуске MCheat:

1. **Проверка ключа**
   - Читает ключ из файла `Documents\MCheat\license.key`
   - Если ключа нет - показывает ошибку и закрывает приложение

2. **Проверка на сервере**
   - Отправляет запрос на `/api/check_key` с ключом и HWID
   - Проверяет:
     - Существует ли ключ
     - Не заблокирован ли
     - Не истёк ли срок
     - Совпадает ли HWID

3. **Активация (если нужно)**
   - Если проверка не прошла, пробует активировать ключ через `/api/activate_key`
   - Привязывает ключ к HWID компьютера

4. **Блокировка при ошибке**
   - Если лицензия невалидна - показывает ошибку и закрывает приложение
   - Если валидна - продолжает работу

### HWID (Hardware ID)

Формируется из:
- Серийный номер диска C:
- Имя компьютера
- Имя пользователя

Формат: `1234567890-COMPUTER-USERNAME`

## Настройка

### 1. Измените URL сервера

В файле `CS2Cheats/Core/Config.h`:

```cpp
inline std::string LicenseServerURL = "http://ваш-сервер:4000";
```

Или для Fly.io:
```cpp
inline std::string LicenseServerURL = "https://ваш-проект.fly.dev";
```

### 2. Создайте ключ в панели

1. Запустите сервер лицензий
2. Войдите в панель
3. Создайте ключ с нужным сроком действия
4. Скопируйте ключ

### 3. Добавьте ключ клиенту

Создайте файл: `Documents\MCheat\license.key`

Поместите туда ключ (например: `DEMO-KEY-XXXX-XXXX-XXXX`)

## Использование

### Для администратора:

1. Запустите сервер лицензий (локально или на хостинге)
2. Войдите в панель управления
3. Создавайте ключи с нужным сроком действия
4. Отдавайте ключи клиентам
5. Управляйте ключами (блокировка, продление, смена HWID)

### Для клиента:

1. Получите ключ от администратора
2. Создайте файл `Documents\MCheat\license.key` с ключом
3. Запустите MCheat - лицензия проверится автоматически

## API Endpoints

### Клиентское API (для MCheat):

- `POST /api/activate_key` - активация ключа
  ```json
  {
    "key": "DEMO-KEY-XXXX",
    "hwid": "PC-001"
  }
  ```

- `POST /api/check_key` - проверка ключа
  ```json
  {
    "key": "DEMO-KEY-XXXX",
    "hwid": "PC-001"
  }
  ```

- `GET /api/get_remaining_days?key=DEMO-KEY-XXXX` - остаток дней

## Безопасность

- Ключи привязываются к HWID (защита от копирования)
- Проверка при каждом запуске
- Блокировка при истечении срока
- Администратор может заблокировать ключ в любой момент

## Развертывание

См. файлы:
- `QUICK_START.md` - быстрый старт
- `DEPLOYMENT.md` - подробная инструкция
- `KEY_MANAGEMENT.md` - управление ключами

## Загрузка в репозиторий

Используйте скрипт:
```powershell
powershell -ExecutionPolicy Bypass -File upload_license_panel.ps1
```

Или вручную:
```bash
git add backend/ public/ config/ CS2Cheats/Helpers/LicenseManager.h CS2Cheats/main.cpp CS2Cheats/Core/Config.h
git commit -m "Add license panel and integration"
git push mcheat2 main
```

