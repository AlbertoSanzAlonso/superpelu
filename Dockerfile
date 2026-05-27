# Superpelu — imagen para VPS
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Europe/Madrid

EXPOSE 3001

CMD ["npm", "start"]
