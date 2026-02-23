import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, MCPTool } from "./types.js";

const MODEL = "gemini-1.5-flash";

export class GoogleProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is not set");
    }
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: MODEL,
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parameters: t.inputSchema as any,
          })),
        },
      ],
    });

    const chat = model.startChat();
    let result = await chat.sendMessage(userQuery);

    // Agentic loop — continue until no more function calls
    while (true) {
      const functionCalls = result.response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) break;

      const functionResponses = await Promise.all(
        functionCalls.map(async (fc) => {
          console.log(`→ tool: ${fc.name}`);
          const toolResult = await callTool(fc.name, fc.args as Record<string, unknown>);
          return {
            functionResponse: {
              name: fc.name,
              response: { result: toolResult },
            },
          };
        })
      );

      result = await chat.sendMessage(functionResponses);
    }

    return result.response.text();
  }
}
