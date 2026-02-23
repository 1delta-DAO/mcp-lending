# Architecture Document

## System Overview

This MCP lending agent is designed as a clean, minimal proof of concept (PoC) that demonstrates how AI models can interact with blockchain DeFi protocols through the Model Context Protocol.

```
┌──────────────────────────────────────────────────────────────────┐
│                     End User Interface                            │
│                   (Chat UI - Frontend)                            │
└─────────────────────────┬──────────────────────────────────────────┘
                          │ HTTP/WebSocket
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│              MCP Client + Claude Integration                      │
│                                                                   │
│  - Manages conversation with Claude AI                            │
│  - Implements agentic loop for tool use                           │
│  - Calls MCP backend tools                                        │
│  - Formats responses for frontend                                 │
└─────────────────────────┬──────────────────────────────────────────┘
                          │ MCP Protocol (JSON-RPC/stdio)
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│              MCP Server (Backend)                                 │
│                                                                   │
│  Tool Definitions:                                                │
│  - get_lending_markets        - Browse pools & markets            │
│  - get_user_positions         - Fetch user positions              │
│  - get_deposit_calldata       - Build deposit tx                  │
│  - get_withdraw_calldata      - Build withdrawal tx               │
│  - get_borrow_calldata        - Build borrow tx                   │
│  - get_repay_calldata         - Build repay tx                    │
│  - get_token_balances         - Fetch balances                    │
│  - get_supported_chains       - List chains                       │
│  - get_lender_ids             - List protocols                    │
└─────────────────────────┬──────────────────────────────────────────┘
                          │ REST API
                          ↓
                  1Delta Lending API
              (https://portal.1delta.io/v1)
```

## Component Details

### 1. Frontend (React + Vite)

**Location:** `packages/frontend`

**Purpose:** User-facing chat interface

**Key Features:**
- Clean, responsive chat UI
- Message history with timestamps
- Loading indicators
- Tailwind CSS styling
- Minimal design for PoC

**Technology Stack:**
- React 18
- Vite (fast dev server)
- TypeScript
- Tailwind CSS
- Axios for HTTP

**Current State:**
- Simulated responses (ready for integration)
- No backend connection yet
- Complete UI/UX foundation

**Next Steps:**
1. Add backend API endpoint
2. Connect to MCP client via API
3. Real-time updates (WebSocket)
4. Transaction signing UI
5. Wallet connection

### 2. MCP Client (Node.js + TypeScript)

**Location:** `packages/client`

**Purpose:** Bridge between Claude AI and MCP backend server

**Key Responsibilities:**
1. Spawn and connect to MCP backend server
2. Retrieve available tools from MCP server
3. Send user queries to Claude with tool definitions
4. Execute tools when Claude requests them
5. Continue conversation until final response

**Agentic Loop:**

```
1. User Query
    ↓
2. Send to Claude with available tools
    ↓
3. Claude response includes tool_use?
    ├─ YES: Execute tool(s)
    │   ↓
    │   Send results back to Claude
    │   ↓
    │   Go to step 3
    └─ NO: Return final response
```

**Technology Stack:**
- Anthropic Claude SDK
- MCP SDK (client)
- TypeScript
- Node.js stdio transport

**Example Query Flow:**

```
User: "What are the top lending markets on Ethereum?"
  ↓
Claude: "I should use get_lending_markets with chainId='1'"
  ↓
Client: Call get_lending_markets(chainId: "1", sortBy: "depositRate")
  ↓
MCP Server: Call 1Delta API
  ↓
Response: [Market 1, Market 2, ...]
  ↓
Claude: Format and explain results
  ↓
Output: "The top markets on Ethereum are..."
```

### 3. MCP Backend Server (Node.js + TypeScript)

**Location:** `packages/backend`

**Purpose:** MCP protocol server exposing lending API as tools

**Architecture:**

```
MCP Protocol Handler
    ↓
Tool List Response (9 tools)
    ↓
Tool Call Handler
    ├─ Tool validation
    ├─ Argument parsing
    └─ API forwarding
    ↓
1Delta API Integration
    ├─ Market data endpoints
    ├─ User position endpoints
    ├─ Transaction builders
    └─ Token/chain info
    ↓
Response Formatting & Return
```

**Key Components:**

1. **Tool Definitions** - 9 MCP tools for lending operations
2. **API Integration Layer** - Direct forwarding to 1Delta API
3. **MCP Protocol Handler** - Implements MCP server spec
4. **Error Handling** - Graceful error management

**Tool Capabilities:**

| Tool | Purpose | API Endpoint |
|------|---------|--------------|
| `get_lending_markets` | Browse pools | `/data/lending/pools` |
| `get_user_positions` | User positions | `/data/lending/user-positions` |
| `get_deposit_calldata` | Deposit tx | `/actions/lending/deposit` |
| `get_withdraw_calldata` | Withdraw tx | `/actions/lending/withdraw` |
| `get_borrow_calldata` | Borrow tx | `/actions/lending/borrow` |
| `get_repay_calldata` | Repay tx | `/actions/lending/repay` |
| `get_token_balances` | Token balances | `/data/token/balances` |
| `get_supported_chains` | Supported chains | `/data/chains` |
| `get_lender_ids` | Protocol identifiers | `/data/lender-ids` |

## Data Flow Examples

### Example 1: Query Lending Markets

```
Frontend User: "Show AAVE markets on Ethereum with 5% yield"
    ↓
API call to backend: POST /chat
    ↓
Client receives query
    ↓
Claude: "I need to query lending markets"
    ↓
Claude selects: get_lending_markets
Claude provides: chainId="1", lender="AAVE_V3", minYield=0.05
    ↓
Client calls MCP tool
    ↓
Backend server receives tool call
    ↓
Backend API call: GET /data/lending/pools?chainId=1&lender=AAVE_V3&minYield=0.05
    ↓
1Delta API returns market data
    ↓
Backend formats response
    ↓
Client receives tool result
    ↓
Claude processes data
    ↓
Claude generates explanation
    ↓
Response sent to frontend
    ↓
Frontend displays: "Here are the top AAVE markets on Ethereum..."
```

### Example 2: Check User Positions

```
Frontend User: "What are my positions on Ethereum?"
    ↓
Backend receives query with wallet address
    ↓
Claude: "I should check user positions"
Claude selects: get_user_positions
Claude provides: account="0x...", chains="1"
    ↓
Client executes tool
    ↓
Backend: GET /data/lending/user-positions?account=0x...&chains=1
    ↓
1Delta API returns: deposits, debt, health factor, APR data
    ↓
Claude analyzes: Total deposits $X, debt $Y, health factor Z
    ↓
Response: "You have $X in deposits and $Y in debt with health factor Z"
```

## Technology Decisions

### Why pnpm Workspaces?

- **Monorepo management:** Easy to manage related packages
- **Shared dependencies:** Efficient dependency resolution
- **Workspace scripts:** Run commands across packages
- **Clean structure:** Clear separation of concerns

### Why MCP (Model Context Protocol)?

- **Standardization:** Works with any compatible client/server
- **Type Safety:** Strong typing for tool definitions
- **Scalability:** Can add more tools without client changes
- **Flexibility:** Works with multiple AI models

### Why TypeScript?

- **Type safety:** Catch errors at compile time
- **Maintainability:** Easier refactoring and documentation
- **Developer experience:** Better IDE support
- **Consistency:** Unified language across stack

### Why Vite for Frontend?

- **Fast HMR:** Quick hot reload during development
- **Optimized builds:** Excellent production bundles
- **ESM native:** Modern JavaScript module support
- **Simple config:** Minimal configuration needed

## Design Principles

### 1. Minimal PoC Approach
- Core functionality only
- Ready for extension
- Clean, understandable code
- Well-documented

### 2. Clean Separation of Concerns
- Frontend: UI only
- Client: Claude integration & orchestration
- Backend: MCP protocol & API translation

### 3. API Compatibility
- Direct pass-through to 1Delta API
- Minimal transformation
- Easy to trace data flow
- Simple debugging

### 4. Error Handling
- Graceful failures
- Clear error messages
- No sensitive data exposure
- Recovery strategies

## Scalability Considerations

### Current Limitations (PoC)

- Single server instance
- No caching
- No rate limiting
- Synchronous operations
- In-memory state

### Future Enhancements

1. **Caching Layer**
   - Redis for market data
   - TTL-based invalidation
   - Query optimization

2. **Rate Limiting**
   - Per-user limits
   - Per-tool limits
   - Backpressure handling

3. **Performance**
   - Connection pooling
   - Request batching
   - Async operations

4. **Reliability**
   - Request retry logic
   - Failover endpoints
   - Circuit breakers

5. **Monitoring**
   - Request logging
   - Performance metrics
   - Error tracking

## Security Considerations

### Current State
- API keys in environment variables
- Basic error handling
- No request validation

### Production Requirements

1. **Authentication**
   - User identity verification
   - API key management
   - Session management

2. **Authorization**
   - User-specific data access
   - Rate limiting per user
   - Audit logging

3. **Data Protection**
   - Input validation
   - Output sanitization
   - Sensitive data masking

4. **Transport Security**
   - HTTPS for all APIs
   - Request signing
   - Encryption for sensitive data

## Integration Points

### Frontend ↔ Client API
Currently missing but needs:
```
POST /api/chat
{
  "message": "user query"
}

Response:
{
  "response": "agent response",
  "timestamp": "2024-..."
}
```

### Client ↔ MCP Backend
Implemented via stdio transport:
- JSON-RPC protocol
- Method: `tools/call`
- Params: tool name & input

### Backend ↔ 1Delta API
Direct REST API calls:
- Base URL: `https://portal.1delta.io/v1`
- Query parameters
- JSON responses

## Deployment Architecture (Future)

```
┌─────────────────────────────────────┐
│  Frontend (Static + SPA)            │
│  Hosted on: Vercel / Netlify        │
└────────────────┬────────────────────┘
                 │ API calls
┌────────────────↓────────────────────┐
│  API Server (Client Service)        │
│  Hosted on: AWS / GCP / Heroku      │
│  - Processes chat requests          │
│  - Manages Claude integration       │
│  - Routes to MCP backend            │
└────────────────┬────────────────────┘
                 │ MCP Protocol
┌────────────────↓────────────────────┐
│  MCP Backend Server                 │
│  Hosted on: Same / Different server │
│  - MCP tool implementations         │
│  - 1Delta API integration           │
└────────────────────────────────────┘
                 │ REST API
                 ↓
            1Delta API
```

## Testing Strategy

### Unit Testing
- Individual tool implementations
- API request formatting
- Error handling

### Integration Testing
- Full agentic loop
- MCP protocol compliance
- Claude API integration

### E2E Testing
- User query → Final response
- Multiple consecutive queries
- Error scenarios

### Performance Testing
- Tool execution time
- API response time
- Memory usage

## Monitoring & Observability

### Metrics to Track
- Request latency
- Tool execution time
- API error rates
- Token usage (Claude)
- User query patterns

### Logging Strategy
- Structured logging to stderr
- Request/response logging
- Error tracking
- Performance profiling

### Debugging
- MCP protocol tracing
- API request/response logging
- Claude conversation logs
- Error stack traces

## Future Roadmap

### Phase 1 (Current)
✅ MCP server with 9 tools
✅ Claude integration foundation
✅ Basic React UI

### Phase 2
- [ ] Connect frontend to backend API
- [ ] Real-time WebSocket updates
- [ ] Wallet integration (Web3 connection)
- [ ] Basic caching layer

### Phase 3
- [ ] Multi-chain support
- [ ] Advanced filtering & searching
- [ ] Transaction simulation
- [ ] Portfolio analytics

### Phase 4
- [ ] User authentication
- [ ] Persistent conversation history
- [ ] Custom agents/templates
- [ ] Mobile app

---

**This architecture prioritizes clarity and extensibility while maintaining the minimal PoC philosophy.**
