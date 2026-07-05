# Builds and runs the Express + Socket.IO backend. The build context for this Dockerfile is
# the MONOREPO ROOT (not apps/server) — it needs sibling access to packages/shared. On
# Railway: leave the service's Root Directory as the repo root and set the Dockerfile path to
# apps/server/Dockerfile (see railway.json alongside this file).

FROM node:20-alpine AS build
WORKDIR /app

# Copy just the manifests first so `npm ci` is cached unless a dependency actually changed.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Same base image for build and runtime so the Prisma query engine generated during `npm ci`
# (in the build stage) matches this stage's platform (linux-musl) — no binaryTargets override
# needed in schema.prisma.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server

WORKDIR /app/apps/server
EXPOSE 4000

# `prisma migrate deploy` applies any pending migrations before the server starts, so a fresh
# deploy (or a restart) always runs against the current schema — no manual migration step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
