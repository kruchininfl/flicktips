# tg-bot: @FlickTipsBot, posts FlickTips ratings to Telegram groups (long polling, no open ports).
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

CMD ["node", "dist/app.js"]
