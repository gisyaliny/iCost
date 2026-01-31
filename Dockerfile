FROM node:20-bookworm-slim AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# 关键：确保 optional deps 不被跳过
ENV npm_config_optional=true
ENV npm_config_ignore_optional=false

RUN npm ci

# 针对 Tailwind 4 / lightningcss 的核心修复：显式安装对应的平台二进制包
RUN npm install --save-optional lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu

# 验证二进制是否存在（调试用，如果不存在会在此停止并报错）
RUN ls -la node_modules/lightningcss-linux-x64-gnu/*.node || (echo "LightningCSS binary not found!" && exit 1)
RUN ls -la node_modules/@tailwindcss/oxide-linux-x64-gnu/*.node || (echo "Tailwind Oxide binary not found!" && exit 1)

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN chmod +x docker-bootstrap.sh

# Ensure public directory exists even if empty in source
RUN mkdir -p public

RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/docker-bootstrap.sh ./docker-bootstrap.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用 bootstrap 脚本启动，确保数据库已初始化
CMD ["sh", "./docker-bootstrap.sh"]
