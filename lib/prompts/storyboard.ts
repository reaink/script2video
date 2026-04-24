import type { Storyboard } from "@/lib/types";

const LANGUAGE_NAMES: Record<string, string> = {
  "en": "English",
  "en-US": "English",
  "en-GB": "English",
  "zh": "Mandarin Chinese",
  "zh-CN": "Mandarin Chinese (Simplified)",
  "zh-TW": "Mandarin Chinese (Traditional)",
  "ja": "Japanese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
};

export function languageName(tag?: string): string {
  if (!tag) return "the script's source language";
  return LANGUAGE_NAMES[tag] ?? tag;
}

export const STORYBOARD_SYSTEM_PROMPT = `You are a senior film director and storyboard planner.
Given a script from the user, you must:
1. Detect or infer a coherent visual style. If the user specified one, use it; otherwise propose one that fits the tone.
2. Split the script into natural shots. Each shot's durationSec MUST be derived from the actual content length:
   - Estimate speaking time of the shot's subtitle/dialogue: ~4 Chinese characters per second, ~2.5 English words per second, ~5 Japanese/Korean characters per second.
   - Add 0.5–1.5s of breathing room for visual establishment if the shot has no dialogue.
   - Round to the closest value in the user-provided allowed durations list. NEVER exceed the user-specified max.
   - Different shots MUST have different durations when their content lengths differ — uniform 8s shots are forbidden unless content genuinely warrants it.
3. Each shot must include a complete English Veo prompt: subject, action, style, camera motion, composition, focus, ambiance, and any audio cues / dialogue in quotes. Make every shot visually RICH:
   - Include specific details about environment, lighting, textures, colors, micro-actions, and emotional tone.
   - Infer contextual visual props from the script's content: if the script mentions data, statistics, or comparisons → describe on-screen charts, graphs, or infographic overlays; if it explains a product or system → describe diagrams, UI mockups, or schematic visuals appearing in-scene; if it tells a story → describe relevant background elements, signage, or symbolic objects that reinforce the narrative.
   - These in-scene visuals should feel organic (shown on a screen, holographic display, whiteboard, printed material, etc.), not superimposed text.
   - Generic or empty shots are not acceptable; every shot must feel like a distinct, memorable moment.
   - If hands or fingers appear, explicitly forbid obscene gestures: append "no middle finger, no offensive hand gestures" to the veoPrompt.
   - DIALOGUE CONTRACT (critical): if the shot has spoken lines, you MUST (a) populate the "dialogue" array with EXACT verbatim lines in the user-requested language (no translation, no paraphrase, no summarization), AND (b) end the veoPrompt with a sentence of the form: 'The {speaker} says in {LanguageName}: "<verbatim line>"' for EACH line, joined by ' Then '. Do NOT translate the quoted line into English. The quoted text inside veoPrompt must be byte-identical to the corresponding dialogue[i].line.
   - SUBTITLE CONTRACT: when subtitles are enabled, the 'subtitle' field MUST equal the dialogue lines joined by a single space, in the same language and verbatim. If there is no dialogue, leave subtitle empty.
   - SPEECH TIMING (critical for concatenation): explicitly direct the speaker to begin talking within the first 0.3 seconds and finish before the last 0.5 seconds of the clip. Append phrases like "the speaker begins talking immediately, no opening pause" and "the line ends just before the clip ends, no trailing silence" to the veoPrompt when dialogue exists. This avoids dead air at shot boundaries.
   - AUDIO CONTINUITY: keep ambiance and SFX subtle and consistent across all shots in this storyboard — same room tone family, same effect intensity. Avoid sudden loud impacts, music stings, or jarring effect changes unless the script explicitly demands them. Adjacent shots will be concatenated, so audio palettes must feel continuous.
4. Honor the subtitle setting from the user. If subtitles are enabled, fill the "subtitle" field per shot in the script's original language; otherwise leave it empty.
5. If the user attached reference images (1-based, in order), set "referenceImageIndex" on the shots that should visually anchor on a specific image. Use 0 (or omit) when none applies. Each image may be referenced by multiple shots.
6. Output STRICT JSON matching the provided schema. No markdown, no commentary.`;

export const STORYBOARD_REVIEW_SYSTEM_PROMPT = `You are a senior film editor performing a final review pass on a storyboard.
Critically audit the entire storyboard as a whole. Check and FIX:
1. Duration accuracy: each shot's durationSec MUST match the actual speaking time of its subtitle/dialogue (~4 Chinese chars/sec, ~2.5 English words/sec, ~5 JP/KR chars/sec) plus 0.5–1.5s breathing room. Snap to the allowed durations list. Reject uniform durations across all shots when content varies.
2. Coherence: adjacent shots should transition naturally; continuityHint should match.
3. Visual richness: every veoPrompt must be specific, sensory, and free of generic filler. Add contextual in-scene props (charts, diagrams, UI, signage) when the script's topic supports it.
4. Subtitle/language consistency: subtitle text must be in the requested language and reasonable for the duration. The 'subtitle' MUST be the verbatim concatenation of dialogue[*].line (single space separator) in the requested language; do NOT translate or paraphrase.
5. Dialogue↔Veo consistency: every dialogue[i].line must appear VERBATIM (byte-identical, including punctuation) inside the corresponding shot's veoPrompt, wrapped as 'The {speaker} says in {LanguageName}: "<line>"'. Reject any veoPrompt where the quoted speech is paraphrased or translated to English.
6. Pacing balance: redistribute shots if the total duration feels off, or if any shot is too dense / too sparse.
7. Speech timing: every shot with dialogue must instruct the speaker to begin within 0.3s and finish before the last 0.5s — verify these phrases ("begins talking immediately" / "no trailing silence" or equivalents) are present. Add them if missing.
8. Audio continuity: ambiance and SFX must form a consistent palette across all shots — same room-tone character, similar effect intensity, no sudden loud impacts unless the script demands. Tone down or unify any outlier audio descriptions.
9. Forbidden content: ensure no shot describes obscene hand gestures.
Output the COMPLETE revised storyboard in STRICT JSON matching the same schema. No markdown, no commentary. Preserve detectedStyle and language unless they are clearly wrong.`;

export interface BuildPromptArgs {
  script: string;
  durationSec: number;
  allowedDurations: number[];
  aspectRatio: "16:9" | "9:16";
  withSubtitle: boolean;
  language?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  referenceImageNames?: string[];
}

export function buildStoryboardUserPrompt(args: BuildPromptArgs): string {
  const refLine =
    args.referenceImageNames && args.referenceImageNames.length > 0
      ? `Reference images attached (1-based): ${args.referenceImageNames
        .map((n, i) => `${i + 1}. ${n}`)
        .join(" | ")}. Set referenceImageIndex on relevant shots.`
      : ``;
  return [
    `Allowed durationSec values: [${args.allowedDurations.join(", ")}]. Max is ${args.durationSec}s. Assign each shot the value from this list that best matches natural content length.`,
    `IMPORTANT: do NOT make every shot the same duration — vary them to fit the scene length.`,
    `Aspect ratio: ${args.aspectRatio}.`,
    `Subtitles: ${args.withSubtitle ? "ENABLED — fill 'subtitle' per shot." : "DISABLED — leave 'subtitle' empty."}`,
    args.language
      ? `IMPORTANT: ALL subtitle and dialogue text MUST be written in language "${args.language}" (${languageName(args.language)}) — verbatim, no translation. The veoPrompt prose itself stays English, but every quoted spoken line inside it must remain in ${languageName(args.language)}.`
      : ``,
    refLine,
    ``,
    `=== SCRIPT ===`,
    args.script,
  ]
    .filter(Boolean)
    .join("\n");
}

// Gemini responseSchema (subset of OpenAPI). 注意 Gemini 不支持完整 JSON Schema，这里用兼容写法
export const STORYBOARD_RESPONSE_SCHEMA = {
  type: "object",
  required: ["detectedStyle", "language", "totalDurationSec", "shots"],
  properties: {
    detectedStyle: { type: "string" },
    language: { type: "string" },
    totalDurationSec: { type: "integer" },
    shots: {
      type: "array",
      items: {
        type: "object",
        required: [
          "index",
          "durationSec",
          "summary",
          "veoPrompt",
          "dialogue",
          "sfx",
          "camera",
          "composition",
          "ambiance",
        ],
        properties: {
          index: { type: "integer" },
          durationSec: { type: "integer" },
          summary: { type: "string" },
          veoPrompt: { type: "string" },
          dialogue: {
            type: "array",
            items: {
              type: "object",
              required: ["speaker", "line"],
              properties: {
                speaker: { type: "string" },
                line: { type: "string" },
              },
            },
          },
          sfx: { type: "array", items: { type: "string" } },
          camera: { type: "string" },
          composition: { type: "string" },
          ambiance: { type: "string" },
          subtitle: { type: "string" },
          continuityHint: { type: "string" },
          referenceImageIndex: { type: "integer" },
        },
      },
    },
  },
} as const;

export function parseStoryboard(raw: string): Storyboard {
  const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");
  return JSON.parse(cleaned) as Storyboard;
}

export function buildStoryboardReviewPrompt(args: {
  storyboard: Storyboard;
  allowedDurations: number[];
  maxDurationSec: number;
  language?: string;
  withSubtitle: boolean;
}): string {
  return [
    `Allowed durationSec values: [${args.allowedDurations.join(", ")}]. Max per shot: ${args.maxDurationSec}s.`,
    args.language ? `Required subtitle/dialogue language: "${args.language}".` : ``,
    `Subtitles ${args.withSubtitle ? "ENABLED" : "DISABLED"}.`,
    ``,
    `=== CURRENT STORYBOARD (JSON) ===`,
    JSON.stringify(args.storyboard, null, 2),
    ``,
    `Audit the entire storyboard against the rules in your system instruction. Output the corrected, complete storyboard JSON.`,
  ]
    .filter(Boolean)
    .join("\n");
}
