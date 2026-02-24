import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, MCPTool } from "./types.js";

// Retry an API call on 429 rate-limit errors using exponential backoff.
// The Anthropic free tier has a 10k input-token-per-minute limit, so
// waiting 60 s is usually enough for the window to reset.
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 30_000; // 30s, 60s, 120s
        console.warn(`Rate limit hit — retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})…`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const toolDefs: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
    }));

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userQuery }];

    let response = await withRetry(() =>
      this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: toolDefs,
        messages,
      })
    );

    while (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`→ tool: ${block.name}`);
          const result = await callTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await withRetry(() =>
        this.client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          tools: toolDefs,
          messages,
        })
      );
    }

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}
