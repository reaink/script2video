const BASE = "https://api.openai.com/v1";

export const OPENAI_CHAT_MODELS = [
  { name: "gpt-4.1", displayName: "GPT-4.1", provider: "openai" as const },
  { name: "gpt-4o", displayName: "GPT-4o", provider: "openai" as const },
  { name: "gpt-4o-mini", displayName: "GPT-4o mini", provider: "openai" as const },
  { name: "o4-mini", displayName: "o4-mini", provider: "openai" as const },
  { name: "o3", displayName: "o3", provider: "openai" as const },
] as const;

export async function validateApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API key invalid (${res.status}): ${text.slice(0, 200)}`);
  }
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generateContent(args: {
  apiKey: string;
  model: string;
  system?: string;
  messages: OpenAIMessage[];
  jsonMode?: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const msgs: OpenAIMessage[] = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    ...args.messages,
  ];
  const body: Record<string, unknown> = {
    model: args.model,
    messages: msgs,
    temperature: 0.7,
  };
  if (args.jsonMode) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: args.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI generateContent ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
