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
      risk: (m.risk as Record<string, unknown> | undefined)
        ? {
            score: (m.risk as Record<string, unknown>).score,
            label: (m.risk as Record<string, unknown>).label,
          }
        : undefined,
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
        maxRiskScore: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Maximum risk score to include (1=safe … 5=high risk). Default 4 — score-5 markets are excluded unless the user explicitly asks to include high-risk markets."),
      },
    },
    async ({ chainId, assetGroup, tokenAddress, lender, count, minTvlUsd, maxRiskScore }) => {
      try {
        const raw = await api("/data/lending/pools", {
          chainId,
          assetGroups: assetGroup,
          underlyings: tokenAddress,
          lender,
          count: count ?? 10,
          maxRiskScore: maxRiskScore ?? 4,
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
        maxRiskScore: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Maximum risk score to include (1=safe … 5=high risk). Default 4 — score-5 markets are excluded unless the user explicitly asks to include high-risk markets."),
      },
    },
    async ({ minTvlUsd, maxRiskScore, ...args }) => {
      try {
        const raw = await api("/data/lending/pools", { ...args, maxRiskScore: maxRiskScore ?? 4 });
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
| \`docs://chains\` | Supported chain IDs with human-readable names |
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

## Market response fields

Both \`find_market\` and \`get_lending_markets\` return markets with these fields:

| Field | Description |
|-------|-------------|
| marketUid | Unique market identifier (\`lender:chainId:tokenAddress\`) |
| symbol | Token symbol |
| tokenAddress | Underlying token contract address |
| decimals | Token decimals — use with \`convert_amount\` before action tools |
| priceUsd | Current token price in USD — use with \`convert_amount\` for USD-based amounts |
| depositRate | Deposit APR (%) |
| variableBorrowRate | Variable borrow APR (%) |
| totalDepositsUsd | Total value locked (USD) |
| availableLiquidityUsd | Liquidity available to borrow/withdraw |
| utilization | Utilization ratio (0–1) |
| risk.score | Risk score 0–5 (0=unknown, 1=safe, 2=low, 3=medium, 4=elevated, 5=high risk). Score 5 (high risk) is excluded from all results. |
| risk.label | Human-readable risk label |

---

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
| maxRiskScore | number | no | Max risk score 1–5 (default 4, excludes score-5 high-risk markets) |

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
| maxRiskScore | number | no | Max risk score 1–5 (default 4, excludes score-5 high-risk markets) |

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
Returns the live list of supported chain IDs (e.g. \`"1"\`, \`"42161"\`, \`"8453"\`). No parameters. Call this when you need to resolve a chain name to its ID or verify a chain is supported.

---

### \`get_lender_ids\`
Returns the live list of all supported lending protocol identifiers. No parameters. Call this to get valid \`lender\` parameter values for \`find_market\` and \`get_lending_markets\` — the list includes 130+ protocols (AAVE_V3, COMPOUND_V3, LENDLE, MOONWELL, MORPHO_BLUE, SILO_V2, EULER_V2, VENUS, and many more).

---

### \`get_token_info\`
Look up token metadata (address, decimals, symbol) for tokens not in a market result.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | string | no | Chain ID |
| assetGroup | string | no | Asset group e.g. \`"USDC"\` |
| symbol | string | no | Token symbol |
| address | string | no | Token contract address |

---

### \`get_token_price\`
Get current USD prices by asset group key. Use only when a token's price is not available from a market result.

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

## Amount conversion

### \`convert_amount\`
**Always call this before any action tool.** Converts a human-readable amount to the integer base-unit string required by action tools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| decimals | number | yes | Token decimals from the market object |
| humanAmount | string | no | Token amount e.g. \`"1"\`, \`"0.001"\` |
| usdAmount | string | no | USD value e.g. \`"100"\` — requires \`priceUsd\` |
| priceUsd | number | no | Token price from the market's \`priceUsd\` field |

**Examples:**
\`\`\`
// 1 USDC (decimals=6)
convert_amount({ humanAmount: "1", decimals: 6 }) → { baseUnits: "1000000" }

// $10 of WETH at $2000/ETH (decimals=18)
convert_amount({ usdAmount: "10", priceUsd: 2000, decimals: 18 }) → { baseUnits: "5000000000000000" }
\`\`\`

---

## Action tools

> Action tools return transaction calldata. The caller must sign and submit the transaction via their wallet.
> Always call \`convert_amount\` first to obtain the base-unit \`amount\`.

### \`get_deposit_calldata\`
Build calldata to deposit tokens into a lending pool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| marketUid | string | yes | \`lender:chainId:tokenAddress\` |
| amount | string | yes | Base-unit amount from \`convert_amount\` |
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

## Asset group mappings

The \`assetGroup\` parameter used in \`find_market\` and \`get_lending_markets\` follows these rules:

| Token | assetGroup to use |
|-------|-------------------|
| WETH | \`"ETH"\` |
| All other tokens | Their own symbol (e.g. \`"USDC"\`, \`"WBTC"\`, \`"WSTETH"\`) |

> **Note:** The ETH mapping applies **only** to WETH. Staked/wrapped ETH variants (wstETH, stETH, rETH, cbETH) use their own symbols.

---

## Action tool response format

Action tools (\`get_deposit_calldata\`, \`get_withdraw_calldata\`, \`get_borrow_calldata\`, \`get_repay_calldata\`) return calldata in this JSON structure:

\`\`\`json
{
  "actions": {
    "permissions": [
      { "to": "0x...", "data": "0x...", "value": "0x0", "info": "approve" }
    ],
    "transactions": [
      { "to": "0x...", "data": "0x...", "value": "0x0" }
    ]
  }
}
\`\`\`

- **\`permissions\`** — ERC-20 approval transactions that **must be submitted first** before the main transaction.
- **\`transactions\`** — The main protocol transaction(s) to submit after permissions.

Each entry contains \`to\` (contract address), \`data\` (encoded calldata), and \`value\` (ETH value in hex). The client is responsible for signing and submitting these to the network via a wallet provider (e.g. ethers.js, viem, MetaMask).

---

## Action flow summary

\`\`\`
1. get_lending_markets / find_market  →  get marketUid, decimals, priceUsd
2. convert_amount(humanAmount or usdAmount, decimals, priceUsd?)  →  baseUnits
3. get_deposit/withdraw/borrow/repay_calldata(marketUid, amount=baseUnits, operator)
   → returns actions.permissions (approvals) + actions.transactions (main tx)
4. Submit permissions first, then transactions — via wallet/signer on the target chain
\`\`\`

---

## APR definitions

- **depositRate** is the lender's deposit APR only — the yield the protocol pays on supplied assets.
- **True depositor yield** = intrinsic asset APR + depositRate. Intrinsic APR comes from the underlying asset (e.g. staking yield for stETH). When unknown, present depositRate as the deposit APR and note that intrinsic yield may add to it.
- **variableBorrowRate** is a cost paid by the borrower — a positive value means the user pays that interest.
- **Net APR** for a deposit+borrow position (no leverage): Net APR = depositRate + intrinsicAPR − variableBorrowRate. Positive = earns; negative = pays net interest.
- When presenting borrow rates, frame them as a cost: "you pay X% APR to borrow".
- Do not conflate depositRate with full yield — always clarify that intrinsic asset yield may apply on top.

---

## Liquidity and TVL

- **TVL** (totalDepositsUsd) = total deposits in a market.
- **Available liquidity** (availableLiquidityUsd) = TVL × (1 − utilization). Represents funds available to borrow or withdraw — it has no bearing on whether new deposits are possible.
- Depositing is always possible regardless of available liquidity. $0 available liquidity means 100% utilization (maximum deposit yield) — a positive signal for depositors, not a warning.
- Never warn that $0 or low available liquidity prevents depositing. Only a supplyCap (not exposed in current data) could block new deposits.
- Tools filter markets by TVL (default: $10,000 minimum via minTvlUsd). Each response includes a **filteredCount** field. If filteredCount > 0, append: *Note: X market(s) with less than $Y TVL were excluded.*
- If the user asks for all markets including small ones, pass minTvlUsd: 0 to the tool.
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

Call \`get_supported_chains\` to verify the live list. All \`chainId\` parameters are passed as **strings**.

| Chain | ID |
|-------|----|
| Ethereum | 1 |
| OP Mainnet | 10 |
| Cronos | 25 |
| Telos | 40 |
| XDC Network | 50 |
| BNB Smart Chain | 56 |
| Gnosis | 100 |
| Unichain | 130 |
| Polygon | 137 |
| Monad | 143 |
| Sonic | 146 |
| Manta Pacific | 169 |
| Fantom | 250 |
| Metis | 1088 |
| Core DAO | 1116 |
| Moonbeam | 1284 |
| Sei Network | 1329 |
| Soneium | 1868 |
| Morph | 2818 |
| Mantle | 5000 |
| Klaytn | 8217 |
| Base | 8453 |
| Plasma | 9745 |
| Mode | 34443 |
| Arbitrum One | 42161 |
| Hemi | 43111 |
| Avalanche | 43114 |
| Linea | 59144 |
| Berachain | 80094 |
| Blast | 81457 |
| Taiko | 167000 |
| Scroll | 534352 |
| Katana | 747474 |
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

Call \`get_lender_ids\` to verify the live list. Use these exact strings in the \`lender\` parameter of \`find_market\` and \`get_lending_markets\`.

| ID | Protocol |
|----|---------|
| AAVE_V2 | Aave v2 |
| AAVE_V3 | Aave v3 |
| AAVE_V3_PRIME | Aave v3 Prime |
| AAVE_V3_ETHER_FI | Aave v3 Ether.fi |
| AAVE_V3_HORIZON | Aave v3 Horizon |
| AURELIUS | Aurelius (Mantle) |
| LENDLE | Lendle (Mantle) |
| LENDLE_CMETH | Lendle cMETH (Mantle) |
| LENDLE_SUSDE | Lendle sUSDe (Mantle) |
| MERIDIAN | Meridian |
| SPARK | Spark Protocol |
| MORPHO_BLUE | Morpho Blue |
| RADIANT_V2 | Radiant Capital v2 |
| ZEROLEND | ZeroLend |
| AVALON | Avalon |
| COMPOUND_V2 | Compound v2 |
| COMPOUND_V3_USDC | Compound v3 USDC |
| COMPOUND_V3_USDT | Compound v3 USDT |
| COMPOUND_V3_USDE | Compound v3 USDe |
| COMPOUND_V3_USDBC | Compound v3 USDbC |
| COMPOUND_V3_USDCE | Compound v3 USDC.e |
| COMPOUND_V3_USDS | Compound v3 USDS |
| COMPOUND_V3_WETH | Compound v3 WETH |
| COMPOUND_V3_WBTC | Compound v3 WBTC |
| VENUS | Venus (BNB Chain) |
| VENUS_ETH | Venus ETH market |
| VENUS_BNB | Venus BNB market |
| VENUS_BTC | Venus BTC market |
| BENQI | Benqi (Avalanche) |
| MOONWELL | Moonwell (Base) |
| MENDI | Mendi Finance (Linea) |
| SILO_V2 | Silo v2 |
| EULER_V2 | Euler v2 |
| INIT | Init Capital |
| LISTA_DAO | Lista DAO |
| LAYERBANK_V3 | LayerBank v3 |
| KEOM | Keom |
| OVIX | 0VIX |
| LODESTAR | Lodestar |
| TECTONIC | Tectonic |
| KINZA | Kinza Finance |
| YLDR | YLDR |
| HYPERLEND | HyperLend |
| HYPURRFI | HypurrFi |
| SWAYLEND_USDC | Swaylend USDC |
`,
        },
      ],
    }),
  );

  return server;
}
