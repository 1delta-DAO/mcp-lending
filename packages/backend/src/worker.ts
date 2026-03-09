/// <reference types="@cloudflare/workers-types" />
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp-server.js";

export interface Env {
  MCP_SESSION: DurableObjectNamespace;
  ONEDELTA_API_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Authorization, MCP-Protocol-Version",
};

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Worker fetch handler — routes each request to the correct Durable Object.
//
// Session mapping:
//   - New session (no Mcp-Session-Id header, POST): create a new DO instance.
//   - Existing session: resolve the DO by its hex ID (which IS the session ID).
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/mcp") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const sessionId = request.headers.get("mcp-session-id");

    let doId: DurableObjectId;
    if (sessionId) {
      try {
        doId = env.MCP_SESSION.idFromString(sessionId);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid Mcp-Session-Id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    } else if (request.method === "POST") {
      // No session yet — create a new DO instance for this session.
      doId = env.MCP_SESSION.newUniqueId();
    } else {
      return new Response(JSON.stringify({ error: "Missing Mcp-Session-Id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const stub = env.MCP_SESSION.get(doId);
    const response = await stub.fetch(request);
    return addCors(response);
  },
};

// ---------------------------------------------------------------------------
// McpSessionDO — one Durable Object instance per MCP client session.
//
// The DO's hex ID is used directly as the MCP session ID, so the Worker can
// always resolve the right DO via env.MCP_SESSION.idFromString(sessionId).
// ---------------------------------------------------------------------------

export class McpSessionDO {
  private transport?: WebStandardStreamableHTTPServerTransport;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (!this.transport) {
      // Extract optional API key from the initialize request's Authorization header.
      const authHeader = request.headers.get("authorization");
      const clientApiKey = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim() || undefined
        : undefined;

      const sessionIdStr = this.state.id.toString();

      this.transport = new WebStandardStreamableHTTPServerTransport({
        // Use the DO's own ID as the stable session identifier.
        sessionIdGenerator: () => sessionIdStr,
        onsessionclosed: () => {
          this.transport = undefined;
        },
      });

      const effectiveApiKey = clientApiKey ?? this.env.ONEDELTA_API_KEY;
      const mcpServer = createMcpServer(effectiveApiKey);
      await mcpServer.connect(this.transport);
    }

    return this.transport.handleRequest(request);
  }
}
