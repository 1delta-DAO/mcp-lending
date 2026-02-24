# MCP Client

HTTP server that bridges the frontend chat UI to the MCP backend. Spawns the backend as a subprocess, runs an agentic tool-use loop with a configurable AI provider, and streams transaction calldata back to the frontend.

## Architecture

```
Frontend (POST /chat)
    ↓
Client HTTP Server (Node.js)
    ↓ per-request provider instantiation
AI Provider (agentic loop)
    ↓ tool calls
MCP Client → Backend Server (stdio)
    ↓
1Delta API
```

## HTTP API

### `GET /providers`

Returns the list of supported AI providers.

```json
{ "providers": ["anthropic", "openai", "google", "groq", "mistral", "deepseek"] }
```

### `POST /chat`

```json
{
  "query": "What are the best USDC deposit rates on Arbitrum?",
  "userAddress": "0xabc...",
  "provider": "openai"
}
```

- `query` — required
- `userAddress` — optional; injected into the system context so the AI can query positions automatically
- `provider` — optional; selects which AI provider to use for this request (defaults to `anthropic`). Provider selection is **stateless** — each request can use a different provider independently.

**Response:**
```json
{
  "response": "The top USDC markets on Arbitrum are...",
  "transactions": [
    { "description": "approve", "to": "0x...", "data": "0x...", "value": "0x0", "chainId": 42161 },
    { "description": "deposit", "to": "0x...", "data": "0x...", "value": "0x0", "chainId": 42161 }
  ]
}
```

`transactions` is only present when the AI called an action tool. The `chainId` is extracted from the `marketUid` and used by the frontend to trigger a wallet chain switch before signing.

## AI Providers

| `provider` value | Required env var | Notes |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | Default. Includes exponential-backoff retry on 429s. |
| `openai` | `OPENAI_API_KEY` | Uses `gpt-5-nano`. |
| `google` | `GOOGLE_API_KEY` | Uses `gemini-2.5-flash-lite`. |
| `groq` | `GROQ_API_KEY` | Uses `llama-3.1-8b-instant`. Free tier at console.groq.com. |
| `mistral` | `MISTRAL_API_KEY` | Uses `mistral-small-latest`. Free tier at console.mistral.ai. |
| `deepseek` | `DEEPSEEK_API_KEY` | Uses `deepseek-chat`. |

All providers share the same system prompt (defined in `src/providers/types.ts`) which enforces liquidity-aware market recommendations.

## Setup

```bash
cp .env.example .env   # fill in at least one API key
pnpm build
pnpm start             # listens on PORT (default 3001)
```

```bash
pnpm dev   # ts-node watch mode
```

## Tool Execution Flow

1. **Tool Selection:** AI selects tools based on user query
2. **Tool Input:** AI generates structured input for tool
3. **Execution:** Client calls tool on backend
4. **Result Collection:** Response collected for AI
5. **Continuation:** AI decides next action

## References

- [MCP Documentation](https://modelcontextprotocol.io)
- [Anthropic Claude API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Groq API](https://console.groq.com/docs)
- [Mistral API](https://docs.mistral.ai)
- [DeepSeek API](https://platform.deepseek.com/docs)
