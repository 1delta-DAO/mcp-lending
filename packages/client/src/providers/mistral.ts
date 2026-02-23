import { Mistral } from "@mistralai/mistralai";
import type {
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from "@mistralai/mistralai/models/components/index.js";
import type { AIProvider, MCPTool } from "./types.js";

// Free tier: ~1B tokens/month, generous rate limits
// mistral-small-latest has strong function calling support
const MODEL = "mistral-small-latest";

type Messages = Array<SystemMessage | UserMessage | AssistantMessage | ToolMessage>;

export class MistralProvider implements AIProvider {
  private client: Mistral;

  constructor() {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY environment variable is not set");
    }
    this.client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const toolDefs = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: t.inputSchema as { [k: string]: any },
      },
    }));

    const messages: Messages = [
      { role: "user", content: userQuery },
    ];

    let response = await this.client.chat.complete({
      model: MODEL,
      tools: toolDefs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
    });

    // Agentic loop — continue until no more tool calls
    while (response?.choices?.[0]?.finishReason === "tool_calls") {
      const choice = response.choices[0];
      const toolCalls = choice.message.toolCalls ?? [];

      messages.push(choice.message);

      for (const tc of toolCalls) {
        const name = tc.function.name;
        const args = typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments) as Record<string, unknown>
          : tc.function.arguments as Record<string, unknown>;

        console.log(`→ tool: ${name}`);
        const result = await callTool(name, args);

        messages.push({
          role: "tool",
          toolCallId: tc.id,
          name,
          content: result,
        });
      }

      response = await this.client.chat.complete({
        model: MODEL,
        tools: toolDefs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
      });
    }

    const content = response?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }
}
