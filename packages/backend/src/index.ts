import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { createMcpServer } from "./mcp-server.js";

const PORT = parseInt(process.env.PORT ?? "3002", 10);
const SERVER_API_KEY = process.env.ONEDELTA_API_KEY;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// sessionId → transport (one McpServer instance per session)
const transports = new Map<string, StreamableHTTPServerTransport>();

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const body = await readBody(req);
      await transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    const body = await readBody(req);
    let message: Record<string, unknown> = {};
    try { message = JSON.parse(body); } catch { /* handled below */ }

    if (message?.method !== "initialize") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Expected initialize request for new session" }));
      return;
    }

    const authHeader = req.headers["authorization"];
    const clientApiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim() || undefined
      : undefined;

    if (clientApiKey) {
      console.log("Session authenticated with client API key");
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports.set(id, transport); },
    });

    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const mcpServer = createMcpServer(clientApiKey ?? SERVER_API_KEY);
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  if (req.method === "GET") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or missing Mcp-Session-Id" }));
      return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
    return;
  }

  if (req.method === "DELETE") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

async function main() {
  const httpServer = createServer(async (req, res) => {
    const path = req.url?.split("?")[0];
    if (path === "/mcp") {
      try {
        await handleMcpRequest(req, res);
      } catch (error) {
        console.error("MCP request error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`Lending MCP Server running on http://localhost:${PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
