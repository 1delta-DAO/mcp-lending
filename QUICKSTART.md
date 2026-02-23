# Getting Started

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Build all packages
```bash
pnpm build
```

### 3. Run the client (with Claude integration)
```bash
export ANTHROPIC_API_KEY=sk-your-key-here
cd packages/client
pnpm dev
```

### 4. Or run the frontend
```bash
cd packages/frontend
pnpm dev
```

## Project Structure

```
├── packages/
│   ├── backend/       MCP Server exposing lending API
│   ├── client/        Claude AI integration with MCP
│   └── frontend/      Chat UI (minimal PoC)
├── README.md          Main documentation
├── package.json       Workspace root config
└── pnpm-workspace.yaml Monorepo configuration
```

## What Each Package Does

### Backend
- Connects to 1Delta lending API
- Exposes 9 MCP tools for Claude
- Runs on stdio transport

### Client
- Integrates with Anthropic Claude
- Implements agentic loop for tool use
- Demonstrates MCP + Claude integration

### Frontend
- React chat interface
- Ready for backend API integration
- Minimal but complete UI

## Environment Setup

### Required
```bash
export ANTHROPIC_API_KEY=sk-...
```

### Optional
```bash
export NODE_DEBUG=*  # For debugging
```

## Running Everything

### Development
```bash
pnpm dev
```

Runs all packages in watch mode.

### Production
```bash
pnpm build
```

Builds all packages for production.

## Next Steps

1. **Test the Backend**
   - Backend exposes MCP tools
   - Run client to see it in action

2. **Explore the Client**
   - Shows how to use MCP with Claude
   - Implements agentic loop

3. **Integrate Frontend**
   - Currently simulated
   - Add backend API endpoint

## Key Files

- `packages/backend/src/index.ts` - MCP server with 9 tools
- `packages/client/src/index.ts` - Claude + MCP integration
- `packages/frontend/src/ChatContainer.tsx` - React UI component

## Troubleshooting

### Backend won't start
- Check Node.js version: `node --version` (need ≥18)
- Check all dependencies installed: `pnpm install`

### Client connection errors
- Ensure backend is running first
- Check ANTHROPIC_API_KEY is set

### Frontend not loading
- Port 3000 might be in use
- Check `pnpm dev` output for alternate port

## Architecture Overview

```
                    Claude API
                        ↑↓
    ┌───────────────────────────────────┐
    │   MCP Client (packages/client)    │
    └───────────────────────────────────┘
                        ↑↓ (MCP Protocol)
    ┌───────────────────────────────────┐
    │   MCP Server (packages/backend)   │
    └───────────────────────────────────┘
                        ↑↓ (REST API)
                  1Delta API
```

## Performance Notes

- Initial startup: ~1-2 seconds
- Tool execution: ~500ms-2s (depends on API)
- Claude response: ~1-5s
- Full agentic loop: ~3-10s typical

## Security Notes

- API keys stored in environment variables (not in code)
- No sensitive data logged to stdout
- Rate limiting should be added for production
- Consider adding request validation

## Support

For issues or questions:
1. Check individual package READMEs
2. Review MCP documentation: https://modelcontextprotocol.io
3. Check Anthropic docs: https://docs.anthropic.com

---

**Ready to go!** Start with `pnpm install && pnpm build`, then run either the client or frontend.
