"use client";

/** Resize and JPEG-compress a File client-side; returns base64 (no data: prefix). */
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<{ mimeType: string; bytesBase64Encoded: string; size: number }> {
  const maxEdge = opts.maxEdge ?? 1280;
  const quality = opts.quality ?? 0.82;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality
    )
  );
  const buf = await blob.arrayBuffer();
  return {
    mimeType: "image/jpeg",
    bytesBase64Encoded: bytesToBase64(new Uint8Array(buf)),
    size: blob.size,
  };
}

/** Extract the last frame of a video (via blob URL or remote URL) as JPEG base64. */
export async function extractLastFrame(
  videoUrl: string,
  opts: { maxEdge?: number; quality?: number; tBeforeEnd?: number } = {}
): Promise<{ mimeType: string; bytesBase64Encoded: string }> {
  const maxEdge = opts.maxEdge ?? 1280;
  const quality = opts.quality ?? 0.85;
  const tBeforeEnd = opts.tBeforeEnd ?? 0.05;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("video load failed"));
  });

  // Seek to slightly before the end to avoid the rare blank-final-frame case.
  const target = Math.max(0, (video.duration || 0) - tBeforeEnd);
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("video seek failed"));
    try {
      video.currentTime = target;
    } catch (e) {
      reject(e as Error);
    }
  });

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(video, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality
    )
  );
  const buf = await blob.arrayBuffer();
  return {
    mimeType: "image/jpeg",
    bytesBase64Encoded: bytesToBase64(new Uint8Array(buf)),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
