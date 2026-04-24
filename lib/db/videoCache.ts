"use client";

import { idbDelete, idbGet, idbGetAll, idbPut, STORE_VIDEOS } from "./idb";

interface VideoRecord {
  key: string; // veo uri (the canonical key)
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
  accessedAt: number;
}

/** Hash a Veo URI into a short key. */
export function videoKey(uri: string): string {
  return uri;
}

export async function cacheVideo(uri: string, blob: Blob): Promise<void> {
  const now = Date.now();
  const rec: VideoRecord = {
    key: videoKey(uri),
    blob,
    mimeType: blob.type || "video/mp4",
    size: blob.size,
    createdAt: now,
    accessedAt: now,
  };
  await idbPut(STORE_VIDEOS, rec);
}

/** Returns an object URL if the video is cached, else null. Caller is responsible for revoking. */
export async function getCachedVideoUrl(uri: string): Promise<string | null> {
  const rec = await idbGet<VideoRecord>(STORE_VIDEOS, videoKey(uri));
  if (!rec) return null;
  // Touch accessedAt for LRU tracking
  void idbPut(STORE_VIDEOS, { ...rec, accessedAt: Date.now() });
  return URL.createObjectURL(rec.blob);
}

export async function getCachedVideoBlob(uri: string): Promise<Blob | null> {
  const rec = await idbGet<VideoRecord>(STORE_VIDEOS, videoKey(uri));
  if (!rec) return null;
  void idbPut(STORE_VIDEOS, { ...rec, accessedAt: Date.now() });
  return rec.blob;
}

/** Fetch via the SSRF-safe proxy and cache. Returns the cached object URL. */
export async function fetchAndCacheVideo(uri: string): Promise<string> {
  const existing = await getCachedVideoUrl(uri);
  if (existing) return existing;
  const res = await fetch(`/api/video/proxy?uri=${encodeURIComponent(uri)}`);
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const blob = await res.blob();
  await cacheVideo(uri, blob);
  // Best-effort LRU eviction after caching
  void evictLRU();
  return URL.createObjectURL(blob);
}

export async function listCachedVideos(): Promise<VideoRecord[]> {
  return idbGetAll<VideoRecord>(STORE_VIDEOS);
}

export async function evictVideo(uri: string): Promise<void> {
  await idbDelete(STORE_VIDEOS, videoKey(uri));
}

/** Evict LRU entries until total cache size is below maxBytes (default 500 MB). */
export async function evictLRU(maxBytes = 500 * 1024 * 1024): Promise<void> {
  const all = await listCachedVideos();
  const total = all.reduce((s, r) => s + r.size, 0);
  if (total <= maxBytes) return;
  // Sort by LRU (oldest access first)
  const sorted = [...all].sort((a, b) => (a.accessedAt ?? 0) - (b.accessedAt ?? 0));
  let freed = 0;
  const toFree = total - maxBytes;
  for (const rec of sorted) {
    if (freed >= toFree) break;
    await idbDelete(STORE_VIDEOS, rec.key);
    freed += rec.size;
  }
}

/** Return current cache stats. */
export async function getCacheStats(): Promise<{ count: number; totalBytes: number }> {
  const all = await listCachedVideos();
  return { count: all.length, totalBytes: all.reduce((s, r) => s + r.size, 0) };
}
