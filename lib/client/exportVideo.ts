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

export async function exportConcatenated(
  shots: { index: number; blobUrl?: string; videoUri?: string }[],
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

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

  const stream = canvas.captureStream(30);
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

    await new Promise<void>((resolve, reject) => {
      vid.currentTime = 0;
      const paint = () => {
        if (vid.ended || vid.paused) {
          ctx.drawImage(vid, 0, 0, W, H);
          URL.revokeObjectURL(objUrl);
          resolve();
          return;
        }
        ctx.drawImage(vid, 0, 0, W, H);
        requestAnimationFrame(paint);
      };
      vid.onended = () => {
        ctx.drawImage(vid, 0, 0, W, H);
        URL.revokeObjectURL(objUrl);
        resolve();
      };
      vid.onerror = () => reject(new Error(`playback error shot #${i + 1}`));
      void vid.play().then(() => requestAnimationFrame(paint));
    });
  }

  recorder.stop();
  await recordingDone;

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
