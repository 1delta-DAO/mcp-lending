import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

const API_BASE_URL = "https://portal.1delta.io/v1";

const ONEDELTA_API_KEY = process.env.ONEDELTA_API_KEY;

async function makeApiRequest(endpoint: string, params: Record<string, unknown> = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  const headers: Record<string, string> = {};
  if (ONEDELTA_API_KEY) headers['x-api-key'] = ONEDELTA_API_KEY;
  try {
    const response = await axios.get(url.toString(), { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `API Error ${error.response?.status}: ${error.response?.data?.error?.message ?? error.message}`
      );
    }
    throw error;
  }
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

// ---------------------------------------------------------------------------

const server = new McpServer({ name: "lending-mcp-server", version: "0.1.0" });

// ── Data tools ──────────────────────────────────────────────────────────────

// Returns slim pool projections filtered by TVL.
// - minTvlUsd filters on totalDepositsUsd (default 10 000) — the total deposits in the market.
// - availableLiquidityUsd = totalDepositsUsd × (1 − utilization) is included in each record as useful context.
// Returns { markets, filteredCount } so the AI can report how many were excluded.
function slimPools(
  raw: unknown,
  minTvlUsd = 10_000,
): { markets: unknown[]; filteredCount: number } {
  const rawData = (raw as Record<string, unknown>)?.data;
  const pools: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : Array.isArray((rawData as Record<string, unknown>)?.items)
      ? (rawData as Record<string, unknown>).items as Record<string, unknown>[]
      : Array.isArray(rawData)
        ? rawData as Record<string, unknown>[]
        : [];

  const all = pools.map((m) => {
    const tvl = parseFloat(m.totalDepositsUsd as string) || 0;
    const util = parseFloat(m.utilization as string) || 0;
    const availableLiquidityUsd = Math.round(tvl * (1 - util) * 100) / 100;
    return {
      marketUid:             m.marketUid,
      symbol:                m.assetGroup ?? m.symbol ?? m.tokenSymbol ?? (m.underlying as Record<string, unknown>)?.symbol,
      depositRate:           m.depositRate,
      variableBorrowRate:    m.variableBorrowRate,
      totalDepositsUsd:      tvl,
      availableLiquidityUsd,
      utilization:           util,
    };
  });

  const markets = all.filter((m) => m.totalDepositsUsd >= minTvlUsd);
  return { markets, filteredCount: all.length - markets.length };
}

server.registerTool(
  "find_market",
  {
    description: "Find a lending market's marketUid by token/protocol. Use this before deposit/withdraw/borrow/repay. Requires exact chainId and lender values — see get_supported_chains / get_lender_ids if unsure.",
    inputSchema: {
      chainId:          z.string().describe("Numeric chain ID as string. Common values: '1'=Ethereum, '56'=BNB, '137'=Polygon, '10'=Optimism, '42161'=Arbitrum, '43114'=Avalanche, '8453'=Base, '5000'=Mantle, '534352'=Scroll, '59144'=Linea. Call get_supported_chains if the chain is not listed here."),
      assetGroup:       z.string().optional().describe("Asset name e.g. 'USDC', 'ETH'. Note: WETH is mapped to 'ETH' — always use 'ETH' when searching for WETH markets."),
      tokenAddress:     z.string().optional().describe("Token contract address (0x-)"),
      lender:           z.string().optional().describe("Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE', 'COMPOUND_V3'. Call get_lender_ids to discover valid values."),
      count:            z.number().int().optional().describe("Max results (default 10)"),
      minTvlUsd:        z.number().optional().describe("Minimum TVL (totalDepositsUsd) in USD. Default 10000. Lower only if the user explicitly asks for small/illiquid markets."),
    },
  },
  async ({ chainId, assetGroup, tokenAddress, lender, count, minTvlUsd }) => {
    try {
      const raw = await makeApiRequest("/data/lending/pools", {
        chainId,
        assetGroups: assetGroup,
        underlyings: tokenAddress,
        lender,
        count: count ?? 10,
      });
      const result = slimPools(raw, minTvlUsd ?? 10_000);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_lending_markets",
  {
    description: "Browse lending markets with filters. For a specific marketUid use find_market instead. To find the best yield, use sortBy='depositRate' and sortOrder='desc'.",
    inputSchema: {
      chainId:         z.string().describe("Numeric chain ID as string e.g. '1'=Ethereum, '42161'=Arbitrum, '5000'=Mantle. Call get_supported_chains for the full list."),
      lender:          z.string().optional().describe("Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE'. Call get_lender_ids for the full list."),
      assetGroups:     z.string().optional().describe("Comma-separated asset names e.g. 'USDC', 'ETH'"),
      minYield:        z.number().optional().describe("Min deposit rate"),
      maxYield:        z.number().optional().describe("Max deposit rate"),
      minTvlUsd:       z.number().optional().describe("Minimum TVL (totalDepositsUsd) in USD. Default 10000. Lower only if the user explicitly asks for small/illiquid markets."),
      sortBy:          z.enum(["depositRate", "variableBorrowRate", "utilization", "totalDepositsUsd"]).optional().describe("Sort field"),
      sortDir:         z.enum(["asc", "desc"]).optional().describe("Sort direction. Use 'desc' for highest yield first."),
      count:           z.number().int().optional().describe("Results (default 100)"),
    },
  },
  async ({ minTvlUsd, ...args }) => {
    try {
      const raw = await makeApiRequest("/data/lending/pools", args);
      const result = slimPools(raw, minTvlUsd ?? 10_000);
      return ok(result);
    } catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_user_positions",
  {
    description: "Get lending/borrowing positions for a wallet across chains.",
    inputSchema: {
      account: z.string().describe("Wallet address (0x-)"),
      chains:  z.string().describe("Comma-separated chain IDs e.g. '1,42161'"),
      lenders: z.string().optional().describe("Comma-separated lender IDs"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/data/lending/user-positions", args)); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_supported_chains",
  {
    description: "Get list of supported chains with deployed composer proxies",
    inputSchema: {},
  },
  async () => {
    try { return ok(await makeApiRequest("/data/chains")); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_lender_ids",
  {
    description: "Get list of supported lending protocol identifiers",
    inputSchema: {},
  },
  async () => {
    try { return ok(await makeApiRequest("/data/lender-ids")); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_token_info",
  {
    description: "Look up token metadata (address, decimals, symbol, name) by assetGroup, symbol, address, and/or chainId. One assetGroup can map to multiple tokens across chains. Add chainId to identify a specific token. Always call this before an action when the token's decimals are not known, so you can correctly convert human-readable amounts to base units.",
    inputSchema: {
      chainId:    z.string().optional().describe("Chain ID e.g. '42161'"),
      assetGroup: z.string().optional().describe("Asset group name e.g. 'ETH', 'USDC'. Note: WETH is stored as 'ETH'."),
      symbol:     z.string().optional().describe("Token symbol e.g. 'USDC'"),
      address:    z.string().optional().describe("Token contract address (0x-)"),
      lender:     z.string().optional().describe("Filter to assets available on this lender"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/data/token/available", args)); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_token_balances",
  {
    description: "Get token balances for a wallet on a chain.",
    inputSchema: {
      chainId: z.string().describe("Chain ID"),
      account: z.string().describe("Wallet address"),
      assets:  z.string().describe("Comma-separated token addresses"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/data/token/balances", args)); }
    catch (e) { return err(e); }
  }
);

// ── Action tools ─────────────────────────────────────────────────────────────

server.registerTool(
  "get_deposit_calldata",
  {
    description: "Build calldata to deposit into a lending pool.",
    inputSchema: {
      marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:    z.string().describe("Amount in the token's base units (no decimals). Convert the human-readable amount: multiply by 10^decimals. Common decimals: ETH/WETH/most ERC-20s=18, USDC/USDT=6, WBTC=8. E.g. 0.00026 WETH → '260000000000000', 0.5 USDC → '500000'."),
      operator:  z.string().describe("Wallet address"),
      receiver:  z.string().optional().describe("Receipt recipient (default: operator)"),
      mode:      z.enum(["direct", "proxy"]).optional().describe("direct=raw protocol, proxy=1delta"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/deposit", { ...args, simulate: true })); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_withdraw_calldata",
  {
    description: "Build calldata to withdraw from a lending pool.",
    inputSchema: {
      marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:    z.string().describe("Amount in the token's base units (no decimals). Convert the human-readable amount: multiply by 10^decimals. Common decimals: ETH/WETH/most ERC-20s=18, USDC/USDT=6, WBTC=8. E.g. 0.00026 WETH → '260000000000000', 0.5 USDC → '500000'."),
      operator:  z.string().describe("Wallet address"),
      receiver:  z.string().optional().describe("Recipient address"),
      isAll:     z.boolean().optional().describe("Withdraw full balance"),
      mode:      z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/withdraw", { ...args, simulate: true })); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_borrow_calldata",
  {
    description: "Build calldata to borrow from a lending pool.",
    inputSchema: {
      marketUid:   z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:      z.string().describe("Amount in the token's base units (no decimals). Convert the human-readable amount: multiply by 10^decimals. Common decimals: ETH/WETH/most ERC-20s=18, USDC/USDT=6, WBTC=8. E.g. 0.00026 WETH → '260000000000000', 0.5 USDC → '500000'."),
      operator:    z.string().describe("Wallet address"),
      receiver:    z.string().optional().describe("Recipient address"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Rate mode: 0=none 1=stable 2=variable"),
      mode:        z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/borrow", { ...args, simulate: true })); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_repay_calldata",
  {
    description: "Build calldata to repay borrowed assets.",
    inputSchema: {
      marketUid:   z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:      z.string().describe("Amount in the token's base units (no decimals). Convert the human-readable amount: multiply by 10^decimals. Common decimals: ETH/WETH/most ERC-20s=18, USDC/USDT=6, WBTC=8. E.g. 0.00026 WETH → '260000000000000', 0.5 USDC → '500000'."),
      operator:    z.string().describe("Wallet address"),
      isAll:       z.boolean().optional().describe("Repay full balance"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Rate mode: 0=none 1=stable 2=variable"),
      mode:        z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/repay", { ...args, simulate: true })); }
    catch (e) { return err(e); }
  }
);

// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lending MCP Server started on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
