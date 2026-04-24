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
}

export async function generateContent(args: GenerateContentArgs): Promise<unknown> {
  const m = args.model.startsWith("models/") ? args.model : `models/${args.model}`;
  const url = `${BASE}/${m}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(args.apiKey),
    cache: "no-store",
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
    durationSeconds: String(args.durationSeconds),
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
