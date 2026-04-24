import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { generateContent, predictImage } from "@/lib/providers/gemini";

interface RefImage {
  mimeType: string;
  bytesBase64Encoded: string;
}

interface Body {
  model: string; // "gemini-2.5-flash-image-preview" (Nano Banana) or "imagen-4.0-generate-001"
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  referenceImages?: RefImage[]; // multi-image input for Nano Banana (max 3)
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

function isImagen(model: string): boolean {
  return /imagen-/.test(model);
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
    if (isImagen(body.model)) {
      // Imagen :predict — text-only
      const out = await predictImage({
        apiKey: session.apiKey,
        model: body.model,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
      });
      return NextResponse.json(out);
    }

    // Nano Banana / image-preview via :generateContent (supports reference images)
    const refs = (body.referenceImages ?? []).slice(0, 3);
    const parts: Array<{ text: string } | InlineDataPart> = [{ text: body.prompt }];
    for (const r of refs) {
      parts.push({ inlineData: { mimeType: r.mimeType, data: r.bytesBase64Encoded } });
    }

    const data = (await generateContent({
      apiKey: session.apiKey,
      model: body.model,
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        ...(body.aspectRatio ? { imageConfig: { aspectRatio: body.aspectRatio } } : {}),
      },
    })) as CandidatesPayload;

    const out = data.candidates?.[0]?.content?.parts ?? [];
    const img = out.find(isInlineData);
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
