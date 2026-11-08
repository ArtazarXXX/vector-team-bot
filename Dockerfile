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

# Create data directory for SQLite database file
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
