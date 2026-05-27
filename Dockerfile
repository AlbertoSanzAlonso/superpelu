# Superpelu — imagen para VPS
FROM node:22-bookworm-slim

# Coolify comprueba GET /api/health con wget; HEALTHCHECK interno usa curl
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Europe/Madrid

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

CMD ["npm", "start"]
