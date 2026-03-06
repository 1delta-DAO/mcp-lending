# MCP Server (standalone Streamable HTTP service on port 3002)

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/backend/package.json ./packages/backend/
# Stub other packages so the workspace resolves
RUN mkdir -p packages/client packages/frontend && \
    echo '{"name":"@mcp-lending/client","version":"0.1.0","type":"module"}' > packages/client/package.json && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile

COPY packages/backend/src         ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/

RUN pnpm --filter @mcp-lending/backend build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
RUN mkdir -p packages/client packages/frontend && \
    echo '{"name":"@mcp-lending/client","version":"0.1.0","type":"module"}' > packages/client/package.json && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

EXPOSE 3002
WORKDIR /app/packages/backend
CMD ["node", "dist/index.js"]
