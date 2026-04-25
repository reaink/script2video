const BASE = "https://api.lumalabs.ai/dream-machine/v1";

export const LUMA_VIDEO_MODELS = [
  { name: "ray-2", displayName: "Luma Ray 2", provider: "luma" as const },
  { name: "ray-flash-2", displayName: "Luma Ray 2 Flash", provider: "luma" as const },
] as const;

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function validateApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/generations?limit=1`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    throw new Error(`Luma API key invalid (${res.status}): ${text.slice(0, 200)}`);
  }
}

function durationStr(d: number): string {
  // Luma supports up to 9s
  const s = Math.min(Math.max(Math.round(d), 1), 9);
  return `${s}s`;
}

export async function startVideoGeneration(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  // Luma needs a public image URL, not base64 — skip if not available
  startFrameUrl?: string;
}): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    aspect_ratio: args.aspectRatio,
    duration: durationStr(args.durationSeconds),
  };
  if (args.startFrameUrl) {
    body.keyframes = {
      frame0: { type: "image", url: args.startFrameUrl },
    };
  }
  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers: headers(args.apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Luma start ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { id: string };
  return data;
}

export async function getGenerationStatus(apiKey: string, id: string): Promise<{
  state: "dreaming" | "completed" | "failed";
  assets?: { video?: string };
  failure_reason?: string | null;
}> {
  const res = await fetch(`${BASE}/generations/${encodeURIComponent(id)}`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Luma status ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<{
    state: "dreaming" | "completed" | "failed";
    assets?: { video?: string };
    failure_reason?: string | null;
  }>;
}
