# Frontend — built by Vite, served by nginx

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/
# Stubs so the workspace resolves without backend/client deps
RUN mkdir -p packages/backend packages/client && \
    echo '{"name":"@mcp-lending/backend","version":"0.1.0","type":"module"}' > packages/backend/package.json && \
    echo '{"name":"@mcp-lending/client","version":"0.1.0","type":"module"}'  > packages/client/package.json

RUN pnpm install --frozen-lockfile

COPY packages/frontend/ ./packages/frontend/

# Build-time env vars (baked into the static bundle)
ARG VITE_CLIENT_URL=http://localhost:3001
ARG VITE_BASE_PATH=/
ENV VITE_CLIENT_URL=$VITE_CLIENT_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN pnpm --filter @mcp-lending/frontend build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# SPA fallback — route all 404s to index.html for client-side routing
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
