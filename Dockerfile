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

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S sambu -G nodejs

# O standalone ja traz as dependencias de runtime embutidas.
COPY --from=build --chown=sambu:nodejs /app/dist/standalone ./

USER sambu
EXPOSE 3000

CMD ["node", "server.js"]
