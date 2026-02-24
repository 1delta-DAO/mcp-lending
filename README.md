# MCP Lending Agent

A complete Model Context Protocol (MCP) implementation for AI-powered interaction with a lending platform API. This monorepo contains an MCP server, a multi-provider AI client, and a minimal chat frontend.

## Architecture Overview

This project is a monorepo using `pnpm` workspaces with three main packages:

```
mcp-lending-agent/
├── packages/
│   ├── backend/      # MCP Server (TypeScript/Node.js)
│   ├── client/       # MCP Client + Claude Integration (TypeScript/Node.js)
│   └── frontend/     # Chat UI (React/Vite)
├── package.json      # Root workspace config
├── pnpm-workspace.yaml
└── tsconfig.json     # Shared TypeScript config
```

## Packages

### Backend (MCP Server)

**Location:** `packages/backend`

A TypeScript MCP server that exposes the 1Delta lending API through MCP tools. This server acts as the bridge between Claude AI and the lending platform.

**Key Features:**
- 8 MCP tools for lending interactions
- Real-time API integration with 1Delta
- Support for deposit, withdraw, borrow, and repay operations
- User position tracking and market data retrieval
- Clean tool definitions with input validation

**Available Tools:**
1. `get_lending_markets` - Browse available lending pools and markets
2. `get_user_positions` - Fetch user's lending/borrowing positions
3. `get_deposit_calldata` - Generate deposit transaction calldata
4. `get_withdraw_calldata` - Generate withdrawal transaction calldata
5. `get_borrow_calldata` - Generate borrow transaction calldata
6. `get_repay_calldata` - Generate repay transaction calldata
7. `get_token_balances` - Fetch user token balances
8. `get_supported_chains` - List supported blockchain networks
9. `get_lender_ids` - List supported lending protocols

### Client (MCP Client + AI Provider)

**Location:** `packages/client`

A TypeScript application that:
- Connects to the MCP backend server
- Integrates with a configurable AI provider (Anthropic, Google, Groq, Mistral, DeepSeek)
- Implements an agentic loop for tool use

**Architecture:**
1. Initializes MCP client connection to the backend server
2. Retrieves available tools from MCP server
3. Sends user queries to the AI provider with tool definitions
4. Executes tool calls and collects results
5. Continues conversation until the AI provides a final response

### Frontend (Chat UI)

**Location:** `packages/frontend`

A minimal React + Vite application providing a chat interface for the lending agent.

**Features:**
- Clean, responsive chat UI with Tailwind CSS
- Message history with timestamps
- Real-time typing indicators
- Ready for backend API integration

## Setup Instructions

### Prerequisites

- **Node.js:** 18.0.0 or higher
- **pnpm:** Latest version
- **API Keys:** One of `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY` depending on your chosen provider (see `packages/client/.env.example`)

### Installation

1. **Clone/Navigate to the repository:**
```bash
cd /home/caglavol/Repos/MCP
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Build all packages:**
```bash
pnpm build
```

## Running the Project

### Option 1: Run All Packages with Dev Mode

```bash
pnpm dev
```

This runs dev servers for all packages in watch mode.

### Option 2: Run Individually

#### Backend (MCP Server)

```bash
cd packages/backend
pnpm dev
# or to build and run:
pnpm build && pnpm start
```

The server listens on stdio for MCP protocol messages.

#### Client (MCP + AI Provider)

```bash
cd packages/client
cp .env.example .env   # set AI_PROVIDER and the corresponding API key
pnpm dev
```

#### Frontend (Chat UI)

```bash
cd packages/frontend
pnpm dev
```

Opens at `http://localhost:3000`

## API Integration Details

### 1Delta Lending API

The backend server integrates with the 1Delta lending API at `https://portal.1delta.io/v1`.

**Key Endpoints Used:**
- `/data/lending/pools` - Market and pool data
- `/data/lending/user-positions` - User positions
- `/actions/lending/*` - Transaction builders for deposit, withdraw, borrow, repay
- `/data/token/*` - Token and balance data
- `/data/chains` - Supported chains
- `/data/lender-ids` - Supported protocols

### MCP Protocol

The server implements the Model Context Protocol using `@modelcontextprotocol/sdk`:
- **Transport:** stdio (can be extended to HTTP)
- **Protocol:** JSON-RPC over stdio
- **Tool Definitions:** Automatically serialized from function signatures

## Development

### Project Structure

Each package has:
```
src/
  └── index.ts      # Main entry point
dist/              # Compiled JavaScript (generated)
package.json       # Package metadata
tsconfig.json      # TypeScript config
```

### TypeScript Configuration

All packages extend the root `tsconfig.json` for consistency:
- **Target:** ES2020
- **Module:** ES2020
- **Strict Mode:** Enabled
- **Source Maps:** Enabled

### Adding New Tools to Backend

1. Add tool definition to `ListToolsRequestSchema` handler
2. Add implementation in `CallToolRequestSchema` handler
3. Call the appropriate API endpoint

Example:
```typescript
{
  name: "new_tool",
  description: "Tool description",
  inputSchema: {
    type: "object",
    properties: { /* ... */ },
  },
}
```

### Extending the Client

The client's agentic loop in `packages/client/src/index.ts` can be extended to:
- Add multi-turn conversations
- Persist conversation history
- Implement streaming responses
- Add error recovery strategies

## Environment Variables

### Client Package

Set `AI_PROVIDER` and the matching key. See [`packages/client/.env.example`](packages/client/.env.example) for all options.

### API Credentials

Currently, the backend makes unauthenticated requests to the 1Delta API. For production:
- Add `x-api-key` header support in the backend
- Store API keys securely (environment variables or secrets manager)

## Minimal PoC Approach

This implementation is intentionally kept minimal for a proof of concept:

**Backend:** Only essential MCP server setup with core lending operations
**Client:** Simple agentic loop - can be enhanced with memory, streaming, etc.
**Frontend:** Basic chat UI - can add real-time updates, transaction signing UI, etc.

## Next Steps

1. **Build & Test:**
   ```bash
   pnpm install
   pnpm build
   ```

2. **Configure provider:**
   ```bash
   cp packages/client/.env.example packages/client/.env
   # Set AI_PROVIDER and the corresponding API key
   ```

3. **Test MCP Server:**
   ```bash
   cd packages/backend
   pnpm dev
   ```

4. **Test Client Integration:**
   ```bash
   cd packages/client
   pnpm dev
   ```

5. **Run Frontend:**
   ```bash
   cd packages/frontend
   pnpm dev
   ```

## Troubleshooting

### MCP Connection Errors
- Ensure backend is running before starting client
- Check that Node.js version ≥ 18.0.0
- Verify stdio transport is working (no console.log in backend to stdout)

### AI Provider Errors
- Verify the correct API key env var is set for your chosen provider
- Check API key permissions and quotas

### Frontend Issues
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- Check that Vite dev server started on port 3000

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Server Building Guide](https://modelcontextprotocol.io/docs/develop/build-server)
- [MCP Client Examples](https://modelcontextprotocol.io/docs/develop/build-client)
- [1Delta API Documentation](https://portal.1delta.io/v1/docs)
- [Anthropic Claude API](https://docs.anthropic.com)
- [DeepSeek API](https://platform.deepseek.com/docs)

## License

MIT
