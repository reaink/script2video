export type Provider = "gemini" | "openai" | "anthropic" | "runway" | "minimax" | "luma" | "fal" | "stability";

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
}

/** Unified model descriptor across all providers. */
export interface ModelInfo {
  name: string;
  displayName?: string;
  provider: Provider;
  /** Gemini-only: used for filtering by capability */
  supportedGenerationMethods?: string[];
}

/** Alias kept for backward compatibility. */
export type GeminiModel = ModelInfo;

/** Infer the provider from a model identifier string. */
export function inferProvider(model: string): Provider {
  if (model.startsWith("models/") || model.startsWith("gemini-") || model.startsWith("imagen")) return "gemini";
  if (model.startsWith("gpt-") || /^o[0-9]/.test(model)) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  if (/^gen[0-9]/.test(model) || model === "act_two") return "runway";
  if (model.startsWith("MiniMax-")) return "minimax";
  if (model.startsWith("ray-")) return "luma";
  if (model.startsWith("fal-ai/")) return "fal";
  if (model.startsWith("stability/")) return "stability";
  return "gemini";
}

export type ModelKind = "chat" | "video" | "image";

export interface AspectRatio {
  value: "16:9" | "9:16";
  label: string;
}

export interface VideoSettings {
  videoModel: string; // e.g. "models/veo-3.1-generate-preview", "gen4.5", "ray-2"
  aspectRatio: "16:9" | "9:16";
  durationSec: number; // allowed values depend on model; providers snap internally
  resolution: "720p" | "1080p" | "4k";
  withSubtitle: boolean;
  concurrency: number;
  autoContinue: boolean;
  withReferenceFrames: boolean;
}

export interface ChatSettings {
  chatModel: string; // e.g. "models/gemini-2.5-pro"
}

// 分镜结构化输出
export interface Shot {
  index: number;
  durationSec: number;
  summary: string;
  veoPrompt: string;
  dialogue: { speaker: string; line: string }[];
  sfx: string[];
  camera: string;
  composition: string;
  ambiance: string;
  subtitle?: string;
  continuityHint?: string;
  /** 1-based index into the user's uploaded reference images, or 0 if none. */
  referenceImageIndex?: number;
}

export interface ReferenceImage {
  /** Stable id for ui list keys. */
  id: string;
  /** Original file name, for the prompt context. */
  name: string;
  mimeType: string;
  /** Base64-encoded bytes (no data: prefix). */
  bytesBase64Encoded: string;
  /** Compressed size in bytes after client-side downscale. */
  size: number;
}

export interface Storyboard {
  detectedStyle: string;
  language: string;
  totalDurationSec: number;
  shots: Shot[];
}

// 对话历史
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  storyboard?: Storyboard;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  settings: ChatSettings & VideoSettings;
}

// 视频生成任务
export type ShotJobStatus = "queued" | "running" | "done" | "failed";

export interface ShotJob {
  shotIndex: number;
  status: ShotJobStatus;
  operationName?: string;
  videoUri?: string;
  /** Object URL pointing to the cached blob in IndexedDB. Survives Veo's 2-day expiry. */
  videoBlobUrl?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}
