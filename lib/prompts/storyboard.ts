import type { Storyboard } from "@/lib/types";

export const STORYBOARD_SYSTEM_PROMPT = `You are a senior film director and storyboard planner.
Given a script from the user, you must:
1. Detect or infer a coherent visual style. If the user specified one, use it; otherwise propose one that fits the tone.
2. Split the script into natural shots. Each shot's durationSec should reflect the natural content length (integer 4–8, never exceed the user-specified max). Keep each shot self-contained, dense, and ensure adjacent shots transition naturally (continuityHint).
3. Each shot must include a complete English Veo prompt: subject, action, style, camera motion, composition, focus, ambiance, and any audio cues / dialogue in quotes. Make every shot visually RICH — include specific details about environment, lighting, textures, colors, micro-actions, and emotional tone. Generic or empty shots are not acceptable; every shot must feel like a distinct, memorable moment. If hands or fingers appear, explicitly forbid obscene gestures: append "no middle finger, no offensive hand gestures" to the veoPrompt.
4. Honor the subtitle setting from the user. If subtitles are enabled, fill the "subtitle" field per shot in the script's original language; otherwise leave it empty.
5. If the user attached reference images (1-based, in order), set "referenceImageIndex" on the shots that should visually anchor on a specific image. Use 0 (or omit) when none applies. Each image may be referenced by multiple shots.
6. Output STRICT JSON matching the provided schema. No markdown, no commentary.`;

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
    args.language ? `IMPORTANT: ALL subtitle and dialogue text MUST be written in language "${args.language}". This overrides the script's source language.` : ``,
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
