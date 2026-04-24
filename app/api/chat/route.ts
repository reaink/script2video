import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { generateContent } from "@/lib/providers/gemini";
import {
  STORYBOARD_SYSTEM_PROMPT,
  STORYBOARD_REVIEW_SYSTEM_PROMPT,
  STORYBOARD_RESPONSE_SCHEMA,
  buildStoryboardUserPrompt,
  buildStoryboardReviewPrompt,
  parseStoryboard,
  languageName,
} from "@/lib/prompts/storyboard";
import type { Storyboard } from "@/lib/types";

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
      signal: req.signal,
    })) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    if (!text) {
      return NextResponse.json({ error: "empty response", raw }, { status: 502 });
    }
    let storyboard = parseStoryboard(text);

    // Review pass: re-feed the storyboard to the model for an end-to-end audit and correction.
    // Skipped silently on failure — the first-pass output is still returned.
    const allowedDurations = body.allowedDurations?.length ? body.allowedDurations : [4, 6, 8];
    try {
      const reviewText = buildStoryboardReviewPrompt({
        storyboard,
        allowedDurations,
        maxDurationSec: body.durationSec,
        language: body.language,
        withSubtitle: body.withSubtitle,
      });
      const reviewRaw = (await generateContent({
        apiKey: session.apiKey,
        model: body.model,
        contents: [{ role: "user", parts: [{ text: reviewText }] }],
        systemInstruction: { parts: [{ text: STORYBOARD_REVIEW_SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: STORYBOARD_RESPONSE_SCHEMA,
          temperature: 0.4,
        },
        signal: req.signal,
      })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const reviewedText = reviewRaw.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      if (reviewedText) {
        storyboard = parseStoryboard(reviewedText);
      }
    } catch {
      // best-effort; first-pass storyboard is still valid
    }

    storyboard = normalizeDialogueAndSubtitle(storyboard, body.language, body.withSubtitle);

    return NextResponse.json({ storyboard, rawText: text });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

/**
 * Deterministic post-processing: guarantee that
 *  - subtitle == verbatim join of dialogue lines (when subtitles enabled)
 *  - veoPrompt ends with `The {speaker} says in {LanguageName}: "<verbatim line>"`
 *    appended for every dialogue line that isn't already present verbatim.
 * This compensates for LLM drift (paraphrasing, English-only quoting, missing dialogue).
 */
function normalizeDialogueAndSubtitle(
  sb: Storyboard,
  langTag: string | undefined,
  withSubtitle: boolean
): Storyboard {
  const langName = languageName(langTag);
  const shots = sb.shots.map((shot) => {
    const dialogues = (shot.dialogue ?? []).filter((d) => d?.line?.trim());
    let veoPrompt = shot.veoPrompt ?? "";
    const missing: string[] = [];
    for (const d of dialogues) {
      const line = d.line.trim();
      if (!veoPrompt.includes(line)) {
        const speaker = (d.speaker ?? "narrator").trim() || "narrator";
        missing.push(`The ${speaker} says in ${langName}: "${line}"`);
      }
    }
    if (missing.length > 0) {
      veoPrompt = veoPrompt.replace(/\s+$/, "");
      const sep = veoPrompt && !/[.!?]$/.test(veoPrompt) ? ". " : " ";
      veoPrompt = `${veoPrompt}${veoPrompt ? sep : ""}${missing.join(" Then ")}.`;
    }
    const subtitle = withSubtitle
      ? dialogues.map((d) => d.line.trim()).join(" ")
      : "";
    return { ...shot, veoPrompt, subtitle };
  });
  return { ...sb, shots };
}
