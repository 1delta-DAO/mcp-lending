import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import type { AIProvider } from "./types.js";

export type { AIProvider, MCPTool } from "./types.js";

export function createProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() ?? "anthropic";
  console.log(`Using AI provider: ${provider}`);

  switch (provider) {
    case "google":
      return new GoogleProvider();
    case "anthropic":
    default:
      return new AnthropicProvider();
  }
}
