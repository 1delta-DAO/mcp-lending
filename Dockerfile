# Client HTTP bridge — connects to the MCP server via Streamable HTTP, exposes chat API on port 3001.

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/client/package.json  ./packages/client/
# Stub other packages so the workspace resolves
RUN mkdir -p packages/backend packages/frontend && \
    echo '{"name":"@mcp-lending/backend","version":"0.1.0","type":"module"}' > packages/backend/package.json && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile

COPY packages/client/src          ./packages/client/src
COPY packages/client/tsconfig.json  ./packages/client/

RUN pnpm --filter @mcp-lending/client build

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/client/package.json  ./packages/client/
RUN mkdir -p packages/backend packages/frontend && \
    echo '{"name":"@mcp-lending/backend","version":"0.1.0","type":"module"}' > packages/backend/package.json && \
    echo '{"name":"@mcp-lending/frontend","version":"0.1.0","type":"module"}' > packages/frontend/package.json

RUN pnpm install --no-frozen-lockfile --prod

# Compiled output
COPY --from=builder /app/packages/client/dist  ./packages/client/dist

EXPOSE 3001
WORKDIR /app/packages/client
CMD ["node", "dist/index.js"]
