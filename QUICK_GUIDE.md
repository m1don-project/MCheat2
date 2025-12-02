# Быстрая инструкция: Загрузка в GitHub и Fly.io

## 🚀 Шаг 1: Загрузка в GitHub

```powershell
# Запустите скрипт
powershell -ExecutionPolicy Bypass -File upload_license_panel.ps1

# Ответьте "y" на вопрос о автоматическом коммите и push
```

Или вручную:
```bash
git add site/ CS2Cheats/Helpers/LicenseManager.h CS2Cheats/main.cpp CS2Cheats/Core/Config.h .gitignore upload_license_panel.ps1 GITHUB_FLYIO_SETUP.md
git commit -m "Add license panel and integration with MCheat"
git push mcheat2 main
```

## 🌐 Шаг 2: Подключение к Fly.io

### 2.1. Установите Fly CLI
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### 2.2. Войдите
```bash
fly auth login
```

### 2.3. Создайте приложение через веб-интерфейс

1. Откройте https://fly.io/dashboard
2. Нажмите **"New App"**
3. Выберите **"GitHub"**
4. Выберите репозиторий: `m1don-project/MCheat2`
5. **ВАЖНО:** Укажите путь: `site`
6. Выберите регион (например, `iad`)
7. Нажмите **"Deploy"**

### 2.4. Установите секреты

После развертывания в настройках приложения добавьте:

- `JWT_ACCESS_SECRET` = сгенерируйте: `openssl rand -hex 32`
- `JWT_REFRESH_SECRET` = сгенерируйте: `openssl rand -hex 32`  
- `ADMIN_PASSWORD` = ваш пароль

Или через CLI:
```bash
fly secrets set JWT_ACCESS_SECRET="ваш_секрет"
fly secrets set JWT_REFRESH_SECRET="ваш_секрет"
fly secrets set ADMIN_PASSWORD="ваш_пароль"
```

### 2.5. Получите URL

В дашборде Fly.io вы увидите: `https://your-app-name.fly.dev`

## ⚙️ Шаг 3: Настройка MCheat

Откройте `CS2Cheats/Core/Config.h`:

```cpp
inline std::string LicenseServerURL = "https://your-app-name.fly.dev";
```

## ✅ Проверка

```bash
# Проверка API
curl https://your-app-name.fly.dev/api/health

# Откройте панель
https://your-app-name.fly.dev/login.html
```

## 📚 Подробная документация

- `GITHUB_FLYIO_SETUP.md` - Полная инструкция
- `site/Fly.io_DEPLOYMENT.md` - Детали развертывания
- `site/README.md` - О панели лицензий

