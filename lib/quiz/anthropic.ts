import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The only file that reads ANTHROPIC_API_KEY. Never import this from a client component.

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Add it to .env (server side only).");
    this.name = "MissingApiKeyError";
  }
}

// Kept on globalThis so dev hot reload does not create a new client on every edit.
const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export function getAnthropic(): Anthropic {
  if (globalForAnthropic.anthropic) return globalForAnthropic.anthropic;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  // No SDK retries: they would hide real latency and double-charge a failing request.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  globalForAnthropic.anthropic = client;
  return client;
}
