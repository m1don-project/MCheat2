# Dockerfile для панели лицензий на Fly.io

FROM node:18-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY backend/package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем весь код
COPY backend/ ./backend/
COPY public/ ./public/
COPY config/ ./config/

# Создаем директорию для БД
RUN mkdir -p ./backend/database

# Устанавливаем рабочую директорию
WORKDIR /app/backend

# Открываем порт
EXPOSE 4000

# Запускаем приложение
CMD ["node", "server.js"]

