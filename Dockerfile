# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache bash coreutils
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
# BUILD_TARGET=node desliga o plugin da Cloudflare e emite dist/standalone/
ENV BUILD_TARGET=node
RUN npx vinext build
RUN npx esbuild scripts/migrate-vps.mjs --bundle --platform=node --format=esm --outfile=migrate-vps.mjs
RUN npx esbuild scripts/check-auth.ts --bundle --platform=node --format=esm --outfile=check-auth.mjs

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    VINEXT_TRUSTED_HOSTS=ebooks.41tech.cloud

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S sambu -G nodejs

# O standalone ja traz as dependencias de runtime embutidas.
COPY --from=build --chown=sambu:nodejs /app/dist/standalone ./

COPY --from=build --chown=sambu:nodejs /app/migrate-vps.mjs ./scripts/migrate-vps.mjs
COPY --from=build --chown=sambu:nodejs /app/check-auth.mjs ./scripts/check-auth.mjs
COPY --from=build --chown=sambu:nodejs /app/scripts/start-vps.sh ./scripts/start-vps.sh
COPY --from=build --chown=sambu:nodejs /app/drizzle ./drizzle

USER sambu
EXPOSE 3000

CMD ["sh", "scripts/start-vps.sh"]
