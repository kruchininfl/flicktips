# web SSR (React/Redux) production image.
# node:16 is required: webpack 2.7 + node-sass 8, and OpenSSL 1.1 (no md4 issue).
FROM node:16 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:16-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/.babelrc ./.babelrc

EXPOSE 3001

CMD ["npm", "run", "server"]
