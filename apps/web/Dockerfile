# web: the Next.js site (@flicktips/web, `output: standalone`), replaces the legacy web/. Build from the repository
# root (the workspace packages are needed):
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://flicktips.ru --build-arg API_INTERNAL_URL=http://127.0.0.1:3102 .
#
# Both URLs are baked in at BUILD time, so an image belongs to one site (prod or the test domain):
# - NEXT_PUBLIC_SITE_URL is inlined into the server and browser bundles (canonical/og URLs, invite links, robots.txt);
# - API_INTERNAL_URL is written into the routes manifest by the /api and /auth rewrites of next.config.ts (used only
#   when a request reaches Next.js without nginx). Server components read API_INTERNAL_URL again at run time
#   (src/api/server.ts), so the compose file must pass the same value.
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

WORKDIR /repo

# lockfile and manifests first, so the install layer is cached until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @flicktips/web...

COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web

ARG NEXT_PUBLIC_SITE_URL=https://flicktips.ru
ARG API_INTERNAL_URL=http://127.0.0.1:3102
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    API_INTERNAL_URL=${API_INTERNAL_URL}

RUN pnpm --filter @flicktips/web^... build \
 && pnpm --filter @flicktips/web build \
 # standalone has server.js and the traced node_modules; static assets and public/ are copied next to it
 && mkdir -p /out \
 && cp -a apps/web/.next/standalone/. /out/ \
 && mkdir -p /out/apps/web/.next \
 && cp -a apps/web/.next/static /out/apps/web/.next/static \
 && cp -a apps/web/public /out/apps/web/public

FROM ${NODE_IMAGE}

ARG NEXT_PUBLIC_SITE_URL=https://flicktips.ru
ARG API_INTERNAL_URL=http://127.0.0.1:3102
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    HOSTNAME=0.0.0.0 \
    PORT=3001

# docker/v2.sh compares these with the target's .env before switching, so a test image never lands on prod
LABEL ru.flicktips.site-url="${NEXT_PUBLIC_SITE_URL}" \
      ru.flicktips.api-internal-url="${API_INTERNAL_URL}"

WORKDIR /app
COPY --from=build --chown=node:node /out ./

USER node
EXPOSE 3001

# robots.txt is rendered by Next.js without calling the API, so this checks the Node server alone
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "apps/web/server.js"]
