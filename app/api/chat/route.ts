import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { generateContent } from "@/lib/providers/gemini";
import {
  STORYBOARD_SYSTEM_PROMPT,
  STORYBOARD_RESPONSE_SCHEMA,
  buildStoryboardUserPrompt,
  parseStoryboard,
} from "@/lib/prompts/storyboard";

interface RefImage {
  name: string;
  mimeType: string;
  bytesBase64Encoded: string;
}

interface ChatBody {
  model: string;
  script: string;
  durationSec: 4 | 5 | 6 | 8;
  allowedDurations: number[];
  aspectRatio: "16:9" | "9:16";
  withSubtitle: boolean;
  language?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  referenceImages?: RefImage[];
}

const MAX_REFERENCE_IMAGES = 3;

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  const body = (await req.json()) as ChatBody;
  if (!body.model || !body.script?.trim()) {
    return NextResponse.json({ error: "missing model or script" }, { status: 400 });
  }

  const refs = (body.referenceImages ?? []).slice(0, MAX_REFERENCE_IMAGES);

  const userText = buildStoryboardUserPrompt({
    script: body.script,
    durationSec: body.durationSec,
    allowedDurations: body.allowedDurations?.length ? body.allowedDurations : [4, 6, 8],
    aspectRatio: body.aspectRatio,
    withSubtitle: body.withSubtitle,
    language: body.language,
    referenceImageNames: refs.map((r) => r.name),
  });

  const userParts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }];
  for (const r of refs) {
    userParts.push({
      inlineData: { mimeType: r.mimeType, data: r.bytesBase64Encoded },
    });
  }

  const contents = [
    ...(body.history ?? []).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: userParts },
  ];

  try {
    const raw = (await generateContent({
      apiKey: session.apiKey,
      model: body.model,
      contents,
      systemInstruction: { parts: [{ text: STORYBOARD_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: STORYBOARD_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    })) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    if (!text) {
      return NextResponse.json({ error: "empty response", raw }, { status: 502 });
    }
    const storyboard = parseStoryboard(text);
    return NextResponse.json({ storyboard, rawText: text });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
