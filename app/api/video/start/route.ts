import { NextResponse } from "next/server";
import { requireSession, requireApiKey } from "@/lib/server/session";
import { startVeoOperation } from "@/lib/providers/gemini";
import { startVideoGeneration as runwayStart } from "@/lib/providers/runway";
import { startVideoGeneration as minimaxStart } from "@/lib/providers/minimax";
import { startVideoGeneration as lumaStart } from "@/lib/providers/luma";
import { inferProvider } from "@/lib/types";

interface Body {
  model: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  resolution?: "720p" | "1080p" | "4k";
  personGeneration?: "allow_all" | "allow_adult" | "dont_allow";
  image?: { bytesBase64Encoded: string; mimeType: string };
  lastFrame?: { bytesBase64Encoded: string; mimeType: string };
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  const body = (await req.json()) as Body;
  if (!body.model || !body.prompt) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const provider = inferProvider(body.model);
  let apiKey: string;
  try {
    apiKey = requireApiKey(session, provider);
  } catch {
    return NextResponse.json(
      { error: `Provider "${provider}" is not configured.` },
      { status: 401 }
    );
  }

  try {
    if (provider === "gemini") {
      const op = await startVeoOperation({
        apiKey,
        model: body.model,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        durationSeconds: body.durationSeconds as 4 | 5 | 6 | 8,
        resolution: body.resolution,
        personGeneration: body.personGeneration,
        image: body.image,
        lastFrame: body.lastFrame,
      });
      // Gemini op name starts with "operations/" — no prefix needed for status routing
      return NextResponse.json(op);
    }

    if (provider === "runway") {
      const result = await runwayStart({
        apiKey,
        model: body.model,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        durationSeconds: body.durationSeconds,
        image: body.image,
      });
      return NextResponse.json({ name: `runway:${result.id}` });
    }

    if (provider === "minimax") {
      const result = await minimaxStart({
        apiKey,
        model: body.model,
        prompt: body.prompt,
        durationSeconds: body.durationSeconds,
        image: body.image,
      });
      return NextResponse.json({ name: `minimax:${result.task_id}` });
    }

    if (provider === "luma") {
      const result = await lumaStart({
        apiKey,
        model: body.model,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        durationSeconds: body.durationSeconds,
        // Luma requires a public URL — skip base64 frames
      });
      return NextResponse.json({ name: `luma:${result.id}` });
    }

    return NextResponse.json({ error: `Provider "${provider}" does not support video generation` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
