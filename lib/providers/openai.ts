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

export const OPENAI_IMAGE_MODELS = [
  { name: "gpt-image-1", displayName: "GPT Image 1", provider: "openai" as const },
] as const;

function aspectRatioToSize(ar?: "16:9" | "9:16"): string {
  if (ar === "16:9") return "1536x1024";
  if (ar === "9:16") return "1024x1536";
  return "1024x1024";
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function generateImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  referenceImages?: { mimeType: string; bytesBase64Encoded: string }[];
}): Promise<{ mimeType: string; bytesBase64Encoded: string }> {
  const size = aspectRatioToSize(args.aspectRatio);
  const refs = (args.referenceImages ?? []).filter((r) => r.bytesBase64Encoded);

  let res: Response;
  if (refs.length > 0) {
    // Use edits endpoint with the first reference image as input
    const form = new FormData();
    form.append("model", args.model);
    form.append("prompt", args.prompt);
    form.append("n", "1");
    form.append("size", size);
    const blob = base64ToBlob(refs[0].bytesBase64Encoded, refs[0].mimeType);
    form.append("image[]", blob, "frame.png");
    res = await fetch(`${BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
      cache: "no-store",
    });
  } else {
    res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({ model: args.model, prompt: args.prompt, n: 1, size, output_format: "png" }),
      cache: "no-store",
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI generateImage ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI generateImage: no image data returned");
  return { mimeType: "image/png", bytesBase64Encoded: b64 };
}
