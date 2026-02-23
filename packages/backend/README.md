# MCP Backend Server

The MCP backend server implements the Model Context Protocol and exposes the 1Delta lending API through standardized MCP tools. This server acts as the middleware between Claude AI and the lending platform.

## Overview

The backend server:
- Connects to the 1Delta lending API
- Exposes 9 MCP tools for lending operations
- Handles API requests and responses
- Provides clean, typed tool definitions

## Architecture

```
Claude AI (via MCP Client)
    ↓
  MCP Protocol (JSON-RPC over stdio)
    ↓
Backend Server (Node.js + @modelcontextprotocol/sdk)
    ↓
  API Requests
    ↓
1Delta Lending API (https://portal.1delta.io/v1)
```

## Tools

### 1. get_lending_markets

Browse available lending pools and markets with filtering and sorting options.

**Parameters:**
- `chainId` (optional): Filter by blockchain ID (e.g., "1" for Ethereum)
- `lender` (optional): Filter by protocol (e.g., "AAVE_V3")
- `minYield` (optional): Minimum deposit rate
- `maxYield` (optional): Maximum deposit rate
- `minTvlUsd` (optional): Minimum total value locked
- `sortBy` (optional): Sort field (depositRate, variableBorrowRate, utilization, totalDepositsUsd)
- `count` (optional): Number of results (default 100)

**Example:**
```json
{
  "chainId": "1",
  "lender": "AAVE_V3",
  "minYield": 0.05,
  "sortBy": "depositRate",
  "count": 10
}
```

### 2. get_user_positions

Fetch user's current lending and borrowing positions across chains.

**Parameters:**
- `account` (required): EVM wallet address (0x-prefixed)
- `chains` (required): Comma-separated chain IDs (e.g., "1,42161")
- `lenders` (optional): Comma-separated lender IDs to filter

**Example:**
```json
{
  "account": "0xbadA9c382165b31419F4CC0eDf0Fa84f80A3C8E5",
  "chains": "1,42161",
  "lenders": "AAVE_V3,COMPOUND_V3_USDC"
}
```

### 3. get_deposit_calldata

Build transaction calldata for depositing assets into lending pools.

**Parameters:**
- `marketUid` (required): Market ID in format "lender:chainId:address"
- `amount` (required): Deposit amount in wei
- `operator` (required): User's wallet address
- `receiver` (optional): Receiver address (defaults to operator)
- `mode` (optional): "direct" or "proxy" execution mode

**Example:**
```json
{
  "marketUid": "AAVE_V3:1:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount": "1000000000000000000",
  "operator": "0xYourAddress",
  "mode": "direct"
}
```

### 4. get_withdraw_calldata

Build transaction calldata for withdrawing assets from lending pools.

**Parameters:**
- `marketUid` (required): Market identifier
- `amount` (required): Withdrawal amount in wei
- `operator` (required): User's wallet address
- `receiver` (optional): Receiver address
- `isAll` (optional): Withdraw full balance
- `mode` (optional): "direct" or "proxy"

### 5. get_borrow_calldata

Build transaction calldata for borrowing assets.

**Parameters:**
- `marketUid` (required): Market identifier
- `amount` (required): Borrow amount in wei
- `operator` (required): User's wallet address
- `lendingMode` (optional): "0" (NONE), "1" (STABLE), "2" (VARIABLE)
- `mode` (optional): Execution mode

### 6. get_repay_calldata

Build transaction calldata for repaying borrowed assets.

**Parameters:**
- `marketUid` (required): Market identifier
- `amount` (required): Repayment amount in wei
- `operator` (required): User's wallet address
- `isAll` (optional): Repay full debt
- `lendingMode` (optional): Interest rate mode
- `mode` (optional): Execution mode

### 7. get_token_balances

Fetch token balances for a user account on a specific chain.

**Parameters:**
- `chainId` (required): Blockchain ID
- `account` (required): User's wallet address
- `assets` (required): Comma-separated token contract addresses

**Example:**
```json
{
  "chainId": "1",
  "account": "0xbadA9c382165b31419F4CC0eDf0Fa84f80A3C8E5",
  "assets": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
}
```

### 8. get_supported_chains

Get list of supported blockchain networks with deployed composer proxies.

**Parameters:** None

### 9. get_lender_ids

Get list of supported lending protocol identifiers.

**Parameters:** None

## API Integration

### Base URL
```
https://portal.1delta.io/v1
```

### Request Flow

1. Tool is called through MCP protocol
2. Backend parses tool name and arguments
3. Constructs API request with proper parameters
4. Makes request to 1Delta API
5. Returns response as JSON string

### Error Handling

- API errors are caught and returned as error messages
- Invalid parameters trigger appropriate error responses
- Network timeouts are handled gracefully

## Development

### Running the Server

```bash
# Development mode (with auto-reload)
cd packages/backend
pnpm dev

# Build and production mode
pnpm build
pnpm start
```

### Testing Tools

Once the server is running, test via MCP client or directly:

```bash
# In another terminal, test via the MCP client
cd packages/client
ANTHROPIC_API_KEY=your_key pnpm dev
```

### Adding New Tools

1. Add tool definition to `ListToolsRequestSchema` handler
2. Add case to `CallToolRequestSchema` handler:
   ```typescript
   case "your_new_tool":
     result = await makeApiRequest("/api/endpoint", args);
     break;
   ```

## Implementation Notes

- **Transport:** Uses stdio transport for MCP protocol
- **Logging:** Writes to stderr to avoid corrupting JSON-RPC messages
- **API Key:** Currently optional (rate-limited without key)
- **Async:** All operations are async for non-blocking I/O

## Security Considerations

- No API key validation currently implemented (add for production)
- Parameters are URL-encoded automatically
- Request timeouts set to 30 seconds
- Error messages don't expose sensitive information

## Performance

- Lightweight: Minimal dependencies
- Fast: Direct API pass-through
- Scalable: Can handle concurrent requests

## Future Enhancements

- Add caching layer for repeated queries
- Implement request rate limiting
- Add simulation endpoints for preview transactions
- Support for batch operations
- WebSocket support for real-time updates
