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

export const STORYBOARD_SYSTEM_PROMPT = `You are a senior film director and storyboard planner. Given a script, produce a storyboard following these rules:

## STYLE
Use the user-specified visual style; if none given, infer one that fits the script's tone.

## DURATION
Derive each shot's durationSec precisely:
- Raw speaking time: count chars/words in dialogue only (not stage directions). ~4 Chinese chars/sec · ~2.5 English words/sec · ~5 JP/KR chars/sec.
- Add buffer: +0.5s for dialogue shots (idle hold after last word); +1–1.5s for non-dialogue B-roll.
- Snap to the nearest allowed value that comfortably fits the content. If the computed time falls between two allowed values, choose the LARGER one. Only snap down when the smaller value has ≥0.5s margin remaining. Never exceed user-specified max.
- Vary durations — identical durations across all shots are forbidden unless content genuinely matches.

## SHOT STRUCTURE (critical)
### Alternation rule
- PRESENTER / NEWS / EXPLAINER: strictly alternate presenter shots and B-roll shots. No more than ONE consecutive presenter shot without a B-roll between them. Merging two short presenter lines into one shot is preferred over three consecutive presenter shots.
- NARRATIVE: intercut with establishing shots, reaction shots, environmental details, and symbolic props that enrich the story while respecting the script's logic.

### Camera variety (presenter shots)
Each return to the same presenter location MUST use a different focal length AND a different camera move from all previous appearances at that location. Forbidden: repeating the same framing (e.g., two consecutive medium close-ups with slow push-in). Rotate through: wide / medium / medium close-up / close-up, and through: static / push-in / pull-back / track-left / track-right / tilt.

### Subject visual identity
If the script introduces a named product, service, AI character, or brand, dedicate at least one B-roll shot to establishing its visual identity (e.g., logo, UI interface, avatar, or product form factor). Do not let the entire video pass without showing what the subject looks like.

### Environment grounding for abstract B-roll
Abstract concepts (data flows, AI cores, network graphs, algorithms) MUST be grounded in the established set environment — shown on a holographic display, a studio monitor, a presenter's screen, or similar in-scene surface. Avoid floating abstract elements in a featureless void unless the style explicitly demands it.

## VEO PROMPT
Write a complete English veoPrompt per shot covering subject, action, style, camera motion, composition, focus, and ambiance. Every shot must be visually specific — environment, lighting, textures, colors, micro-actions, emotional tone. In-scene contextual visuals must feel organic (on screens, holograms, whiteboards), not superimposed. Generic shots are unacceptable. If hands appear: append "no middle finger, no offensive hand gestures". For abstract B-roll, describe the display surface clearly (e.g., "shown on a large holographic monitor in the studio"). If a URL, brand name, or text must appear on screen, describe it as physically present on an in-scene surface (LED panel, screen, signage) — never describe it as a floating overlay or graphic, as these tend to be rendered as burned-in subtitles.

## AUDIO (critical)
- VOICE ONLY: only the speaker's voice is audible during speech — no background music, no ambient hum under dialogue. After the last spoken word the audio track is completely silent; no trailing ambiance or SFX.
- IDLE BEHAVIOR: after finishing dialogue the on-screen character holds a natural calm expression and idle posture — no unnatural mouth movement, strange gestures, or extraneous sounds.
- CONTINUITY: ambiance and SFX across all shots must be subtle and consistent (same room-tone family, same intensity). No sudden loud impacts or music stings unless the script explicitly demands.

## VOICE IDENTITY (critical for consistency)
At the start of planning, derive a single voice descriptor from the script's speaker/presenter (e.g., gender, approximate age, accent, tone, pace). Then include this EXACT descriptor phrase in the veoPrompt of EVERY shot — both presenter shots and B-roll voice-overs — so Veo generates a consistent voice across all clips. Example: "The speaking voice is a confident male voice, early 30s, clear American English, warm professional tone, moderate pace."

## DIALOGUE CONTRACT (critical)
- dialogue[]: EXACT verbatim lines in the user-requested language — no translation, no paraphrase.
- subtitle: verbatim dialogue lines joined by single space, same language. Empty if no dialogue.
- veoPrompt speech tag depends on whether a visible speaker is on screen:
  - ON-SCREEN speaker (presenter/character visible and speaking): end veoPrompt with 'The {speaker} says in {LanguageName}: "<line>"' per line, joined by ' Then '. This instructs Veo to generate lip-sync. Quoted text must be byte-identical to dialogue[i].line.
  - B-ROLL / no visible speaker (logo shots, UI shots, product shots, abstract visuals): if no person is described anywhere in the veoPrompt body, MUST append "no additional people, no background persons, no unscripted human figures in this shot". If the reference presenter IS intentionally present in the B-roll (e.g., pointing at a screen), describe them explicitly and use the ON-SCREEN speaker tag instead. Then end with 'Voice-over in {LanguageName}, no visible speaker: "<line>"'. Quoted text must be byte-identical to dialogue[i].line.
  - GENERAL RULE for ALL shots: every person who appears on screen must be explicitly described in the veoPrompt. Append "no unscripted background persons or crowd members beyond those described above" to every shot's veoPrompt to prevent Veo from hallucinating additional figures.

## SPEECH TIMING (critical)
Speaker starts within 0.3s and finishes before the last 0.5s. Append to veoPrompt: "the speaker begins talking immediately, no opening pause; the line ends just before the clip ends, no trailing silence".

## SUBTITLES & REFERENCES
- Subtitles: if enabled, fill subtitle in the script's original language; otherwise leave empty.
- Reference images: if provided (1-based), set referenceImageIndex on relevant shots (0 or omit = none).

Output STRICT JSON matching the provided schema. No markdown, no commentary.`;

export const STORYBOARD_REVIEW_SYSTEM_PROMPT = `You are a senior film editor performing a final review pass on a storyboard. Audit and FIX:

1. Duration: raw speaking time (dialogue chars/words only) ÷ rate (~4 CN/sec, ~2.5 EN words/sec, ~5 JP/KR/sec) + 0.5s buffer for dialogue shots or 1–1.5s for non-dialogue. Snap to the nearest allowed value that fits; if between two values choose the LARGER; only snap down when the smaller value has ≥0.5s margin. Never exceed max. Reject uniform durations when content varies.
2. Alternation: no more than one consecutive presenter/talking-head shot without a B-roll between them. Merge adjacent short presenter lines rather than allow back-to-back presenter shots.
3. Camera variety: each presenter-shot return to the same location must use a different focal length and camera move from all prior appearances. Fix repeated framing (e.g., two medium close-ups with push-in in a row).
4. Subject visual identity: verify at least one B-roll shot establishes the visual identity of any named product, service, AI, or brand mentioned in the script. Add one if missing.
5. Environment grounding: abstract B-roll (data flows, AI cores, network graphs) must be shown on an in-scene surface (holographic display, studio monitor, screen). Fix any elements floating in a featureless void unless style demands it.
6. Audio: (a) voice only under dialogue — no music or ambient hum; (b) complete silence after last spoken word — no trailing ambiance; (c) presenter holds natural calm idle after dialogue; (d) ambiance/SFX subtle and consistent across all shots.
7. Voice identity: every shot's veoPrompt must contain the same voice descriptor phrase (gender, age, accent, tone, pace). If missing or inconsistent across shots, unify them all to match the presenter described in the script or reference image.
8. Dialogue↔Veo: every dialogue[i].line must appear VERBATIM (byte-identical) inside veoPrompt. For shots with a visible on-screen speaker use 'The {speaker} says in {LanguageName}: "<line>"'. For B-roll shots with no person described: verify "no additional people, no background persons" clause is present and the tag is 'Voice-over in {LanguageName}, no visible speaker: "<line>"'. Verify every shot (presenter or B-roll) contains "no unscripted background persons" clause. Fix any missing constraints.
9. Subtitle/language: subtitle = verbatim dialogue joined by single space in the requested language.
10. Speech timing: every dialogue shot must direct the speaker to begin within 0.3s and finish before the last 0.5s. Add if missing.
11. Visual richness: every veoPrompt must be specific and sensory; add organic in-scene props when the topic supports it.
12. Coherence: continuityHint must match adjacent shots. Redistribute shots if pacing is off.
13. Forbidden: remove any obscene hand gestures.

Output the COMPLETE revised storyboard in STRICT JSON. No markdown, no commentary. Preserve detectedStyle and language unless clearly wrong.`;

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
