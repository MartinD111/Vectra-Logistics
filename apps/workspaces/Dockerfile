# Production image for the Workspaces app. Build from the REPO ROOT context:
#   docker build -f apps/workspaces/Dockerfile -t vectra-workspaces .

FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build --workspace @vectra/workspaces

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/.next/static ./apps/workspaces/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workspaces/public ./apps/workspaces/public

USER nextjs
EXPOSE 3001
ENV PORT 3001
ENV HOSTNAME "0.0.0.0"
CMD ["node", "apps/workspaces/server.js"]
