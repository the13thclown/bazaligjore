# ── Stage 1: build the single-file MCP App UI ────────────────────────────────
FROM node:22-alpine AS ui-builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY vite.config.ts ./
COPY ui/ ui/
RUN npm run build:ui

# ── Stage 2: runtime (tsx executes the TS sources directly) ───────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/
COPY knowledge/ knowledge/
COPY tsconfig.json ./
COPY --from=ui-builder /build/dist/ui/ dist/ui/
EXPOSE 3200
CMD ["npx", "tsx", "src/index.ts"]
