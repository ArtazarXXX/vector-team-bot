# Multi-stage Dockerfile for «ВЕКТОР» MAX Bot with SQLite support
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Production image
FROM node:22-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create data directory with full read/write permissions for SQLite
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Ensure data directory is writable on container startup (especially when volumes are mounted in cloud VPS/containers)
CMD ["sh", "-c", "mkdir -p /app/data && chmod 777 /app/data 2>/dev/null || true; node dist/index.js"]

