# MCP Lending Agent

A Model Context Protocol (MCP) implementation for AI-powered interaction with the 1Delta lending platform. Monorepo with three packages: an MCP server, a multi-provider AI client, and a React chat frontend with wallet integration.

## Architecture

```
Frontend (React/Vite) ──POST /chat──▶ Client (Node.js HTTP) ──stdio──▶ Backend (MCP Server)
                                             │                                  │
                                        AI Provider                       1Delta API
                                   (Anthropic / OpenAI / …)
```

```
packages/
├── backend/    # MCP Server — exposes 1Delta API as MCP tools
├── client/     # HTTP server — agentic AI loop, multi-provider bridge
└── frontend/   # Chat UI — wallet, tx executor, provider selector
```

See each package's README for details.

## Setup

### Prerequisites

- Node.js ≥ 18
- pnpm (latest)
- At least one AI provider API key (see `packages/client/.env.example`)

### Install & build

```bash
pnpm install
pnpm build
```

### Configure

```bash
cp packages/client/.env.example packages/client/.env
# Fill in at least one API key
```

```bash
# packages/frontend/.env
VITE_CLIENT_URL=http://localhost:3001
```

### Run

```bash
# All packages in watch mode:
pnpm dev

# Or individually:
cd packages/client && pnpm dev   # http://localhost:3001
cd packages/frontend && pnpm dev # http://localhost:3000
```

The backend is spawned automatically as a subprocess of the client.

## License

MIT
