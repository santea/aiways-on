# Portal 이미지 — **U1 소유** (UOW-7).
# 5개 유닛의 코드를 함께 담으므로 단일 소유자가 필요하다. 다른 서비스의 Dockerfile 은
# 각 코드 소유 유닛(U3·U6)이 소유한다.
#
# 워크스페이스 루트를 컨텍스트로 빌드한다: docker build -f apps/portal/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── 의존성 ───────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/portal/package.json apps/portal/
COPY packages/contracts/package.json packages/contracts/
COPY packages/lib/package.json packages/lib/
RUN pnpm install --frozen-lockfile

# ── 빌드 ─────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/portal/node_modules ./apps/portal/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# 빌드 시점 자리표시자. 실행 시에는 K8s Secret 이 실제 값을 주입한다.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV AUTH_SECRET=build-placeholder
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @aiways/portal build

# ── 실행 ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 비루트 실행 (NFR-20, SECURITY-09)
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/apps/portal/.next ./apps/portal/.next
COPY --from=build --chown=nextjs:nodejs /app/apps/portal/public ./apps/portal/public
COPY --from=build --chown=nextjs:nodejs /app/apps/portal/package.json ./apps/portal/
COPY --from=build --chown=nextjs:nodejs /app/packages ./packages
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/apps/portal/node_modules ./apps/portal/node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json /app/pnpm-workspace.yaml ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start", "apps/portal"]
