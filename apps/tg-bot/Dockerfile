# tg-bot: @FlickTipsBot, posts FlickTips ratings to Telegram groups (long polling, no open ports).
# Build from the repository root (the workspace packages are needed):
#   docker build -f apps/tg-bot/Dockerfile .
FROM node:22-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /repo

# lockfile and manifests first, so the install layer is cached until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY apps/tg-bot/package.json apps/tg-bot/
RUN pnpm install --frozen-lockfile --filter @flicktips/tg-bot...

COPY packages/config packages/config
COPY packages/db packages/db
COPY apps/tg-bot apps/tg-bot
RUN pnpm --filter @flicktips/db build \
 && pnpm --filter @flicktips/tg-bot build \
 && pnpm --filter @flicktips/tg-bot deploy --legacy --prod /out

FROM node:22-slim

WORKDIR /app
COPY --from=build /out ./

CMD ["node", "dist/app.js"]
