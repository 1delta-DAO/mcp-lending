import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { createProvider } from "./providers/index.js";
import type { AIProvider } from "./providers/index.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

// Resolve the backend binary path relative to this compiled file.
// When compiled: packages/client/dist/index.js -> ../../backend/dist/index.js = packages/backend/dist/index.js
const BACKEND_PATH = new URL("../../backend/dist/index.js", import.meta.url).pathname;

let mcpClient: Client;
let aiProvider: AIProvider;

async function initializeMCPClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [BACKEND_PATH],
  });

  const mcp = new Client({ name: "claude-lending-client", version: "0.1.0" });
  await mcp.connect(transport);

  const { tools } = await mcp.listTools();
  console.log(`MCP server connected — ${tools.length} tools available`);
  tools.forEach((t) => console.log(`  • ${t.name}`));

  return mcp;
}

// Cap tool results to keep input token counts within rate limits.
// ~4 chars per token → 6000 chars ≈ 1500 tokens per tool result.
const TOOL_RESULT_CHAR_LIMIT = 6000;

async function callMCPTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    const response = await mcpClient.callTool({ name, arguments: input });
    // Extract the text payload directly instead of re-serialising the MCP envelope.
    const text = (response.content as { type: string; text?: string }[])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");
    if (text.length <= TOOL_RESULT_CHAR_LIMIT) return text;
    return text.slice(0, TOOL_RESULT_CHAR_LIMIT) + `\n[truncated — ${text.length - TOOL_RESULT_CHAR_LIMIT} chars omitted. Use tighter filters to reduce results.]`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function main() {
  // createProvider() validates the required API key for the selected provider
  aiProvider = createProvider();

  console.log("Initializing MCP client…");
  mcpClient = await initializeMCPClient();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    cors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/chat") {
      try {
        const body = await readBody(req);
        const { query, userAddress } = JSON.parse(body) as { query?: string; userAddress?: string };

        if (!query || typeof query !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "query field is required" }));
          return;
        }

        const fullQuery = userAddress
          ? `The user's connected wallet address is: ${userAddress}\n\n${query}`
          : query;

        console.log(`\nQuery: ${query}${userAddress ? ` (wallet: ${userAddress})` : ""}`);
        const { tools } = await mcpClient.listTools();
        const response = await aiProvider.processQuery(fullQuery, tools, callMCPTool);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ response }));
      } catch (err) {
        console.error("Error processing query:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(PORT, () => {
    console.log(`Client HTTP server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
