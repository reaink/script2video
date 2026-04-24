"use client";

import { idbDelete, idbGet, idbGetAll, idbPut, STORE_VIDEOS } from "./idb";

interface VideoRecord {
  key: string; // veo uri (the canonical key)
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
}

/** Hash a Veo URI into a short key. */
export function videoKey(uri: string): string {
  return uri;
}

export async function cacheVideo(uri: string, blob: Blob): Promise<void> {
  const rec: VideoRecord = {
    key: videoKey(uri),
    blob,
    mimeType: blob.type || "video/mp4",
    size: blob.size,
    createdAt: Date.now(),
  };
  await idbPut(STORE_VIDEOS, rec);
}

/** Returns an object URL if the video is cached, else null. Caller is responsible for revoking. */
export async function getCachedVideoUrl(uri: string): Promise<string | null> {
  const rec = await idbGet<VideoRecord>(STORE_VIDEOS, videoKey(uri));
  if (!rec) return null;
  return URL.createObjectURL(rec.blob);
}

export async function getCachedVideoBlob(uri: string): Promise<Blob | null> {
  const rec = await idbGet<VideoRecord>(STORE_VIDEOS, videoKey(uri));
  return rec?.blob ?? null;
}

/** Fetch via the SSRF-safe proxy and cache. Returns the cached object URL. */
export async function fetchAndCacheVideo(uri: string): Promise<string> {
  const existing = await getCachedVideoUrl(uri);
  if (existing) return existing;
  const res = await fetch(`/api/video/proxy?uri=${encodeURIComponent(uri)}`);
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const blob = await res.blob();
  await cacheVideo(uri, blob);
  return URL.createObjectURL(blob);
}

export async function listCachedVideos(): Promise<VideoRecord[]> {
  return idbGetAll<VideoRecord>(STORE_VIDEOS);
}

export async function evictVideo(uri: string): Promise<void> {
  await idbDelete(STORE_VIDEOS, videoKey(uri));
}
