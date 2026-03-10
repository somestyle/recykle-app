# syntax=docker/dockerfile:1

# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: Build the Next.js app ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output + static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the custom server and required lib files
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/lib ./lib

# Copy ws and @google/genai for the custom server
# (included via node_modules in standalone output, but ws needs to be explicit)
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

# Cloud Run uses PORT env variable
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["node", "server.js"]
