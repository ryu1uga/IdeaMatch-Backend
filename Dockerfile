# syntax=docker/dockerfile:1

# =============================================================================
#  IdeaMatch Backend - imagen de producción
# =============================================================================
ARG NODE_VERSION=22

# ---------- base: Node + OpenSSL (lo necesita el motor de migraciones de Prisma)
FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---------- deps: instala TODAS las dependencias (incluye las de desarrollo)
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# El postinstall ejecuta `prisma generate`
RUN npm ci

# ---------- build: compila TypeScript y deja solo dependencias de producción
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

# ---------- runner: imagen final, liviana y sin código fuente
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Al arrancar: aplica migraciones -> carga catálogos (si SEED_ON_START=true) -> inicia la API
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then node dist/db/seed.js; fi && exec node dist/server.js"]
