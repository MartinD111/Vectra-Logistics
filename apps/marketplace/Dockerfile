# Production image for the Marketplace app. Build from the REPO ROOT context:
#   docker build -f apps/marketplace/Dockerfile -t vectra-marketplace .
# (root context is required so the workspace packages in packages/* resolve.)

FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat

# ── Install the whole workspace ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

# ── Build just this app ──────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @vectra/marketplace

# ── Runner (Next standalone) ─────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next standalone for a monorepo emits the server under the app's path.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/marketplace/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/marketplace/.next/static ./apps/marketplace/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/marketplace/public ./apps/marketplace/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/marketplace/server.js"]
