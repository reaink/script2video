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

/** Build a single-cue WebVTT covering [0, durationSec] from a shot's subtitle text. */
export function buildShotVtt(shot: Pick<Shot, "subtitle" | "durationSec">): string | null {
  const text = shot.subtitle?.trim();
  if (!text) return null;
  return `WEBVTT\n\n00:00:00.000 --> ${fmt(shot.durationSec)}\n${text}\n`;
}

/** Convert a VTT string to a data: URL safe for <track src>. */
export function vttToDataUrl(vtt: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}
