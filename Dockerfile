# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package-lock.json ./shared/
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefix shared \
 && npm ci --prefix client \
 && npm ci --prefix server

COPY shared ./shared
RUN npm run build --prefix shared

# --- Stage: React (Vite) ---
FROM base AS client-builder
COPY client ./client
RUN npm run build --prefix client

# --- Stage: Express (TypeScript) ---
FROM base AS server-builder
COPY server ./server
RUN npm run build --prefix server \
 && npm prune --omit=dev --prefix server

# --- Stage: production runtime ---
FROM node:22-bookworm-slim AS production

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY --from=base /app/shared/dist ./shared/dist

COPY server/package.json server/package-lock.json ./server/
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p server/data server/uploads/trips

ENV NODE_ENV=production
EXPOSE 8080

WORKDIR /app/server
CMD ["node", "dist/index.js"]
