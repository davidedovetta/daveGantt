# Single image: Fastify serves the API under /api and the built web app on the same origin.
FROM node:22-slim

# OpenSSL is needed by the Prisma schema engine (migrations at startup).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# Dependencies first, for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
# `prisma generate` only reads the schema; the URL is a placeholder.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @davegantt/api db:generate \
  && pnpm --filter @davegantt/web build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    WEB_DIST_DIR=/app/apps/web/dist

EXPOSE 3001

# Apply pending migrations, then start the server.
CMD ["sh", "-c", "pnpm --filter @davegantt/api db:deploy && exec pnpm --filter @davegantt/api start"]
