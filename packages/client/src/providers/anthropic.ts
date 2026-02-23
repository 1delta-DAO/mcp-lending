import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, MCPTool } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

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
    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: (t.inputSchema as AnyRecord) ?? { type: "object", properties: {} },
    }));

    const messages: AnyRecord[] = [{ role: "user", content: userQuery }];

    let response: AnyRecord = await (
      this.client.messages.create as unknown as (p: AnyRecord) => Promise<AnyRecord>
    )({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: toolDefs,
      messages,
    });

    while (response.stop_reason === "tool_use") {
      const toolResults: AnyRecord[] = [];

      for (const block of response.content as AnyRecord[]) {
        if (block.type === "tool_use") {
          console.log(`→ tool: ${block.name}`);
          const result = await callTool(block.name as string, block.input as Record<string, unknown>);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await (
        this.client.messages.create as unknown as (p: AnyRecord) => Promise<AnyRecord>
      )({
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
}
