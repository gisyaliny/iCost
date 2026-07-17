FROM node:20-bookworm AS base
RUN apt-get update && apt-get install -y openssl libssl3 ca-certificates libc6 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# 关键：确保 optional deps 不被跳过
ENV npm_config_optional=true
ENV npm_config_ignore_optional=false

RUN npm ci

# Ensure Tailwind/LightningCSS native packages match the NAS CPU architecture.
RUN arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) css_arch="x64" ;; \
      arm64) css_arch="arm64" ;; \
      *) echo "Unsupported Docker architecture: $arch"; exit 1 ;; \
    esac; \
    npm install --no-save "lightningcss-linux-${css_arch}-gnu" "@tailwindcss/oxide-linux-${css_arch}-gnu"; \
    test -n "$(find "node_modules/lightningcss-linux-${css_arch}-gnu" -name '*.node' -print -quit)"; \
    test -n "$(find "node_modules/@tailwindcss/oxide-linux-${css_arch}-gnu" -name '*.node' -print -quit)"

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
ENV PRISMA_CLIENT_ENGINE_TYPE=library

RUN chmod +x docker-bootstrap.sh

# Ensure public directory exists even if empty in source
RUN mkdir -p public

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
ENV PRISMA_CLIENT_ENGINE_TYPE=library

# Ensure the database directory exists and is owned by the app user
# This is where the SQLite database will be stored
RUN mkdir -p /app/database /app/imports

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 -m nextjs \
    && chown -R nextjs:nodejs /home/nextjs \
    && chown -R nextjs:nodejs /app/database \
    && chown -R nextjs:nodejs /app/imports

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/docker-bootstrap.sh ./docker-bootstrap.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy Prisma schema and engines for runtime DB initialization
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Fix for Prisma binary targets in standard Node images
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
ENV PRISMA_CLIENT_ENGINE_TYPE=library

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用 bootstrap 脚本启动，确保数据库已初始化
CMD ["sh", "./docker-bootstrap.sh"]
