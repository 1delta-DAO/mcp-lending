import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, MCPTool } from "./types.js";

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

    let response = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: toolDefs,
      messages,
    });

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

      response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: toolDefs,
        messages,
      });
    }

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}
