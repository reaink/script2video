const BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

export const ANTHROPIC_CHAT_MODELS = [
  { name: "claude-opus-4-5-20251101", displayName: "Claude Opus 4.5", provider: "anthropic" as const },
  { name: "claude-sonnet-4-5-20251101", displayName: "Claude Sonnet 4.5", provider: "anthropic" as const },
  { name: "claude-haiku-3-5-20241022", displayName: "Claude Haiku 3.5", provider: "anthropic" as const },
] as const;

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

export async function validateApiKey(apiKey: string): Promise<void> {
  // Send a minimal request — 401 means invalid key, other responses (even 400) mean key is accepted
  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: headers(apiKey),
    cache: "no-store",
    body: JSON.stringify({
      model: "claude-haiku-3-5-20241022",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (res.status === 401) {
    const text = await res.text();
    throw new Error(`Anthropic API key invalid: ${text.slice(0, 200)}`);
  }
}

export async function generateContent(args: {
  apiKey: string;
  model: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: args.model,
    max_tokens: args.maxTokens ?? 8192,
    messages: args.messages,
  };
  if (args.system) {
    body.system = args.system;
  }
  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: headers(args.apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: args.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic generateContent ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}
