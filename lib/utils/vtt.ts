import type { Shot } from "@/lib/types";

function fmt(t: number): string {
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  const total = Math.floor(t);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/** SRT timestamp uses comma as decimal separator. */
function fmtSrt(t: number): string {
  return fmt(t).replace(".", ",");
}

/**
 * Split subtitle text into sentences for multi-cue output.
 * Splits on sentence-ending punctuation (Chinese/English).
 */
function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？!?.…]+)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

/** Build a single-cue WebVTT covering [0, durationSec] from a shot's subtitle text. */
export function buildShotVtt(shot: Pick<Shot, "subtitle" | "durationSec">): string | null {
  const text = shot.subtitle?.trim();
  if (!text) return null;
  const sentences = splitSentences(text);
  const dur = shot.durationSec;
  const perCue = dur / sentences.length;
  const cues = sentences
    .map((s, i) => {
      const start = i * perCue;
      const end = Math.min((i + 1) * perCue, dur);
      return `${fmt(start)} --> ${fmt(end)}\n${s}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

/** Convert a VTT string to a data: URL safe for <track src>. */
export function vttToDataUrl(vtt: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}

/**
 * Build a full-film WebVTT from all shots (absolute timestamps).
 * Shots are assumed to be contiguous starting from 0.
 */
export function buildFullVtt(shots: Pick<Shot, "subtitle" | "durationSec" | "index">[]): string {
  let offset = 0;
  const cues: string[] = [];
  for (const shot of shots) {
    const text = shot.subtitle?.trim();
    const dur = shot.durationSec;
    if (text) {
      const sentences = splitSentences(text);
      const perCue = dur / sentences.length;
      sentences.forEach((s, i) => {
        const start = offset + i * perCue;
        const end = Math.min(offset + (i + 1) * perCue, offset + dur);
        cues.push(`${fmt(start)} --> ${fmt(end)}\n${s}`);
      });
    }
    offset += dur;
  }
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/**
 * Build a full-film SRT from all shots (absolute timestamps).
 */
export function buildFullSrt(shots: Pick<Shot, "subtitle" | "durationSec" | "index">[]): string {
  let offset = 0;
  let seq = 1;
  const entries: string[] = [];
  for (const shot of shots) {
    const text = shot.subtitle?.trim();
    const dur = shot.durationSec;
    if (text) {
      const sentences = splitSentences(text);
      const perCue = dur / sentences.length;
      sentences.forEach((s, i) => {
        const start = offset + i * perCue;
        const end = Math.min(offset + (i + 1) * perCue, offset + dur);
        entries.push(`${seq++}\n${fmtSrt(start)} --> ${fmtSrt(end)}\n${s}`);
      });
    }
    offset += dur;
  }
  return entries.join("\n\n") + "\n";
}
