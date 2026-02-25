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

// Returns a slim projection of pool objects — just the fields needed for routing.
// Handles both `data[]` envelope and bare array responses.
function slimPools(raw: unknown): unknown {
  const pools: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
      ? (raw as Record<string, unknown>).data as Record<string, unknown>[]
      : [];

  return pools.map((m) => ({
    marketUid:          m.marketUid,
    symbol:             m.symbol ?? m.tokenSymbol ?? (m.underlying as Record<string, unknown>)?.symbol,
    depositRate:        m.depositRate,
    variableBorrowRate: m.variableBorrowRate,
    totalDepositsUsd:   m.totalDepositsUsd,
    utilization:        m.utilization,
  }));
}

server.registerTool(
  "find_market",
  {
    description: "Find a lending market's marketUid by token/protocol. Use this before deposit/withdraw/borrow/repay. Requires exact chainId and lender values — see get_supported_chains / get_lender_ids if unsure.",
    inputSchema: {
      chainId:      z.string().describe("Numeric chain ID as string. Common values: '1'=Ethereum, '56'=BNB, '137'=Polygon, '10'=Optimism, '42161'=Arbitrum, '43114'=Avalanche, '8453'=Base, '5000'=Mantle, '534352'=Scroll, '59144'=Linea. Call get_supported_chains if the chain is not listed here."),
      assetGroup:   z.string().optional().describe("Asset name e.g. 'USDC', 'WETH'"),
      tokenAddress: z.string().optional().describe("Token contract address (0x-)"),
      lender:       z.string().optional().describe("Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE', 'COMPOUND_V3'. Call get_lender_ids to discover valid values."),
      count:        z.number().int().optional().describe("Max results (default 10)"),
    },
  },
  async ({ chainId, assetGroup, tokenAddress, lender, count }) => {
    try {
      const raw = await makeApiRequest("/data/lending/pools", {
        chainId,
        assetGroups: assetGroup,
        underlyings: tokenAddress,
        lender,
        count: count ?? 10,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(slimPools(raw)) }] };
    } catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_lending_markets",
  {
    description: "Browse lending markets with filters. For a specific marketUid use find_market instead.",
    inputSchema: {
      chainId:   z.string().optional().describe("Numeric chain ID as string e.g. '1'=Ethereum, '42161'=Arbitrum, '5000'=Mantle. Call get_supported_chains for the full list."),
      lender:    z.string().optional().describe("Exact lender protocol ID e.g. 'AAVE_V3', 'LENDLE'. Call get_lender_ids for the full list."),
      minYield:  z.number().optional().describe("Min deposit rate"),
      maxYield:  z.number().optional().describe("Max deposit rate"),
      minTvlUsd: z.number().optional().describe("Min TVL in USD"),
      sortBy:    z.enum(["depositRate", "variableBorrowRate", "utilization", "totalDepositsUsd"]).optional().describe("Sort field"),
      count:     z.number().int().optional().describe("Results (default 100)"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/data/lending/pools", args)); }
    catch (e) { return err(e); }
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
      amount:    z.string().describe("Amount in wei"),
      operator:  z.string().describe("Wallet address"),
      receiver:  z.string().optional().describe("Receipt recipient (default: operator)"),
      mode:      z.enum(["direct", "proxy"]).optional().describe("direct=raw protocol, proxy=1delta"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/deposit", args)); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_withdraw_calldata",
  {
    description: "Build calldata to withdraw from a lending pool.",
    inputSchema: {
      marketUid: z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:    z.string().describe("Amount in wei"),
      operator:  z.string().describe("Wallet address"),
      receiver:  z.string().optional().describe("Recipient address"),
      isAll:     z.boolean().optional().describe("Withdraw full balance"),
      mode:      z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/withdraw", args)); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_borrow_calldata",
  {
    description: "Build calldata to borrow from a lending pool.",
    inputSchema: {
      marketUid:   z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:      z.string().describe("Amount in wei"),
      operator:    z.string().describe("Wallet address"),
      receiver:    z.string().optional().describe("Recipient address"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Rate mode: 0=none 1=stable 2=variable"),
      mode:        z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/borrow", args)); }
    catch (e) { return err(e); }
  }
);

server.registerTool(
  "get_repay_calldata",
  {
    description: "Build calldata to repay borrowed assets.",
    inputSchema: {
      marketUid:   z.string().describe("Market UID (lender:chainId:tokenAddress)"),
      amount:      z.string().describe("Amount in wei"),
      operator:    z.string().describe("Wallet address"),
      isAll:       z.boolean().optional().describe("Repay full balance"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Rate mode: 0=none 1=stable 2=variable"),
      mode:        z.enum(["direct", "proxy"]).optional().describe("Execution mode"),
    },
  },
  async (args) => {
    try { return ok(await makeApiRequest("/actions/lending/repay", args)); }
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
