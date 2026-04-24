import type { GeminiModel } from "@/lib/types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

export async function listModels(apiKey: string): Promise<GeminiModel[]> {
  const all: GeminiModel[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${BASE}/models`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: headers(apiKey), cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`listModels ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { models?: GeminiModel[]; nextPageToken?: string };
    if (data.models) all.push(...data.models);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

export interface GenerateContentArgs {
  apiKey: string;
  model: string; // "models/gemini-2.5-flash" or "gemini-2.5-flash"
  contents: unknown[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: Record<string, unknown>;
  signal?: AbortSignal;
}

export async function generateContent(args: GenerateContentArgs): Promise<unknown> {
  const m = args.model.startsWith("models/") ? args.model : `models/${args.model}`;
  const url = `${BASE}/${m}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(args.apiKey),
    cache: "no-store",
    signal: args.signal,
    body: JSON.stringify({
      contents: args.contents,
      systemInstruction: args.systemInstruction,
      generationConfig: args.generationConfig,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generateContent ${res.status}: ${text}`);
  }
  return res.json();
}

export interface StartVeoArgs {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: 4 | 5 | 6 | 8;
  resolution?: "720p" | "1080p" | "4k";
  personGeneration?: "allow_all" | "allow_adult" | "dont_allow";
  image?: { bytesBase64Encoded: string; mimeType: string };
  lastFrame?: { bytesBase64Encoded: string; mimeType: string };
}

export async function startVeoOperation(args: StartVeoArgs): Promise<{ name: string }> {
  const m = args.model.startsWith("models/") ? args.model : `models/${args.model}`;
  const url = `${BASE}/${m}:predictLongRunning`;
  const instances: Record<string, unknown> = { prompt: args.prompt };
  if (args.image) instances.image = args.image;
  if (args.lastFrame) instances.lastFrame = args.lastFrame;
  const parameters: Record<string, unknown> = {
    aspectRatio: args.aspectRatio,
    durationSeconds: Number(args.durationSeconds),
  };
  if (args.resolution) parameters.resolution = args.resolution;
  if (args.personGeneration) parameters.personGeneration = args.personGeneration;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(args.apiKey),
    cache: "no-store",
    body: JSON.stringify({ instances: [instances], parameters }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`startVeo ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { name: string };
  return data;
}

export interface VeoOperationStatus {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    generatedVideos?: { video: { uri: string } }[];
    generateVideoResponse?: { generatedSamples?: { video: { uri: string } }[] };
  };
}

export async function getOperation(apiKey: string, operationName: string): Promise<VeoOperationStatus> {
  const url = `${BASE}/${operationName}`;
  const res = await fetch(url, { headers: headers(apiKey), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getOperation ${res.status}: ${text}`);
  }
  return res.json() as Promise<VeoOperationStatus>;
}

export async function downloadVideoStream(apiKey: string, uri: string): Promise<Response> {
  const u = new URL(uri);
  // Some Veo URIs already include alt=media; ensure key header is sent.
  return fetch(u, { headers: { "x-goog-api-key": apiKey } });
}

export interface PredictImageArgs {
  apiKey: string;
  model: string; // e.g. "imagen-4.0-generate-001"
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  sampleCount?: number;
}

export interface PredictImageResult {
  bytesBase64Encoded: string;
  mimeType: string;
}

export async function predictImage(args: PredictImageArgs): Promise<PredictImageResult> {
  const m = args.model.startsWith("models/") ? args.model : `models/${args.model}`;
  const url = `${BASE}/${m}:predict`;
  const parameters: Record<string, unknown> = { sampleCount: args.sampleCount ?? 1 };
  if (args.aspectRatio) parameters.aspectRatio = args.aspectRatio;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(args.apiKey),
    cache: "no-store",
    body: JSON.stringify({ instances: [{ prompt: args.prompt }], parameters }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`predictImage ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
  };
  const p = data.predictions?.[0];
  if (!p?.bytesBase64Encoded) throw new Error("predictImage: empty prediction");
  return {
    bytesBase64Encoded: p.bytesBase64Encoded,
    mimeType: p.mimeType ?? "image/png",
  };
}
