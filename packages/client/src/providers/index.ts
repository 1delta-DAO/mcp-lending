import { AnthropicProvider } from "./anthropic.js";
import { DeepSeekProvider } from "./deepseek.js";
import { GoogleProvider } from "./google.js";
import { GroqProvider } from "./groq.js";
import { MistralProvider } from "./mistral.js";
import type { AIProvider } from "./types.js";

export type { AIProvider, MCPTool } from "./types.js";

export function createProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() ?? "anthropic";
  console.log(`Using AI provider: ${provider}`);

  switch (provider) {
    case "deepseek":
      return new DeepSeekProvider();
    case "google":
      return new GoogleProvider();
    case "groq":
      return new GroqProvider();
    case "mistral":
      return new MistralProvider();
    case "anthropic":
    default:
      return new AnthropicProvider();
  }
}
