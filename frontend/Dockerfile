# syntax=docker/dockerfile:1

# ---- deps: install node_modules ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Use `npm install` (not `npm ci`): the Windows-generated lockfile lacks the
# Linux-only optional deps of Tailwind v4's native module (@emnapi/*), which
# npm ci treats as a fatal mismatch. npm install resolves them per-platform.
RUN npm install --no-audit --no-fund

# ---- builder: compile the Next app ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined at BUILD time, so they must be passed as build args.
# Server-only secrets (AUTH_*, DEMO_XUID) are NOT baked in — they're read at runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output bundles only what's needed to run `node server.js`
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
