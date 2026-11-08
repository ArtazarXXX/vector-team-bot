#!/usr/bin/env bash
set -e

# Скрипт сборки и запуска Docker-образа чат-бота «ВЕКТОР»
# Команда: Брянчане. Проект: ВЕКТОР. Хакатон: «Идея фикс»

IMAGE_NAME="vector-max-bot:latest"
CONTAINER_NAME="vector-max-bot"

echo "=========================================================="
echo "🚀 Сборка и запуск Docker-контейнера «ВЕКТОР»"
echo "=========================================================="

# 1. Проверяем наличие .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️ Файл .env не найден, копируем из .env.example..."
    cp .env.example .env
    echo "❗ Пожалуйста, укажите валидный BOT_TOKEN в файле .env перед запуском."
  else
    echo "❌ Ошибка: файл конфигурации .env не найден."
    exit 1
  fi
fi

# 2. Создаем директорию для БД SQLite, если ее нет
mkdir -p data

# 3. Сборка Docker-образа
echo "🔨 Сборка Docker-образа ($IMAGE_NAME)..."
docker build -t "$IMAGE_NAME" .

# 4. Остановка старого контейнера при наличии
if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
  echo "🛑 Остановка предыдущего контейнера $CONTAINER_NAME..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# 5. Запуск контейнера через Docker CLI
echo "▶️ Запуск контейнера $CONTAINER_NAME через командную строку..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  "$IMAGE_NAME"

echo "=========================================================="
echo "✅ Контейнер успешно запущен!"
echo "📋 Просмотр логов в реальном времени:"
echo "   docker logs -f $CONTAINER_NAME"
echo "🛑 Остановка контейнера:"
echo "   docker stop $CONTAINER_NAME"
echo "=========================================================="
