"use client";

/**
 * Concatenate multiple video blobs into one by drawing each to a Canvas
 * and recording via MediaRecorder. Pure client-side, no server round-trip.
 *
 * Strategy:
 *  1. For each blob create an HTMLVideoElement and play it into an OffscreenCanvas
 *     (or regular Canvas) via requestAnimationFrame capture loop.
 *  2. MediaRecorder records the canvas stream to webm/mp4.
 *
 * Limitation: audio from source clips is NOT preserved (Veo clips have no audio track
 * in the downloadable URI, so this is fine for the current use case).
 */

export interface ExportProgress {
  shot: number;
  total: number;
  phase: "preparing" | "encoding" | "done";
}

type ProgressCb = (p: ExportProgress) => void;

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.blob();
}

function loadVideo(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const url = URL.createObjectURL(blob);
    v.oncanplaythrough = () => resolve(v);
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video load error"));
    };
    v.src = url;
    v.load();
  });
}

export interface ExportShot {
  index: number;
  blobUrl?: string;
  videoUri?: string;
  subtitle?: string;
  durationSec?: number;
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？!?.…]+)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

/**
 * Apply linear fade-in and fade-out to the edges of an AudioBuffer in place.
 * Smooths abrupt audio level jumps between concatenated shots.
 */
function applyEdgeFades(buf: AudioBuffer, seconds: number): void {
  const fadeLen = Math.min(
    Math.floor(seconds * buf.sampleRate),
    Math.floor(buf.length / 2)
  );
  if (fadeLen <= 0) return;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < fadeLen; i++) {
      const g = i / fadeLen;
      data[i] *= g;
      data[data.length - 1 - i] *= g;
    }
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const lines: string[] = [];
  // Prefer word boundaries for Latin; fall back to char wrap for CJK
  const words = text.split(" ");
  if (words.length > 1) {
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  } else {
    let line = "";
    for (const char of text) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string
) {
  const fontSize = Math.max(24, Math.round(H * 0.048));
  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = Math.max(3, fontSize * 0.12);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = "#ffffff";

  const maxWidth = W * 0.9;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.25;
  const baseY = H - Math.round(H * 0.04);

  for (let i = lines.length - 1; i >= 0; i--) {
    const y = baseY - (lines.length - 1 - i) * lineHeight;
    ctx.strokeText(lines[i], W / 2, y);
    ctx.fillText(lines[i], W / 2, y);
  }
  ctx.restore();
}

export async function exportConcatenated(
  shots: ExportShot[],
  onProgress?: ProgressCb
): Promise<Blob> {
  const total = shots.length;

  // 1. Gather blobs for each shot
  const blobs: Blob[] = [];
  for (let i = 0; i < shots.length; i++) {
    onProgress?.({ shot: i + 1, total, phase: "preparing" });
    const s = shots[i];
    if (s.blobUrl) {
      blobs.push(await blobFromUrl(s.blobUrl));
    } else if (s.videoUri) {
      const proxyUrl = `/api/video/proxy?uri=${encodeURIComponent(s.videoUri)}`;
      blobs.push(await blobFromUrl(proxyUrl));
    } else {
      throw new Error(`Shot #${s.index} has no video`);
    }
  }

  onProgress?.({ shot: 0, total, phase: "encoding" });

  // 2. Load all videos to get dimensions from the first one
  const firstVid = await loadVideo(blobs[0]);
  const W = firstVid.videoWidth || 1280;
  const H = firstVid.videoHeight || 720;

  // 3. Setup canvas + MediaRecorder
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const mimeType =
    MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") ? "video/mp4;codecs=avc1" :
      MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" :
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
          "video/webm";

  // Audio pipeline: decode audio directly from blob (bypasses muted attribute issues)
  let audioCtx: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  const stream = canvas.captureStream(30);
  try {
    audioCtx = new AudioContext();
    await audioCtx.resume();
    const audioDest = audioCtx.createMediaStreamDestination();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioDest);
    for (const track of audioDest.stream.getAudioTracks()) {
      stream.addTrack(track);
    }
  } catch {
    audioCtx = null;
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(100);

  // 4. Paint each video clip to canvas in sequence
  for (let i = 0; i < blobs.length; i++) {
    onProgress?.({ shot: i + 1, total, phase: "encoding" });
    const vid = i === 0 ? firstVid : await loadVideo(blobs[i]);
    const objUrl = vid.src;

    // Decode audio directly from blob — independent of video element's muted state
    let audioSrc: AudioBufferSourceNode | null = null;
    if (audioCtx && gainNode) {
      try {
        const ab = await blobs[i].arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(ab);
        applyEdgeFades(audioBuf, 0.08); // 80ms fade in/out smooths shot-to-shot joins
        audioSrc = audioCtx.createBufferSource();
        audioSrc.buffer = audioBuf;
        audioSrc.connect(gainNode);
        audioSrc.start();
      } catch {
        // clip has no audio track or codec unsupported
      }
    }

    const shot = shots[i];
    const subtitleCues = shot.subtitle?.trim()
      ? splitSentences(shot.subtitle.trim())
      : null;
    const cueInterval = subtitleCues && shot.durationSec
      ? shot.durationSec / subtitleCues.length
      : 0;

    const paintSubtitle = () => {
      if (!subtitleCues) return;
      const cueIdx = cueInterval > 0
        ? Math.min(Math.floor(vid.currentTime / cueInterval), subtitleCues.length - 1)
        : 0;
      drawSubtitle(ctx, W, H, subtitleCues[cueIdx]);
    };

    await new Promise<void>((resolve, reject) => {
      vid.currentTime = 0;
      const paint = () => {
        if (vid.ended || vid.paused) {
          ctx.drawImage(vid, 0, 0, W, H);
          paintSubtitle();
          URL.revokeObjectURL(objUrl);
          resolve();
          return;
        }
        ctx.drawImage(vid, 0, 0, W, H);
        paintSubtitle();
        requestAnimationFrame(paint);
      };
      vid.onended = () => {
        ctx.drawImage(vid, 0, 0, W, H);
        paintSubtitle();
        URL.revokeObjectURL(objUrl);
        resolve();
      };
      vid.onerror = () => reject(new Error(`playback error shot #${i + 1}`));
      void vid.play().then(() => requestAnimationFrame(paint));
    });

    audioSrc?.disconnect();
  }

  recorder.stop();
  await recordingDone;
  await audioCtx?.close();

  onProgress?.({ shot: total, total, phase: "done" });
  return new Blob(chunks, { type: mimeType });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
