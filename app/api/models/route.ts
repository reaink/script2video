import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { listModels } from "@/lib/providers/gemini";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  try {
    const all = await listModels(session.apiKey);
    const chat = all.filter(
      (m) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        !m.name.includes("embedding") &&
        !m.name.includes("tts") &&
        !m.name.includes("image") &&
        !m.name.includes("veo") &&
        !m.name.includes("aqa")
    );
    const video = all.filter((m) => m.name.includes("veo"));
    const image = all.filter(
      (m) => m.name.includes("imagen") || m.name.includes("image-preview") || m.name.includes("nano-banana")
    );
    return NextResponse.json({ chat, video, image });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
