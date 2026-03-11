# 1delta Lending MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants direct access to the [1delta](https://1delta.io) DeFi lending aggregator. Runs on Cloudflare Workers + Durable Objects.

## Quick start

### Local development

```bash
pnpm worker:dev          # starts wrangler dev on http://localhost:8787
```

Connect any MCP client to `http://localhost:8787/mcp`.

### Deploy to Cloudflare

```bash
pnpm worker:deploy
```

## API key

A 1delta API key is **optional but recommended** — without one you are subject to public rate limits and may hit 429 errors under moderate usage.

**Get a key:** [auth.1delta.io](https://auth.1delta.io)

**How to pass it:** include it as a Bearer token in the `Authorization` header on the MCP `initialize` request:

```
Authorization: Bearer <your-1delta-api-key>
```

The key is captured at session initialization and forwarded as `x-api-key` on every upstream API call.

**Key resolution order:**
1. Client-supplied key via `Authorization: Bearer` header (per-session)
2. No key — public rate limits apply

## Architecture

```
MCP Client
    ↓  Streamable HTTP  (POST/GET /mcp)
Cloudflare Worker  (worker.ts)
    ↓  routes by Mcp-Session-Id
Durable Object: McpSessionDO  (one per session)
    ↓  holds MCP transport + server in memory
MCP Server  (mcp-server.ts)
    ↓  HTTP
1delta Portal API  (https://portal.1delta.io/v1)
```

Each MCP session gets its own Durable Object instance. The DO's hex ID is used directly as the MCP session ID, so the Worker can always route requests to the correct instance.

## Tools

### Data tools

| Tool | Description |
|------|-------------|
| `find_market` | Resolve a `marketUid` by token/protocol. Returns `decimals` and `priceUsd`. |
| `get_lending_markets` | Browse markets with filters (chain, lender, yield, TVL, sort). Returns `decimals` and `priceUsd` per market. |
| `get_user_positions` | Deposit/borrow positions for a wallet across chains. |
| `get_supported_chains` | List supported chains with IDs. |
| `get_lender_ids` | List supported lending protocol IDs (e.g. `AAVE_V3`). |
| `get_token_info` | Token metadata (address, decimals, symbol) — use when token is not in a market result. |
| `get_token_price` | Current USD price by asset group — use when price is not in a market result. |
| `get_token_balances` | Token balances for a wallet on a chain. |

### Amount conversion

| Tool | Description |
|------|-------------|
| `convert_amount` | Convert a human-readable token amount or USD value to the integer base-unit string required by action tools. **Always call this before an action tool.** |

```
// Token amount: 1 USDC (decimals=6)
convert_amount({ humanAmount: "1", decimals: 6 }) → { baseUnits: "1000000" }

// USD value: $10 of WETH at $2000, decimals=18
convert_amount({ usdAmount: "10", priceUsd: 2000, decimals: 18 }) → { baseUnits: "5000000000000000" }
```

### Action tools

Action tools return transaction calldata. Call `convert_amount` first to get the `amount`.

| Tool | Description |
|------|-------------|
| `get_deposit_calldata` | Build calldata to deposit into a lending pool. |
| `get_withdraw_calldata` | Build calldata to withdraw from a lending pool. |
| `get_borrow_calldata` | Build calldata to borrow from a lending pool. |
| `get_repay_calldata` | Build calldata to repay borrowed assets. |

The `marketUid` format is `lender:chainId:tokenAddress`.

Action tool responses follow this schema:
```json
{
  "actions": {
    "permissions": [{ "to": "0x...", "data": "0x...", "value": "0x0", "info": "approve" }],
    "transactions": [{ "to": "0x...", "data": "0x...", "value": "0x0" }]
  }
}
```

- **`permissions`** — ERC-20 approval transactions that **must be submitted first** before the main transaction.
- **`transactions`** — The main protocol transaction(s) to submit after permissions.

Each entry contains `to` (contract address), `data` (encoded calldata), and `value` (ETH value in hex). Sign and submit these via a wallet provider (e.g. ethers.js, viem, MetaMask).

### Asset group mappings

The `assetGroup` parameter in `find_market` and `get_lending_markets` follows these rules:

| Token | assetGroup |
|-------|------------|
| WETH | `"ETH"` |
| All others | Their own symbol (e.g. `"USDC"`, `"WBTC"`, `"WSTETH"`) |

> The ETH mapping applies **only** to WETH. Staked/wrapped variants (wstETH, stETH, rETH, cbETH) use their own symbols.

## Action flow

```
1. get_lending_markets / find_market
      → returns market with marketUid, decimals, priceUsd

2. convert_amount(humanAmount | usdAmount, decimals, priceUsd?)
      → returns baseUnits string

3. get_deposit/withdraw/borrow/repay_calldata(marketUid, amount=baseUnits, operator)
      → returns actions.permissions (approvals) + actions.transactions (main tx)

4. Submit permissions first, then transactions — via wallet/signer on the target chain
```

## MCP resources

The server exposes built-in documentation resources readable by any MCP client:

| URI | Contents |
|-----|----------|
| `docs://overview` | Server overview and quick start |
| `docs://authentication` | API key setup |
| `docs://tools` | Full tool reference with parameters and examples |
| `docs://chains` | Supported chain IDs |
| `docs://lenders` | Supported lending protocol identifiers |
