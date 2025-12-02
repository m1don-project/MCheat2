# Развертывание на Fly.io

## Подготовка

### 1. Установите Fly CLI

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Или через winget:**
```powershell
winget install -e --id Fly.Flyctl
```

### 2. Войдите в Fly.io

```bash
fly auth login
```

Откроется браузер для авторизации через GitHub.

## Развертывание

### Вариант 1: Через GitHub (рекомендуется)

1. **Загрузите код в репозиторий:**
   ```powershell
   # Из корня проекта
   powershell -ExecutionPolicy Bypass -File upload_license_panel.ps1
   ```

2. **На Fly.io:**
   - Перейдите на https://fly.io/dashboard
   - Нажмите "New App"
   - Выберите "GitHub" как источник
   - Выберите ваш репозиторий `m1don-project/MCheat2`
   - Укажите путь к приложению: `site`
   - Нажмите "Deploy"

3. **Настройте переменные окружения:**
   - В настройках приложения добавьте секреты:
     ```
     JWT_ACCESS_SECRET=ваш_секрет_1
     JWT_REFRESH_SECRET=ваш_секрет_2
     ADMIN_PASSWORD=ваш_пароль
     ```

### Вариант 2: Через Fly CLI

1. **Инициализация приложения:**
   ```bash
   cd site
   fly launch
   ```
   
   - Выберите регион (например, `iad` - Washington, D.C.)
   - Создайте новое приложение или используйте существующее
   - Не развертывайте сразу (скажите "no")

2. **Настройте fly.toml:**
   - Откройте `site/fly.toml`
   - Измените `app = "your-app-name"` на имя вашего приложения

3. **Установите секреты:**
   ```bash
   fly secrets set JWT_ACCESS_SECRET="ваш_секрет_1"
   fly secrets set JWT_REFRESH_SECRET="ваш_секрет_2"
   fly secrets set ADMIN_PASSWORD="ваш_пароль"
   ```

4. **Разверните:**
   ```bash
   fly deploy
   ```

## Настройка config.json для Fly.io

Fly.io использует переменные окружения. Обновите `site/backend/server.js` чтобы читать секреты из переменных окружения:

```javascript
const config = {
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 4000
  },
  security: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || configFromFile.security.jwtAccessSecret,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || configFromFile.security.jwtRefreshSecret,
    // ...
  },
  defaults: {
    bootstrapAdminPassword: process.env.ADMIN_PASSWORD || configFromFile.defaults.bootstrapAdminPassword
  }
};
```

Или создайте `site/backend/server.js` который читает из `config.json`, но переопределяет секреты из переменных окружения.

## Получение URL приложения

После развертывания:

```bash
fly status
```

Или в дашборде Fly.io вы увидите URL вида: `https://your-app-name.fly.dev`

## Обновление приложения

После изменений в коде:

```bash
cd site
fly deploy
```

Или через GitHub - автоматически при push в main ветку.

## Проверка работы

```bash
# Проверка здоровья
curl https://your-app-name.fly.dev/api/health

# Должен вернуть: {"status":"ok","timestamp":"..."}
```

## Настройка в MCheat

В файле `CS2Cheats/Core/Config.h` измените:

```cpp
inline std::string LicenseServerURL = "https://your-app-name.fly.dev";
```

## Полезные команды

```bash
# Просмотр логов
fly logs

# SSH в контейнер
fly ssh console

# Масштабирование
fly scale count 1

# Просмотр статуса
fly status
```

## Решение проблем

### Приложение не запускается

1. Проверьте логи: `fly logs`
2. Убедитесь, что секреты установлены: `fly secrets list`
3. Проверьте, что порт 4000 открыт в `fly.toml`

### База данных не создается

SQLite файлы в Fly.io хранятся в `/app/backend/database/`. Убедитесь, что директория существует и доступна для записи.

### Ошибки подключения

- Проверьте, что приложение запущено: `fly status`
- Проверьте URL в конфигурации MCheat
- Убедитесь, что используется HTTPS (Fly.io автоматически предоставляет SSL)

