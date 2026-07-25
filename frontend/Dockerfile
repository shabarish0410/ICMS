# ─── Stage 1: Dependencies ─────────────────────────────────────────────────────
# Install node_modules separately so this layer is cached when source changes
FROM node:22-alpine AS deps

WORKDIR /app

# Only copy package files first — layer cache will be reused if they don't change
COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

# ─── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source
COPY . .

# Set production env for build
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build Next.js with standalone output
RUN npm run build

# ─── Stage 3: Runner ───────────────────────────────────────────────────────────
# Minimal runtime — only the standalone server, static files, and public assets
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="ICMS Frontend" \
      org.opencontainers.image.description="Spark Innovation Center — Next.js Frontend"

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy only what Next.js standalone mode needs
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]