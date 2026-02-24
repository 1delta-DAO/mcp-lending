# MCP Client

Connects to the MCP backend server and integrates with a configurable AI provider. Implements a complete agentic loop for tool use.

## Overview

- MCP client connection to the backend server
- Multi-provider AI integration (Anthropic, Google, Groq, Mistral, DeepSeek)
- Agentic loop for autonomous tool use
- Example queries demonstrating capabilities

## Architecture

```
User Query
    ↓
AI Provider (analyze & tool selection)
    ↓
MCP Client (if tool_call in response)
    ↓
Backend Server (MCP tools)
    ↓
1Delta API (data/actions)
    ↓
Tool Result
    ↓
AI Provider (continue conversation)
    ↓
Final Response
```

## How It Works

### 1. Initialization

The client:
1. Reads `AI_PROVIDER` and the corresponding API key from env
2. Spawns the backend MCP server as a subprocess
3. Creates MCP transport and connects
4. Retrieves available tools from the server

### 2. Tool Definitions

Tools are fetched dynamically from the MCP server:
- Tool names, descriptions, input schemas, required vs optional parameters

### 3. Agentic Loop

```
while AI wants to use tools:
  1. AI analyzes query and available tools
  2. AI decides which tool(s) to use
  3. Client executes tool calls on backend
  4. Results sent back to AI
  5. AI formulates response or requests more tools
```

### 4. Response

When the AI stops requesting tools, extract and return the final text response.

## Usage

### Setup

```bash
cp .env.example .env   # fill in AI_PROVIDER + API key
pnpm dev
```

### Supported Providers

| `AI_PROVIDER`  | Required env var       | Notes                                    |
|----------------|------------------------|------------------------------------------|
| `anthropic`    | `ANTHROPIC_API_KEY`    | Default                                  |
| `google`       | `GOOGLE_API_KEY`       |                                          |
| `groq`         | `GROQ_API_KEY`         | Free tier at console.groq.com            |
| `mistral`      | `MISTRAL_API_KEY`      | Free tier at console.mistral.ai          |
| `deepseek`     | `DEEPSEEK_API_KEY`     | platform.deepseek.com                    |

See [`.env.example`](.env.example) for all variables including optional overrides.

## Tool Execution Flow

1. **Tool Selection:** AI selects tools based on user query
2. **Tool Input:** AI generates structured input for tool
3. **Execution:** Client calls tool on backend
4. **Result Collection:** Response collected for AI
5. **Continuation:** AI decides next action

### Example Queries

```
"What are the top lending markets on Ethereum with the highest deposit rates?"
"Show me the lending positions for wallet 0xbadA9c382... on Ethereum"
"What chains are supported by the lending API?"
```

## Development

### Extending the Agentic Loop

Current loop is basic. For production, consider:
- Conversation history persistence
- Multi-turn conversations
- Memory/context management
- Error recovery strategies
- Streaming responses

### Adding Custom Queries

```typescript
await processQuery("Your custom query here");
// AI will use available MCP tools to answer
```

## Error Handling

The client handles:
- Missing API key
- Connection failures
- Tool execution errors
- API timeouts
- Malformed responses

## Next Steps

1. **Streaming:** Implement streaming responses
2. **Memory:** Add conversation history database
3. **Validation:** Validate tool inputs before execution
4. **Retry Logic:** Add exponential backoff for failed calls
5. **Monitoring:** Add performance metrics and logging

## References

- [Anthropic Claude API](https://docs.anthropic.com)
- [MCP Documentation](https://modelcontextprotocol.io)
- [DeepSeek API](https://platform.deepseek.com/docs)
