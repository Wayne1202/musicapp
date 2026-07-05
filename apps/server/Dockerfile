# Builds and runs the Express + Socket.IO backend. The build context for this Dockerfile is
# the MONOREPO ROOT (not apps/server) — it needs sibling access to packages/shared. On
# Railway: leave the service's Root Directory as the repo root and set the Dockerfile path to
# apps/server/Dockerfile (see railway.json alongside this file).

FROM node:20-slim AS build
WORKDIR /app

# node:20-slim doesn't ship libssl either — Prisma's engine binary needs it present (and
# needs it present *now*, before `npm ci`/`prisma generate` run below) so it can correctly
# detect the OpenSSL version and pick/generate the matching engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy just the manifests first so `npm ci` is cached unless a dependency actually changed.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/server apps/server

# `npm ci` above ran before prisma/schema.prisma existed in the image (it's only in the
# manifest-first layer for caching), so @prisma/client's install-time codegen had nothing to
# read and produced an empty client. Generate explicitly now that the schema is present.
RUN npm run db:generate --workspace=apps/server

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Same base image (+ openssl) as the build stage, for the same reason: the engine binary
# generated above needs libssl actually present at runtime, not just at generate-time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server

WORKDIR /app/apps/server
EXPOSE 4000

# `prisma migrate deploy` applies any pending migrations before the server starts, so a fresh
# deploy (or a restart) always runs against the current schema — no manual migration step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
