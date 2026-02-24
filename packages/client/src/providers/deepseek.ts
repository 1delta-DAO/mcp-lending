import OpenAI from "openai";
import type { AIProvider, MCPTool } from "./types.js";
import { SYSTEM_PROMPT } from "./types.js";

// DeepSeek models with tool calling support:
// - deepseek-chat  (DeepSeek-V3, best for general tasks)
// - deepseek-reasoner  (DeepSeek-R1, best for complex reasoning)
const MODEL = "deepseek-chat";

export class DeepSeekProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY environment variable is not set");
    }
    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const toolDefs: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: t.inputSchema,
      },
    }));

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ];

    let response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      tools: toolDefs,
      messages,
    });

    // Agentic loop — continue until no more tool calls
    while (response.choices[0].finish_reason === "tool_calls") {
      const toolCalls = response.choices[0].message.tool_calls ?? [];

      messages.push(response.choices[0].message);

      for (const tc of toolCalls) {
        if (tc.type !== "function") continue;
        console.log(`→ tool: ${tc.function.name}`);
        const input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        const result = await callTool(tc.function.name, input);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        tools: toolDefs,
        messages,
      });
    }

    return response.choices[0].message.content ?? "";
  }
}
