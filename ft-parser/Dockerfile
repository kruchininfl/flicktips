# ft-parser (rutor → TMDb/Кинопоиск/FastTorrent). Runs an hourly cron.
FROM node:16-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

COPY . .
RUN rm -rf dist && npx tsc

CMD ["node", "dist/app.js"]
