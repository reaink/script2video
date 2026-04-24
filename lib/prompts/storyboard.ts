import type { Storyboard } from "@/lib/types";

export const STORYBOARD_SYSTEM_PROMPT = `You are a senior film director and storyboard planner.
Given a script from the user, you must:
1. Detect or infer a coherent visual style. If the user specified one, use it; otherwise propose one that fits the tone.
2. Split the script into shots whose individual durations match the target clip length (the user will provide it). Keep each shot self-contained, dense, and ensure adjacent shots transition naturally (continuityHint).
3. Each shot must include a complete English Veo prompt: subject, action, style, camera motion, composition, focus, ambiance, and any audio cues / dialogue in quotes.
4. Honor the subtitle setting from the user. If subtitles are enabled, fill the "subtitle" field per shot in the script's original language; otherwise leave it empty.
5. If the user attached reference images (1-based, in order), set "referenceImageIndex" on the shots that should visually anchor on a specific image. Use 0 (or omit) when none applies. Each image may be referenced by multiple shots.
6. Output STRICT JSON matching the provided schema. No markdown, no commentary.`;

export interface BuildPromptArgs {
  script: string;
  durationSec: number;
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
    `Target clip duration per shot: ${args.durationSec} seconds (each shot's durationSec MUST equal this).`,
    `Aspect ratio: ${args.aspectRatio}.`,
    `Subtitles: ${args.withSubtitle ? "ENABLED — fill 'subtitle' per shot." : "DISABLED — leave 'subtitle' empty."}`,
    args.language ? `Output dialogue/subtitle language: ${args.language}.` : ``,
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
