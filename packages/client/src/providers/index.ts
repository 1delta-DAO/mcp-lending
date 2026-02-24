import { AnthropicProvider } from "./anthropic.js";
import { DeepSeekProvider } from "./deepseek.js";
import { GoogleProvider } from "./google.js";
import { GroqProvider } from "./groq.js";
import { MistralProvider } from "./mistral.js";
import { OpenAIProvider } from "./openai.js";
import { OpenAIMiniProvider } from "./openai-mini.js";
import type { AIProvider } from "./types.js";

export type { AIProvider, MCPTool } from "./types.js";

export const PROVIDERS = ["anthropic", "openai", "openai-mini"] as const;
export type ProviderName = typeof PROVIDERS[number];

export function createProvider(name?: string): AIProvider {
  const provider = (name ?? "anthropic").toLowerCase();
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
    case "openai":
      return new OpenAIProvider();
    case "openai-mini":
      return new OpenAIMiniProvider();
    case "anthropic":
    default:
      return new AnthropicProvider();
  }
}
