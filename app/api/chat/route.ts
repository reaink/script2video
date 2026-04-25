import { NextResponse } from "next/server";
import { requireSession, requireApiKey } from "@/lib/server/session";
import { generateContent as geminiGenerateContent } from "@/lib/providers/gemini";
import { generateContent as openaiGenerateContent } from "@/lib/providers/openai";
import { generateContent as anthropicGenerateContent } from "@/lib/providers/anthropic";
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
import { inferProvider } from "@/lib/types";

interface RefImage {
  name: string;
  mimeType: string;
  bytesBase64Encoded: string;
}

interface ChatBody {
  model: string;
  script: string;
  durationSec: number;
  allowedDurations: number[];
  aspectRatio: "16:9" | "9:16";
  withSubtitle: boolean;
  language?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  referenceImages?: RefImage[];
}

const MAX_REFERENCE_IMAGES = 3;

/** Call the appropriate chat provider and return raw JSON text. */
async function callChatModel(args: {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userText: string;
  history: { role: "user" | "assistant"; content: string }[];
  refs: RefImage[];
  signal?: AbortSignal;
}): Promise<string> {
  const provider = inferProvider(args.model);

  if (provider === "gemini") {
    const userParts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: args.userText }];
    for (const r of args.refs) {
      userParts.push({ inlineData: { mimeType: r.mimeType, data: r.bytesBase64Encoded } });
    }
    const contents = [
      ...args.history.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: userParts },
    ];
    const raw = (await geminiGenerateContent({
      apiKey: args.apiKey,
      model: args.model,
      contents,
      systemInstruction: { parts: [{ text: args.systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: STORYBOARD_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
      signal: args.signal,
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return raw.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  }

  // For OpenAI and Anthropic, build a plain text conversation (no multimodal refs)
  const historyMsgs = args.history.map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
  const userMsg = { role: "user" as const, content: args.userText };

  if (provider === "openai") {
    return openaiGenerateContent({
      apiKey: args.apiKey,
      model: args.model,
      system: args.systemPrompt,
      messages: [...historyMsgs, userMsg],
      jsonMode: true,
      signal: args.signal,
    });
  }

  if (provider === "anthropic") {
    return anthropicGenerateContent({
      apiKey: args.apiKey,
      model: args.model,
      system: args.systemPrompt,
      messages: [...historyMsgs, userMsg],
      signal: args.signal,
    });
  }

  throw new Error(`Provider "${provider}" does not support chat`);
}

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

  const provider = inferProvider(body.model);
  let apiKey: string;
  try {
    apiKey = requireApiKey(session, provider);
  } catch {
    return NextResponse.json(
      { error: `Provider "${provider}" is not configured. Please add an API key in Settings.` },
      { status: 401 }
    );
  }

  const refs = (body.referenceImages ?? []).slice(0, MAX_REFERENCE_IMAGES);
  const allowedDurations = body.allowedDurations?.length ? body.allowedDurations : [4, 6, 8];

  const userText = buildStoryboardUserPrompt({
    script: body.script,
    durationSec: body.durationSec,
    allowedDurations,
    aspectRatio: body.aspectRatio,
    withSubtitle: body.withSubtitle,
    language: body.language,
    referenceImageNames: refs.map((r) => r.name),
  });

  try {
    const text = await callChatModel({
      model: body.model,
      apiKey,
      systemPrompt: STORYBOARD_SYSTEM_PROMPT,
      userText,
      history: body.history ?? [],
      refs,
      signal: req.signal,
    });
    if (!text) {
      return NextResponse.json({ error: "empty response from model" }, { status: 502 });
    }
    let storyboard = parseStoryboard(text);

    // Review pass — best-effort quality improvement
    try {
      const reviewText = buildStoryboardReviewPrompt({
        storyboard,
        allowedDurations,
        maxDurationSec: body.durationSec,
        language: body.language,
        withSubtitle: body.withSubtitle,
      });
      const reviewedText = await callChatModel({
        model: body.model,
        apiKey,
        systemPrompt: STORYBOARD_REVIEW_SYSTEM_PROMPT,
        userText: reviewText,
        history: [],
        refs: [],
        signal: req.signal,
      });
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
