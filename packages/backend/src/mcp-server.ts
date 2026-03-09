import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API_BASE_URL = "https://portal.1delta.io/v1";

async function makeApiRequest(
  endpoint: string,
  params: Record<string, unknown> = {},
  apiKey?: string,
) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else {
      url.searchParams.append(key, String(value));
    }
  });

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      (errorData?.error as Record<string, unknown>)?.message ?? response.statusText;
    if (response.status === 429) {
      throw new Error(
        `API Error 429: Rate limit exceeded. ` +
        `To get higher limits, provide a 1delta API key via the Authorization: Bearer <key> header when connecting. ` +
        `Get a key at https://auth.1delta.io`,
      );
    }
    throw new Error(`API Error ${response.status}: ${message}`);
  }
  return response.json();
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

// Returns slim pool projections filtered by TVL.
function slimPools(
  raw: unknown,
  minTvlUsd = 10_000,
): { markets: unknown[]; filteredCount: number } {
  const rawData = (raw as Record<string, unknown>)?.data;
  const pools: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : Array.isArray((rawData as Record<string, unknown>)?.items)
      ? ((rawData as Record<string, unknown>).items as Record<string, unknown>[])
      : Array.isArray(rawData)
        ? (rawData as Record<string, unknown>[])
        : [];

  const all = pools.map((m) => {
    const tvl = parseFloat(m.totalDepositsUsd as string) || 0;
    const util = parseFloat(m.utilization as string) || 0;
    const availableLiquidityUsd = Math.round(tvl * (1 - util) * 100) / 100;
    const underlying = m.underlyingInfo as Record<string, unknown> | undefined;
    const asset = underlying?.asset as Record<string, unknown> | undefined;
    const prices = underlying?.prices as Record<string, unknown> | undefined;
    return {
      marketUid: m.marketUid,
      symbol: asset?.symbol ?? asset?.assetGroup ?? m.assetGroup ?? m.symbol,
      tokenAddress: asset?.address,
      decimals: asset?.decimals,
      priceUsd: prices?.priceUsd,
      depositRate: m.depositRate,
      variableBorrowRate: m.variableBorrowRate,
      totalDepositsUsd: tvl,
      availableLiquidityUsd,
      utilization: util,
    };
  });

  const markets = all.filter((m) => m.totalDepositsUsd >= minTvlUsd);
  return { markets, filteredCount: all.length - markets.length };
}

// ---------------------------------------------------------------------------
// MCP server factory — creates a fresh server instance per client session.
// ---------------------------------------------------------------------------

export function createMcpServer(apiKey?: string): McpServer {
  const server = new McpServer({ name: "lending-mcp-server", version: "0.1.0" });
  const api = (endpoint: string, params: Record<string, unknown> = {}) =>
    makeApiRequest(endpoint, params, apiKey);

  server.registerTool(
    "find_market",
    {
      description:
        "Find a lending market's marketUid by token/protocol. Use this before deposit/withdraw/borrow/repay. Requires exact chainId and lender values — see get_supported_chains / get_lender_ids if unsure.",
      inputSchema: {
        chainId: z
          .string()
          .describe(
            "Numeric chain ID as string. Common values: '1'=Ethereum, '56'=BNB, '137'=Polygon, '10'=Optimism, '42161'=Arbitrum, '43114'=Avalanche, '8453'=Base, '5000'=Mantle, '534352'=Scroll, '59144'=Linea. Call get_supported_chains if the chain is not listed here.",
          ),
        assetGroup: z
          .string()
          .optional()
          .describe(
            "Asset name e.g. 'USDC', 'ETH'. Note: WETH is mapped to 'ETH' — always use 'ETH' when searching for WETH markets.",
          ),
        tokenAddress: z.string().optional().describe("Token contract address (0x-)"),
        lender: z
          .string()
          .optional()
          .describe(
            "Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE', 'COMPOUND_V3'. Call get_lender_ids to discover valid values.",
          ),
        count: z.number().int().optional().describe("Max results (default 10)"),
        minTvlUsd: z
          .number()
          .optional()
          .describe(
            "Minimum TVL (totalDepositsUsd) in USD. Default 10000. Lower only if the user explicitly asks for small/illiquid markets.",
          ),
      },
    },
    async ({ chainId, assetGroup, tokenAddress, lender, count, minTvlUsd }) => {
      try {
        const raw = await api("/data/lending/pools", {
          chainId,
          assetGroups: assetGroup,
          underlyings: tokenAddress,
          lender,
          count: count ?? 10,
        });
        const result = slimPools(raw, minTvlUsd ?? 10_000);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_lending_markets",
    {
      description:
        "Browse lending markets with filters. For a specific marketUid use find_market instead. To find the best yield, use sortBy='depositRate' and sortOrder='desc'.",
      inputSchema: {
        chainId: z
          .string()
          .describe(
            "Numeric chain ID as string e.g. '1'=Ethereum, '42161'=Arbitrum, '5000'=Mantle. Call get_supported_chains for the full list.",
          ),
        lender: z
          .string()
          .optional()
          .describe(
            "Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE'. Call get_lender_ids for the full list.",
          ),
        assetGroups: z.string().optional().describe("Comma-separated asset names e.g. 'USDC', 'ETH'"),
        minYield: z.number().optional().describe("Min deposit rate"),
        maxYield: z.number().optional().describe("Max deposit rate"),
        minTvlUsd: z
          .number()
          .optional()
          .describe(
            "Minimum TVL (totalDepositsUsd) in USD. Default 10000. Lower only if the user explicitly asks for small/illiquid markets.",
          ),
        sortBy: z
          .enum(["depositRate", "variableBorrowRate", "utilization", "totalDepositsUsd"])
          .optional()
          .describe("Sort field"),
        sortDir: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction. Use 'desc' for highest yield first."),
        count: z.number().int().optional().describe("Results (default 100)"),
      },
    },
    async ({ minTvlUsd, ...args }) => {
      try {
        const raw = await api("/data/lending/pools", args);
        const result = slimPools(raw, minTvlUsd ?? 10_000);
        return ok(result);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_user_positions",
    {
      description: "Get lending/borrowing positions for a wallet across chains.",
      inputSchema: {
        account: z.string().describe("Wallet address (0x-)"),
        chains: z.string().describe("Comma-separated chain IDs e.g. '1,42161'"),
        lenders: z.string().optional().describe("Comma-separated lender IDs"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/data/lending/user-positions", args));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_supported_chains",
    {
      description: "Get list of supported chains with deployed composer proxies",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await api("/data/chains"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_lender_ids",
    {
      description: "Get list of supported lending protocol identifiers",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await api("/data/lender-ids"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_token_info",
    {
      description:
        "Look up token metadata (address, decimals, symbol, name) by assetGroup, symbol, address, and/or chainId. One assetGroup can map to multiple tokens across chains. Add chainId to identify a specific token. Always call this before an action when the token's decimals are not known, so you can correctly convert human-readable amounts to base units.",
      inputSchema: {
        chainId: z.string().optional().describe("Chain ID e.g. '42161'"),
        assetGroup: z
          .string()
          .optional()
          .describe("Asset group name e.g. 'ETH', 'USDC'. Note: WETH is stored as 'ETH'."),
        symbol: z.string().optional().describe("Token symbol e.g. 'USDC'"),
        address: z.string().optional().describe("Token contract address (0x-)"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/data/token/available", args));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_token_price",
    {
      description:
        "Get current USD prices for one or more tokens by asset group key. Use this when the user specifies an amount in USD — get the price, divide USD amount by price to get the token amount, then convert to base units using decimals from get_token_info.",
      inputSchema: {
        assets: z
          .array(z.string())
          .describe(
            "Asset group keys to look up e.g. ['ETH', 'USDC', 'WBTC']. Note: WETH uses the key 'ETH'.",
          ),
      },
    },
    async ({ assets }) => {
      try {
        const raw = await api("/data/prices/latest", { assets });
        const items = (raw as Record<string, unknown>)?.data
          ? ((raw as Record<string, unknown>).data as Record<string, unknown>)?.items
          : raw;
        const filtered: Record<string, unknown> = {};
        if (items && typeof items === "object") {
          for (const key of assets) {
            if ((items as Record<string, unknown>)[key] !== undefined) {
              filtered[key] = (items as Record<string, unknown>)[key];
            }
          }
        }
        return ok({ prices: Object.keys(filtered).length > 0 ? filtered : items });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_token_balances",
    {
      description: "Get token balances for a wallet on a chain.",
      inputSchema: {
        chainId: z.string().describe("Chain ID"),
        account: z.string().describe("Wallet address"),
        assets: z.string().describe("Comma-separated token addresses"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/data/token/balances", args));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Amount conversion — must be called before any action tool.
  // ---------------------------------------------------------------------------

  server.registerTool(
    "convert_amount",
    {
      description:
        "Convert a human-readable token amount (or a USD value) to the integer base-unit string " +
        "required by action tools (get_deposit_calldata, get_withdraw_calldata, get_borrow_calldata, get_repay_calldata). " +
        "ALWAYS call this tool before an action tool — never guess base units manually. " +
        "The decimals and priceUsd values are returned by get_lending_markets / find_market in each market object. " +
        "Mode 1 – token amount: supply humanAmount + decimals. Example: 1 USDC, decimals=6 → '1000000'. " +
        "Mode 2 – USD value: supply usdAmount + priceUsd + decimals. Example: $10 of WETH at $2000/ETH, decimals=18 → '5000000000000000'.",
      inputSchema: {
        decimals: z.number().int().describe("Token decimals from the market object (e.g. 18 for WETH, 6 for USDC/USDT, 8 for WBTC)"),
        humanAmount: z
          .string()
          .optional()
          .describe("Human-readable token amount e.g. '1', '0.5', '0.001'. Use this when the user specifies an amount in token units."),
        usdAmount: z
          .string()
          .optional()
          .describe("USD value to convert e.g. '100'. Use this when the user specifies an amount in USD. Requires priceUsd."),
        priceUsd: z
          .number()
          .optional()
          .describe("Token price in USD — use the priceUsd field from the market object. Required when usdAmount is provided."),
      },
    },
    ({ decimals, humanAmount, usdAmount, priceUsd }) => {
      try {
        let tokenAmount: number;
        if (usdAmount !== undefined) {
          if (!priceUsd || priceUsd === 0) return err("priceUsd is required and must be non-zero when usdAmount is provided");
          tokenAmount = parseFloat(usdAmount) / priceUsd;
        } else if (humanAmount !== undefined) {
          tokenAmount = parseFloat(humanAmount);
        } else {
          return err("Provide either humanAmount or usdAmount");
        }
        if (isNaN(tokenAmount) || tokenAmount < 0) return err("Invalid amount");
        // Use string-based arithmetic to avoid floating-point precision loss.
        const fixed = tokenAmount.toFixed(decimals);
        const [intPart, fracPart = ""] = fixed.split(".");
        const fracPadded = fracPart.padEnd(decimals, "0").slice(0, decimals);
        const scale = BigInt(10) ** BigInt(decimals);
        const baseUnits = (BigInt(intPart) * scale + BigInt(fracPadded)).toString();
        return ok({ baseUnits, humanAmount: tokenAmount, decimals });
      } catch (e) {
        return err(e);
      }
    },
  );

  const AMOUNT_DESC = "Amount in base units (integer string). Use convert_amount to obtain this from a human-readable token amount or USD value together with the market's decimals and priceUsd fields.";

  server.registerTool(
    "get_deposit_calldata",
    {
      description: "Build calldata to deposit into a lending pool. Call convert_amount first to get the base-unit amount.",
      inputSchema: {
        marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
        amount: z.string().describe(AMOUNT_DESC),
        operator: z.string().describe("Wallet address"),
        receiver: z.string().optional().describe("Receipt recipient (default: operator)"),
        mode: z
          .enum(["direct", "proxy"])
          .optional()
          .describe("direct=raw protocol, proxy=1delta"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/actions/lending/deposit", { ...args, simulate: true }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_withdraw_calldata",
    {
      description: "Build calldata to withdraw from a lending pool. Call convert_amount first to get the base-unit amount.",
      inputSchema: {
        marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
        amount: z.string().describe(AMOUNT_DESC),
        operator: z.string().describe("Wallet address"),
        receiver: z.string().optional().describe("Recipient address"),
        isAll: z.boolean().optional().describe("Withdraw full balance"),
        mode: z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/actions/lending/withdraw", { ...args, simulate: true }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_borrow_calldata",
    {
      description: "Build calldata to borrow from a lending pool. Call convert_amount first to get the base-unit amount.",
      inputSchema: {
        marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
        amount: z.string().describe(AMOUNT_DESC),
        operator: z.string().describe("Wallet address"),
        receiver: z.string().optional().describe("Recipient address"),
        lendingMode: z
          .enum(["0", "1", "2"])
          .optional()
          .describe("Rate mode: 0=none 1=stable 2=variable"),
        mode: z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/actions/lending/borrow", { ...args, simulate: true }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_repay_calldata",
    {
      description: "Build calldata to repay borrowed assets. Call convert_amount first to get the base-unit amount.",
      inputSchema: {
        marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
        amount: z.string().describe(AMOUNT_DESC),
        operator: z.string().describe("Wallet address"),
        isAll: z.boolean().optional().describe("Repay full balance"),
        lendingMode: z
          .enum(["0", "1", "2"])
          .optional()
          .describe("Rate mode: 0=none 1=stable 2=variable"),
        mode: z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
      },
    },
    async (args) => {
      try {
        return ok(await api("/actions/lending/repay", { ...args, simulate: true }));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Documentation resources ──────────────────────────────────────────────────

  server.registerResource(
    "overview",
    "docs://overview",
    { mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# 1delta Lending MCP Server

## What is this?

This MCP server gives AI assistants (Claude, GPT, Gemini, etc.) and developer tooling direct access to the **1delta lending aggregator** — a DeFi protocol that aggregates lending markets across chains.

Through this server you can:
- **Query** lending markets, token prices, wallet balances, and user positions
- **Build transactions** to deposit, withdraw, borrow, and repay across 30+ chains

## Available resources

| URI | Description |
|-----|-------------|
| \`docs://overview\` | This document |
| \`docs://authentication\` | How to authenticate for better rate limits |
| \`docs://tools\` | Full tool reference with parameters and examples |
| \`docs://chains\` | Supported chain IDs |
| \`docs://lenders\` | Supported lending protocol identifiers |

## Quick start

1. Connect your MCP client to this server's endpoint \`/mcp\`
2. Optionally supply your 1delta API key via \`Authorization: Bearer <key>\` on the initialize request
3. Call \`get_supported_chains\` and \`get_lender_ids\` to discover available networks and protocols
4. Use \`find_market\` or \`get_lending_markets\` to locate a market
5. Use \`get_deposit_calldata\` / \`get_borrow_calldata\` / etc. to build transactions

## Supported networks (sample)

Ethereum (1), Arbitrum (42161), Base (8453), Polygon (137), Optimism (10), Mantle (5000), Scroll (534352), Linea (59144), Avalanche (43114), BNB Chain (56), and 20+ more.

Call \`get_supported_chains\` for the full current list.
`,
        },
      ],
    }),
  );

  server.registerResource(
    "authentication",
    "docs://authentication",
    { mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Authentication

## API key (optional)

Supplying a 1delta API key gives your session higher rate limits on the 1delta Portal API.

**How to provide your key:**

Include it as a Bearer token in the HTTP \`Authorization\` header on the MCP \`initialize\` request:

\`\`\`
Authorization: Bearer <your-1delta-api-key>
\`\`\`

The key is captured at session initialization and forwarded as \`x-api-key\` on every 1delta API call made during your session.

## Without a key

Requests still work but are subject to the public rate limits of the 1delta Portal API.

## Key resolution order

1. Client-supplied key (via \`Authorization\` header) — highest priority
2. Server environment variable \`ONEDELTA_API_KEY\` — server-level fallback
3. No key — public rate limits

## Get a key

Register at [auth.1delta.io](https://auth.1delta.io) to obtain a 1delta API key.
`,
        },
      ],
    }),
  );

  server.registerResource(
    "tools",
    "docs://tools",
    { mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Tool Reference

## Data tools

### \`find_market\`
Find a lending market's \`marketUid\` by token and/or protocol. Call this before any action tool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | string | yes | Numeric chain ID e.g. \`"42161"\` for Arbitrum |
| assetGroup | string | no | Asset name e.g. \`"USDC"\`, \`"ETH"\` (use \`"ETH"\` for WETH) |
| tokenAddress | string | no | Token contract address (0x-) |
| lender | string | no | Protocol ID e.g. \`"AAVE_V3"\` |
| count | number | no | Max results (default 10) |
| minTvlUsd | number | no | Min TVL filter (default 10000) |

Returns: \`{ markets: [...], filteredCount: number }\`

---

### \`get_lending_markets\`
Browse markets with sorting and filtering. Use \`sortBy="depositRate"&sortDir="desc"\` to find the best yield.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | string | yes | Chain ID |
| lender | string | no | Protocol ID filter |
| assetGroups | string | no | Comma-separated asset names |
| minYield / maxYield | number | no | Deposit rate bounds |
| minTvlUsd | number | no | Min TVL (default 10000) |
| sortBy | enum | no | \`depositRate\` \| \`variableBorrowRate\` \| \`utilization\` \| \`totalDepositsUsd\` |
| sortDir | enum | no | \`asc\` \| \`desc\` |
| count | number | no | Results (default 100) |

---

### \`get_user_positions\`
Get all lending and borrowing positions for a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| account | string | yes | Wallet address (0x-) |
| chains | string | yes | Comma-separated chain IDs e.g. \`"1,42161"\` |
| lenders | string | no | Comma-separated lender IDs |

---

### \`get_supported_chains\`
Returns the full list of supported chains with IDs and names. No parameters.

---

### \`get_lender_ids\`
Returns all supported lending protocol identifiers (e.g. AAVE_V3, COMPOUND_V3, LENDLE). No parameters.

---

### \`get_token_info\`
Look up token metadata (address, decimals, symbol). Call this before action tools when decimals are unknown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | string | no | Chain ID |
| assetGroup | string | no | Asset group e.g. \`"USDC"\` |
| symbol | string | no | Token symbol |
| address | string | no | Token contract address |

---

### \`get_token_price\`
Get current USD prices by asset group key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assets | string[] | yes | Asset group keys e.g. \`["ETH","USDC"]\` |

---

### \`get_token_balances\`
Get token balances for a wallet on a specific chain.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | string | yes | Chain ID |
| account | string | yes | Wallet address |
| assets | string | yes | Comma-separated token addresses |

---

## Action tools

> Action tools return transaction calldata. The caller must sign and submit the transaction via their wallet.

### \`get_deposit_calldata\`
Build calldata to deposit tokens into a lending pool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| marketUid | string | yes | \`lender:chainId:tokenAddress\` |
| amount | string | yes | Amount in base units (no decimals) |
| operator | string | yes | Wallet address (signer) |
| receiver | string | no | Receipt recipient (default: operator) |
| mode | \`direct\`\|\`proxy\` | no | \`direct\` = raw protocol, \`proxy\` = via 1delta |

---

### \`get_withdraw_calldata\`
Build calldata to withdraw from a lending pool.

Same parameters as deposit, plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| isAll | boolean | no | Withdraw full balance |

---

### \`get_borrow_calldata\`
Build calldata to borrow from a lending pool.

Same parameters as deposit, plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lendingMode | \`"0"\`\|\`"1"\`\|\`"2"\` | no | Rate mode: 0=none, 1=stable, 2=variable |

---

### \`get_repay_calldata\`
Build calldata to repay borrowed assets.

Same parameters as borrow, plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| isAll | boolean | no | Repay full balance |

---

## Amount conversion

All action tools take \`amount\` in base units (integer string, no decimal point).

\`\`\`
human amount × 10^decimals = base units

Examples:
  1.5 USDC  → "1500000"      (decimals = 6)
  0.1 ETH   → "100000000000000000"  (decimals = 18)
  0.001 WBTC → "100000"      (decimals = 8)
\`\`\`

Use \`get_token_info\` to retrieve decimals for any token.
`,
        },
      ],
    }),
  );

  server.registerResource(
    "chains",
    "docs://chains",
    { mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Supported Chains

Call \`get_supported_chains\` for the live list with full metadata.

## Common chain IDs

| Chain | ID |
|-------|----|
| Ethereum | 1 |
| BNB Chain | 56 |
| Polygon | 137 |
| Optimism | 10 |
| Arbitrum | 42161 |
| Avalanche | 43114 |
| Base | 8453 |
| Mantle | 5000 |
| Scroll | 534352 |
| Linea | 59144 |
| zkSync Era | 324 |
| Polygon zkEVM | 1101 |
| Metis | 1088 |
| Taiko | 167000 |
| Gnosis | 100 |
| Fantom | 250 |

All \`chainId\` parameters are passed as **strings** (e.g. \`"42161"\`).
`,
        },
      ],
    }),
  );

  server.registerResource(
    "lenders",
    "docs://lenders",
    { mimeType: "text/markdown" },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# Supported Lending Protocols

Call \`get_lender_ids\` for the live list.

## Protocol identifiers

| ID | Protocol |
|----|---------|
| AAVE_V2 | Aave v2 |
| AAVE_V3 | Aave v3 |
| COMPOUND_V2 | Compound v2 |
| COMPOUND_V3 | Compound v3 |
| LENDLE | Lendle (Mantle) |
| AURELIUS | Aurelius (Mantle) |
| MENDI | Mendi Finance (Linea) |
| MOONWELL | Moonwell (Base) |
| SILO | Silo Finance |
| RADIANT_V2 | Radiant Capital v2 |
| MORPHO | Morpho |
| SPARK | Spark Protocol |
| VENUS | Venus (BNB Chain) |

Use these exact strings in the \`lender\` parameter of \`find_market\` and \`get_lending_markets\`.
`,
        },
      ],
    }),
  );

  return server;
}
