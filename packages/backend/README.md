# MCP Backend Server

Implements the Model Context Protocol and exposes the 1Delta lending API as typed MCP tools. Runs as a subprocess of the client, communicating over stdio.

## Architecture

```
MCP Client (packages/client)
    ↓ stdio / JSON-RPC
Backend Server (Node.js + @modelcontextprotocol/sdk)
    ↓ HTTP
1Delta Lending API (https://portal.1delta.io/v1)
```

## Tools

### Data tools

| Tool | Description |
|---|---|
| `find_market` | Resolve a `marketUid` by token / protocol. Call this before any action tool. |
| `get_lending_markets` | Browse pools with filters (chain, lender, yield range, TVL, sort). |
| `get_user_positions` | Fetch deposit/borrow positions for a wallet across chains. |
| `get_supported_chains` | List chains with deployed composer proxies. |
| `get_lender_ids` | List supported lending protocol IDs (e.g. `AAVE_V3`). |
| `get_token_balances` | Token balances for a wallet on a chain. |

### Action tools

Action tools return transaction calldata. The `marketUid` format is `lender:chainId:tokenAddress`.

| Tool | Description |
|---|---|
| `get_deposit_calldata` | Build calldata to deposit into a lending pool. |
| `get_withdraw_calldata` | Build calldata to withdraw from a lending pool. |
| `get_borrow_calldata` | Build calldata to borrow from a lending pool. |
| `get_repay_calldata` | Build calldata to repay borrowed assets. |

Action tool responses follow this schema:
```json
{
  "actions": {
    "permissions": [{ "to": "0x...", "data": "0x...", "value": "0x0", "info": "approve" }],
    "transactions": [{ "to": "0x...", "data": "0x...", "value": "0x0" }]
  }
}
```

`permissions` are ERC-20 approvals that must be executed before `transactions`.

## Development

```bash
pnpm build   # compile TypeScript to dist/
pnpm dev     # watch mode (ts-node)
```
