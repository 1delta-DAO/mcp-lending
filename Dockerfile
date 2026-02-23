# Client + Backend service
# The client HTTP server (port 3001) spawns the backend MCP server as a child process.

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/client/package.json  ./packages/client/
# Stub frontend so the workspace resolves — deps differ from lockfile so skip frozen check
RUN mkdir -p packages/frontend && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' \
    > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile

# Copy source
COPY packages/backend/src         ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/client/src          ./packages/client/src
COPY packages/client/tsconfig.json  ./packages/client/

RUN pnpm --filter @mcp-lending/backend build && \
    pnpm --filter @mcp-lending/client  build

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/client/package.json  ./packages/client/
RUN mkdir -p packages/frontend && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' \
    > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile --prod

# Compiled output
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/client/dist  ./packages/client/dist

EXPOSE 3001
WORKDIR /app/packages/client
CMD ["node", "dist/index.js"]
