import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

const API_BASE_URL = "https://portal.1delta.io/v1";

async function makeApiRequest(endpoint: string, params: Record<string, unknown> = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  try {
    const response = await axios.get(url.toString());
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

server.registerTool(
  "get_lending_markets",
  {
    description: "Get available lending markets and pools with filters for chains, lenders, yields, and utilization",
    inputSchema: {
      chainId:   z.string().optional().describe("Filter by chain ID (e.g. '1' for Ethereum, '42161' for Arbitrum)"),
      lender:    z.string().optional().describe("Filter by lender protocol (e.g. 'AAVE_V3', 'COMPOUND_V3_USDC')"),
      minYield:  z.number().optional().describe("Minimum deposit rate (e.g. 0.05 for 5%)"),
      maxYield:  z.number().optional().describe("Maximum deposit rate"),
      minTvlUsd: z.number().optional().describe("Minimum total value locked in USD"),
      sortBy:    z.enum(["depositRate", "variableBorrowRate", "utilization", "totalDepositsUsd"]).optional().describe("Sort field"),
      count:     z.number().int().optional().describe("Number of results (default 100, max 1000)"),
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
    description: "Get current lending and borrowing positions for a user account across chains",
    inputSchema: {
      account: z.string().describe("User's EVM wallet address (0x-prefixed)"),
      chains:  z.string().describe("Comma-separated chain IDs (e.g. '1,42161')"),
      lenders: z.string().optional().describe("Comma-separated lender IDs to filter by"),
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
    description: "Get token balances for a user account on a specific chain",
    inputSchema: {
      chainId: z.string().describe("Chain ID (e.g. '1' for Ethereum)"),
      account: z.string().describe("User's wallet address"),
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
    description: "Build transaction calldata for depositing assets into a lending pool",
    inputSchema: {
      marketUid: z.string().describe("Market UID — format 'lender:chainId:tokenAddress' (e.g. 'AAVE_V3:1:0xC02aa...')"),
      amount:    z.string().describe("Deposit amount in wei"),
      operator:  z.string().describe("User wallet address executing the transaction"),
      receiver:  z.string().optional().describe("Address to receive the deposit receipt (defaults to operator)"),
      mode:      z.enum(["direct", "proxy"]).optional().describe("'direct' = raw protocol, 'proxy' = 1delta composer"),
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
    description: "Build transaction calldata for withdrawing assets from a lending pool",
    inputSchema: {
      marketUid: z.string().describe("Market UID — format 'lender:chainId:tokenAddress'"),
      amount:    z.string().describe("Withdrawal amount in wei"),
      operator:  z.string().describe("User wallet address executing the transaction"),
      receiver:  z.string().optional().describe("Address to receive the withdrawn assets"),
      isAll:     z.boolean().optional().describe("Withdraw the full balance"),
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
    description: "Build transaction calldata for borrowing assets from a lending pool",
    inputSchema: {
      marketUid:   z.string().describe("Market UID — format 'lender:chainId:tokenAddress'"),
      amount:      z.string().describe("Borrow amount in wei"),
      operator:    z.string().describe("User wallet address executing the transaction"),
      receiver:    z.string().optional().describe("Address to receive the borrowed assets"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Interest rate mode: 0=NONE, 1=STABLE, 2=VARIABLE"),
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
    description: "Build transaction calldata for repaying borrowed assets",
    inputSchema: {
      marketUid:   z.string().describe("Market UID — format 'lender:chainId:tokenAddress'"),
      amount:      z.string().describe("Repayment amount in wei"),
      operator:    z.string().describe("User wallet address executing the transaction"),
      isAll:       z.boolean().optional().describe("Repay the full debt balance"),
      lendingMode: z.enum(["0", "1", "2"]).optional().describe("Interest rate mode"),
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
