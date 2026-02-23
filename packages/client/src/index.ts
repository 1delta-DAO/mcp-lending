import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

// Resolve the backend binary path relative to this compiled file.
// When compiled: packages/client/dist/index.js -> ../../backend/dist/index.js = packages/backend/dist/index.js
const BACKEND_PATH = new URL("../../backend/dist/index.js", import.meta.url).pathname;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let mcpClient: Client;

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

async function callMCPTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    const response = await mcpClient.callTool({ name, arguments: input });
    return JSON.stringify(response.content, null, 2);
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function processQuery(userQuery: string): Promise<string> {
  const { tools } = await mcpClient.listTools();
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: (t.inputSchema as AnyRecord) ?? { type: "object", properties: {} },
  }));

  const messages: AnyRecord[] = [{ role: "user", content: userQuery }];

  let response: AnyRecord = await (anthropic.messages.create as unknown as (p: AnyRecord) => Promise<AnyRecord>)({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools: toolDefs,
    messages,
  });

  // Agentic loop — continue until Claude stops requesting tools
  while (response.stop_reason === "tool_use") {
    const toolResults: AnyRecord[] = [];

    for (const block of response.content as AnyRecord[]) {
      if (block.type === "tool_use") {
        console.log(`→ tool: ${block.name}`);
        const result = await callMCPTool(block.name as string, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await (anthropic.messages.create as unknown as (p: AnyRecord) => Promise<AnyRecord>)({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: toolDefs,
      messages,
    });
  }

  return (response.content as AnyRecord[])
    .filter((b) => b.type === "text")
    .map((b) => b.text as string)
    .join("");
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

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
        const { query } = JSON.parse(body) as { query?: string };

        if (!query || typeof query !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "query field is required" }));
          return;
        }

        console.log(`\nQuery: ${query}`);
        const response = await processQuery(query);

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
