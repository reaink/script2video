const BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

export const RUNWAY_VIDEO_MODELS = [
  { name: "gen4.5", displayName: "Runway Gen-4.5", provider: "runway" as const },
  { name: "gen4_turbo", displayName: "Runway Gen-4 Turbo", provider: "runway" as const },
] as const;

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": RUNWAY_VERSION,
  };
}

export async function validateApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/v1/tasks?limit=1`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    throw new Error(`Runway API key invalid (${res.status}): ${text.slice(0, 200)}`);
  }
}

function snapDuration(d: number): 5 | 10 {
  return d <= 7 ? 5 : 10;
}

function aspectRatioToRunway(ar: "16:9" | "9:16"): string {
  return ar === "16:9" ? "1280:720" : "720:1280";
}

export async function startVideoGeneration(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  image?: { bytesBase64Encoded: string; mimeType: string };
}): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    model: args.model,
    promptText: args.prompt,
    ratio: aspectRatioToRunway(args.aspectRatio),
    duration: snapDuration(args.durationSeconds),
  };
  if (args.image) {
    body.promptImage = `data:${args.image.mimeType};base64,${args.image.bytesBase64Encoded}`;
  }
  const res = await fetch(`${BASE}/v1/image_to_video`, {
    method: "POST",
    headers: headers(args.apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Runway start ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { id: string };
  return data;
}

export type RunwayTaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export async function getTaskStatus(apiKey: string, taskId: string): Promise<{
  status: RunwayTaskStatus;
  output?: string[];
  failure?: string;
}> {
  const res = await fetch(`${BASE}/v1/tasks/${taskId}`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Runway status ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<{ status: RunwayTaskStatus; output?: string[]; failure?: string }>;
}
