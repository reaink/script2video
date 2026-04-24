import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { generateContent } from "@/lib/providers/gemini";

interface Body {
  model: string; // e.g. "gemini-2.5-flash-image-preview" (Nano Banana)
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
}

interface InlineDataPart {
  inlineData: { mimeType?: string; data?: string };
}
interface CandidatesPayload {
  candidates?: { content?: { parts?: Array<InlineDataPart | { text?: string }> } }[];
}

function isInlineData(p: unknown): p is InlineDataPart {
  return (
    typeof p === "object" &&
    p !== null &&
    "inlineData" in (p as Record<string, unknown>)
  );
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
    const data = (await generateContent({
      apiKey: session.apiKey,
      model: body.model,
      contents: [{ role: "user", parts: [{ text: body.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        ...(body.aspectRatio ? { imageConfig: { aspectRatio: body.aspectRatio } } : {}),
      },
    })) as CandidatesPayload;

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find(isInlineData);
    if (!img?.inlineData?.data) {
      return NextResponse.json({ error: "no image returned" }, { status: 500 });
    }
    return NextResponse.json({
      mimeType: img.inlineData.mimeType ?? "image/png",
      bytesBase64Encoded: img.inlineData.data,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
