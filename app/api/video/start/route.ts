import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { startVeoOperation } from "@/lib/providers/gemini";

interface Body {
  model: string;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: 4 | 5 | 6 | 8;
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
  try {
    const op = await startVeoOperation({ apiKey: session.apiKey, ...body });
    return NextResponse.json(op);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
