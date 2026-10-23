# api: the Fastify API (@flicktips/api), replaces the PHP api/. Build from the repository root (the workspace
# packages are needed):
#   docker build -f apps/api/Dockerfile .
#   docker build -f apps/api/Dockerfile --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim .
# Config comes from the environment at run time (apps/api/src/config.ts; docs/v2-deploy.md), never from the image.
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /repo

# lockfile and manifests first, so the install layer is cached until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/kinopoisk/package.json packages/kinopoisk/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @flicktips/api...

COPY packages/config packages/config
COPY packages/db packages/db
COPY packages/kinopoisk packages/kinopoisk
COPY packages/shared packages/shared
COPY apps/api apps/api
# internal packages first (they compile to dist/), then the API; `deploy` copies the API with its production
# dependencies only (workspace packages included as plain copies) into /out
RUN pnpm --filter @flicktips/api^... build \
 && pnpm --filter @flicktips/api build \
 && pnpm --filter @flicktips/api deploy --legacy --prod /out \
 && rm -rf /out/src /out/test /out/docs /out/tsconfig*.json /out/eslint.config.js /out/Dockerfile*

FROM ${NODE_IMAGE}

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3002

WORKDIR /app
COPY --from=build --chown=node:node /out ./

USER node
EXPOSE 3002

# liveness only: /api/health answers 200 also when the DB is down ({"db":"down"}); Node 22 has fetch built in
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||3002)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
