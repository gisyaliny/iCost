FROM node:20-bookworm-slim AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# 关键：确保 optional deps 不被跳过
ENV npm_config_optional=true
ENV npm_config_ignore_optional=false

RUN npm ci

# 针对 Tailwind 4 / lightningcss 的核心修复：显式安装对应的平台二进制包
RUN npm install --save-optional lightningcss-linux-x64-gnu

# 验证二进制是否存在（调试用，如果不存在会在此停止并报错）
RUN ls -la node_modules/lightningcss-linux-x64-gnu/*.node || (echo "Binary not found!" && exit 1)

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node","server.js"]
