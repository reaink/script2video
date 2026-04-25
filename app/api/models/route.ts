import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { listModels } from "@/lib/providers/gemini";
import { OPENAI_CHAT_MODELS, OPENAI_IMAGE_MODELS } from "@/lib/providers/openai";
import { ANTHROPIC_CHAT_MODELS } from "@/lib/providers/anthropic";
import { RUNWAY_VIDEO_MODELS } from "@/lib/providers/runway";
import { MINIMAX_VIDEO_MODELS } from "@/lib/providers/minimax";
import { LUMA_VIDEO_MODELS } from "@/lib/providers/luma";
import { FAL_IMAGE_MODELS } from "@/lib/providers/fal";
import { STABILITY_IMAGE_MODELS } from "@/lib/providers/stability";
import type { ModelInfo } from "@/lib/types";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }

  const chat: ModelInfo[] = [];
  const video: ModelInfo[] = [];
  const image: ModelInfo[] = [];

  // Gemini: dynamic model list
  const geminiKey = session.apiKeys.gemini;
  if (geminiKey) {
    try {
      const all = await listModels(geminiKey);
      for (const m of all) {
        const info: ModelInfo = { name: m.name, displayName: m.displayName, provider: "gemini", supportedGenerationMethods: m.supportedGenerationMethods };
        if (
          m.supportedGenerationMethods?.includes("generateContent") &&
          !m.name.includes("embedding") &&
          !m.name.includes("tts") &&
          !m.name.includes("image") &&
          !m.name.includes("veo") &&
          !m.name.includes("aqa")
        ) {
          chat.push(info);
        }
        if (m.name.includes("veo")) video.push(info);
        if (m.name.includes("imagen") || m.name.includes("image-preview") || m.name.includes("nano-banana")) {
          image.push(info);
        }
      }
    } catch {
      // Gemini key present but fetch failed — skip
    }
  }

  // OpenAI: static chat + image models
  if (session.apiKeys.openai) {
    chat.push(...OPENAI_CHAT_MODELS);
    image.push(...OPENAI_IMAGE_MODELS);
  }

  // Anthropic: static chat models
  if (session.apiKeys.anthropic) {
    chat.push(...ANTHROPIC_CHAT_MODELS);
  }

  // Runway: static video models
  if (session.apiKeys.runway) {
    video.push(...RUNWAY_VIDEO_MODELS);
  }

  // MiniMax: static video models
  if (session.apiKeys.minimax) {
    video.push(...MINIMAX_VIDEO_MODELS);
  }

  // Luma: static video models
  if (session.apiKeys.luma) {
    video.push(...LUMA_VIDEO_MODELS);
  }

  // fal.ai: static image models
  if (session.apiKeys.fal) {
    image.push(...FAL_IMAGE_MODELS);
  }

  // Stability AI: static image models
  if (session.apiKeys.stability) {
    image.push(...STABILITY_IMAGE_MODELS);
  }

  return NextResponse.json({ chat, video, image });
}
