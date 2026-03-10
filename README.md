# MCP Lending Agent

An AI-powered chat interface for the [1Delta](https://1delta.io) DeFi lending aggregator, built on the [Model Context Protocol](https://modelcontextprotocol.io). Ask in plain English to explore markets, check positions, and execute deposits, withdrawals, borrows, and repayments — the agent handles market lookups, amount conversions, and transaction building automatically.

## Architecture

```
Frontend (React/Vite) ──POST /chat──▶ Client (Node.js HTTP) ──stdio──▶ Backend (MCP Server)
                                             │                                  │
                                        AI Provider                       1Delta API
                                   (Anthropic / OpenAI / …)
```

```
packages/
├── backend/    # MCP Server — exposes 1Delta API as MCP tools (runs on Cloudflare Workers)
├── client/     # HTTP server — agentic tool-use loop, multi-provider AI bridge
└── frontend/   # Chat UI — wallet connection, transaction executor, provider selector
```

See each package's README for details.

## Key features

- **Multi-provider AI** — switch between Anthropic, OpenAI, Google, Groq, Mistral, and DeepSeek per message
- **Wallet integration** — connect MetaMask (or any injected wallet); the agent queries your live positions automatically
- **Transaction executor** — agent returns calldata; the UI submits each step sequentially with automatic chain switching
- **Amount conversion** — `convert_amount` tool translates human-readable token or USD amounts to on-chain base units before every action; the agent always uses it
- **34 supported chains** — all chains supported by 1Delta
- **Rate limit transparency** — 429 errors from the 1Delta API are surfaced to the AI with instructions to request an API key

## Setup

### Prerequisites

- Node.js ≥ 18
- pnpm (latest)
- At least one AI provider API key (see `packages/client/.env.example`)
- A 1Delta API key is optional but recommended — get one at [auth.1delta.io](https://auth.1delta.io)

### Install & build

```bash
pnpm install
pnpm build
```

### Configure

```bash
cp packages/client/.env.example packages/client/.env
# Fill in at least one AI provider API key
# Optionally set ONEDELTA_API_KEY for higher 1Delta API rate limits
```

```bash
# packages/frontend/.env
VITE_CLIENT_URL=http://localhost:3001
```

### Run

```bash
# Start the MCP server (Cloudflare Worker, local dev):
pnpm dev:worker    # http://localhost:8787

# Start the client (separate terminal):
pnpm dev:client    # http://localhost:3001

# Start the frontend (separate terminal):
pnpm dev:frontend  # http://localhost:3000
```

## License

MIT
