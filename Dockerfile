FROM node:20-bookworm-slim AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# 关键：确保 optional deps 不被跳过
ENV npm_config_optional=true
ENV npm_config_ignore_optional=false

RUN npm ci

# 关键：显式安装 lightningcss 的 platform binary（gnu）
# 这一步能兜底 npm ci 没拉到二进制的情况
RUN npm i -D @tailwindcss/node lightningcss \
 && node -e "console.log('node', process.version, process.platform, process.arch)" \
 && ls -la node_modules/lightningcss || true \
 && ls -la node_modules/lightningcss/node || true

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# 构建前再验证一次 binary 是否存在
RUN test -f node_modules/lightningcss/lightningcss.linux-x64-gnu.node \
 || (echo 'missing lightningcss binary' && ls -la node_modules/lightningcss && exit 1)

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
