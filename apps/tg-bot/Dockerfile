# tg-bot: @FlickTipsBot, posts FlickTips ratings to Telegram groups (long polling, no open ports).
# Build from the repository root (the workspace packages are needed):
#   docker build -f apps/tg-bot/Dockerfile .
#   docker build -f apps/tg-bot/Dockerfile --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim .
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build

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

FROM ${NODE_IMAGE}

ENV NODE_ENV=production

WORKDIR /app
COPY --from=build --chown=node:node /out ./

USER node

CMD ["node", "dist/app.js"]
