import { GoogleGenAI } from "@google/genai";
import type { AIProvider, HistoryMessage, MCPTool } from "./types.js";
import { SYSTEM_PROMPT } from "./types.js";

const MODEL = "gemini-2.5-flash-lite";

// Gemini only supports a subset of JSON Schema. Strip fields it rejects.
const UNSUPPORTED_SCHEMA_KEYS = new Set(["$schema", "additionalProperties", "$defs", "$ref", "default", "examples"]);

function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
    if ((key === "properties" || key === "items") && typeof value === "object" && value !== null) {
      if (key === "properties") {
        result[key] = Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "object" && v !== null ? sanitizeSchema(v as Record<string, unknown>) : v,
          ])
        );
      } else {
        result[key] = sanitizeSchema(value as Record<string, unknown>);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class GoogleProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY environment variable is not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }

  async processQuery(
    userQuery: string,
    tools: MCPTool[],
    callTool: (name: string, input: Record<string, unknown>) => Promise<string>,
    history: HistoryMessage[] = [],
  ): Promise<string> {
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      parameters: sanitizeSchema(t.inputSchema as Record<string, unknown>),
    }));

    const chat = this.ai.chats.create({
      model: MODEL,
      config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations }] },
      history: history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
    });

    let response = await chat.sendMessage({ message: userQuery });

    // Agentic loop — continue until no more function calls
    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionResponses = await Promise.all(
        response.functionCalls.map(async (fc) => {
          const name = fc.name ?? "";
          console.log(`→ tool: ${name}`);
          const result = await callTool(name, (fc.args ?? {}) as Record<string, unknown>);
          return {
            functionResponse: {
              id: fc.id,
              name,
              response: { result },
            },
          };
        })
      );

      response = await chat.sendMessage({ message: functionResponses });
    }

    return response.text ?? "";
  }
}
