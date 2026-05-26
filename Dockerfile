# Superpelu — imagen para VPS
FROM node:22-bookworm-slim

WORKDIR /app

# better-sqlite3 compila bindings nativos (ARM64 incluido)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/appointments.sqlite
ENV TZ=Europe/Madrid

EXPOSE 3001

VOLUME ["/app/data"]

CMD ["npm", "start"]
