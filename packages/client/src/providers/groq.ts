import Groq from "groq-sdk";
import type { AIProvider, MCPTool } from "./types.js";
import { SYSTEM_PROMPT } from "./types.js";

// Models with tool calling support on Groq free tier:
// - llama-3.3-70b-versatile  (best quality, 30 RPM / 14,400 RPD)
// - llama3-groq-70b-8192-tool-use-preview  (optimized for tool use)
// - llama-3.1-8b-instant  (fastest, higher throughput)
const MODEL = "llama-3.1-8b-instant";

// Free tier has a tight TPM limit. Truncate large tool responses to stay within budget.

export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const toolDefs: Groq.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: t.inputSchema,
      },
    }));

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
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
