# MCP Client + Claude Integration

The MCP client package demonstrates how to connect to an MCP server and integrate with Anthropic's Claude AI model. It implements a complete agentic loop for tool use.

## Overview

This package provides:
- MCP client connection to the backend server
- Claude API integration
- Agentic loop for autonomous tool use
- Example queries demonstrating capabilities

## Architecture

```
User Query
    ↓
Claude (analyze & tool selection)
    ↓
MCP Client (if tool_use in response)
    ↓
Backend Server (MCP tools)
    ↓
1Delta API (data/actions)
    ↓
Tool Result
    ↓
Claude (continue conversation)
    ↓
Final Response
```

## How It Works

### 1. Initialization

The client:
1. Checks for `ANTHROPIC_API_KEY` environment variable
2. Spawns the backend MCP server as a subprocess
3. Creates MCP transport and connects
4. Retrieves available tools from the server

### 2. Tool Definitions

Tools are fetched dynamically from the MCP server:
- Tool names
- Descriptions
- Input schemas
- Required vs optional parameters

### 3. Agentic Loop

```
while Claude wants to use tools:
  1. Claude analyzes query and available tools
  2. Claude decides which tool(s) to use
  3. Client executes tool calls on backend
  4. Results sent back to Claude
  5. Claude formulates response or requests more tools
```

### 4. Response

When Claude stops requesting tools (stop_reason != "tool_use"):
- Extract final text response
- Display to user
- Conversation complete

## Usage

### Setup

```bash
cd packages/client
npm install
```

### Running

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-your-key-here

# Run the client
pnpm dev
```

The client will:
1. Connect to the backend MCP server
2. Retrieve available tools
3. Process example queries
4. Display results

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-...      # Required: Anthropic API key
NODE_DEBUG=*                  # Optional: Enable debug logging
```

## API Integration

### Anthropic Claude

**Model:** `claude-3-5-sonnet-20241022`
**Max Tokens:** 4096
**Tools:** Dynamically loaded from MCP server

### MCP Backend

Connects to backend on stdio transport with:
- Server name: `claude-lending-client`
- Version: `0.1.0`

## Code Structure

### Main Components

**`initializeMCPClient()`**
- Spawns backend server subprocess
- Creates stdio transport
- Connects to MCP server
- Retrieves available tools

**`callMCPTool(toolName, toolInput)`**
- Calls specific tool on backend
- Handles errors gracefully
- Returns JSON string result

**`processQuery(userQuery)`**
- Implements agentic loop
- Manages message history
- Calls Claude API
- Executes tool calls
- Extracts final response

### Example Queries

The client includes three example queries:
1. "What are the top lending markets on Ethereum with the highest deposit rates?"
2. "Show me the lending positions for wallet 0xbadA9c382165b31419F4CC0eDf0Fa84f80A3C8E5 on Ethereum"
3. "What chains are supported by the lending API?"

## Development

### Adding Custom Queries

```typescript
const queries = [
  "Your custom query here",
  // Claude will use available MCP tools to answer
];

await processQuery(queries[0]);
```

### Extending the Agentic Loop

Current loop is basic. For production, consider:
- Conversation history persistence
- Multi-turn conversations
- Memory/context management
- Error recovery strategies
- Streaming responses
- Tool use validation

### Debugging

Enable detailed logging:

```typescript
console.log("Message to Claude:", messages);
console.log("Tool call:", toolName, toolInput);
console.log("Tool result:", result);
```

## Tool Execution Flow

1. **Tool Selection:** Claude selects tools based on user query
2. **Tool Input:** Claude generates structured input for tool
3. **Execution:** Client calls tool on backend
4. **Result Collection:** Response collected for Claude
5. **Continuation:** Claude decides next action

## Error Handling

The client handles:
- Missing API key
- Connection failures
- Tool execution errors
- API timeouts
- Malformed responses

All errors are logged with context for debugging.

## Performance Notes

- Initial connection: ~100-500ms (server startup)
- Tool execution: Depends on API response time (typically 100-2000ms)
- Claude API call: Typically 1-5 seconds
- Full agentic loop: 2-10 seconds typical

## TypeScript Types

```typescript
interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}
```

## Next Steps

### For Enhancement

1. **Streaming:** Implement streaming responses with `stream: true`
2. **Memory:** Add conversation history database
3. **Validation:** Validate tool inputs before execution
4. **Retry Logic:** Add exponential backoff for failed calls
5. **Monitoring:** Add performance metrics and logging

### For Production

1. Secure API key management (use secrets manager)
2. Add request rate limiting
3. Implement proper error recovery
4. Add comprehensive logging
5. Monitor API usage and costs

## References

- [Anthropic Claude API](https://docs.anthropic.com)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Tool Use in Claude](https://docs.anthropic.com/en/docs/build-a-bot)
