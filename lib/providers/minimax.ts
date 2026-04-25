const BASE = "https://api.minimax.io";

export const MINIMAX_VIDEO_MODELS = [
  { name: "MiniMax-Hailuo-2.3", displayName: "MiniMax Hailuo 2.3", provider: "minimax" as const },
  { name: "MiniMax-Hailuo-2.3Fast", displayName: "MiniMax Hailuo 2.3 Fast", provider: "minimax" as const },
  { name: "MiniMax-Hailuo-02", displayName: "MiniMax Hailuo 02", provider: "minimax" as const },
] as const;

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function validateApiKey(apiKey: string): Promise<void> {
  // GET files list — empty result is fine, 401 means bad key
  const res = await fetch(`${BASE}/v1/files/list?purpose=video_generation&page_size=1`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (res.status === 401) {
    const text = await res.text();
    throw new Error(`MiniMax API key invalid: ${text.slice(0, 200)}`);
  }
}

function snapDuration(d: number): 6 | 10 {
  return d <= 7 ? 6 : 10;
}

function resolutionFor(model: string): "768P" | "1080P" {
  if (model.includes("Fast")) return "768P";
  return "1080P";
}

export async function startVideoGeneration(args: {
  apiKey: string;
  model: string;
  prompt: string;
  durationSeconds: number;
  image?: { bytesBase64Encoded: string; mimeType: string };
}): Promise<{ task_id: string }> {
  const body: Record<string, unknown> = {
    model: args.model,
    prompt: args.prompt,
    duration: snapDuration(args.durationSeconds),
    resolution: resolutionFor(args.model),
    prompt_optimizer: true,
  };
  if (args.image) {
    body.first_frame_image = `data:${args.image.mimeType};base64,${args.image.bytesBase64Encoded}`;
  }
  const res = await fetch(`${BASE}/v1/video_generation`, {
    method: "POST",
    headers: headers(args.apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax start ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { task_id: string };
  return data;
}

export async function getTaskStatus(apiKey: string, taskId: string): Promise<{
  status: "processing" | "success" | "failed";
  file_id?: string;
  error?: string;
}> {
  const res = await fetch(
    `${BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    { headers: headers(apiKey), cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax status ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<{ status: "processing" | "success" | "failed"; file_id?: string }>;
}

export async function getFileDownloadUrl(apiKey: string, fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/files/retrieve?FileId=${encodeURIComponent(fileId)}`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax getFile ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { file?: { download_url?: string } };
  const url = data.file?.download_url;
  if (!url) throw new Error("MiniMax file has no download_url");
  return url;
}
