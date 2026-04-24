export type Provider = "gemini";

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
}

export interface GeminiModel {
  name: string;
  baseModelId?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export type ModelKind = "chat" | "video" | "image";

export interface AspectRatio {
  value: "16:9" | "9:16";
  label: string;
}

export interface VideoSettings {
  videoModel: string; // e.g. "models/veo-3.1-generate-preview"
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  resolution: "720p" | "1080p" | "4k";
  withSubtitle: boolean;
  concurrency: number;
  autoContinue: boolean;
  withReferenceFrames: boolean; // 是否用 Nano Banana 做首尾帧
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
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}
