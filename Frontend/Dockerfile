# =============================================================================
# Frontend Dockerfile — Multi-Stage Build
# Produces a lean production Next.js standalone image
# =============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfiles for layer caching
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install with npm (fallback to pnpm if lock exists)
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    npm ci; \
  fi

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for environment variables baked at build time
ARG NEXT_PUBLIC_API_URL=https://api.lifescienceaiagents.com
ARG NEXT_PUBLIC_SPOKE_ID=spoke-a
ARG NEXT_PUBLIC_N8N_WORKER_URL=http://localhost:5679

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SPOKE_ID=$NEXT_PUBLIC_SPOKE_ID
ENV NEXT_PUBLIC_N8N_WORKER_URL=$NEXT_PUBLIC_N8N_WORKER_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    npm run build; \
  fi

# ── Stage 3: Runner (Standalone) ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
