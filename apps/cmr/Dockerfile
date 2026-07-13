# Production image for the CMR Manager app. Build from the REPO ROOT context:
#   docker build -f apps/cmr/Dockerfile -t vectra-cmr .

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
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @vectra/cmr

FROM base AS runner
ARG VERSION=unknown
LABEL org.opencontainers.image.version=$VERSION
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/cmr/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/cmr/.next/static ./apps/cmr/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/cmr/public ./apps/cmr/public

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/cmr/server.js"]
