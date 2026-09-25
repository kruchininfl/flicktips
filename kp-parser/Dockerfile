# kp-parser (Кинопоиск metadata parser). Runs forever, polling the DB.
FROM node:16-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["node", "_app.js"]
