"use client";

import { create } from "zustand";
import { extractLastFrame } from "@/lib/client/media";
import { fetchAndCacheVideo } from "@/lib/db/videoCache";
import type { ReferenceImage, Shot, ShotJob, ShotJobStatus } from "@/lib/types";

export interface JobConfig {
  videoModel: string;
  imageModel?: string; // Nano Banana, e.g. "gemini-2.5-flash-image-preview"
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  resolution?: "720p" | "1080p" | "4k";
  withReferenceFrames: boolean;
  /** chainFrames=true forces sequential execution and feeds previous shot's last frame as next shot's first frame. */
  chainFrames: boolean;
  concurrency: number;
  detectedStyle: string;
  /** User-uploaded reference images (1-based indexed in shot.referenceImageIndex). */
  referenceImages: ReferenceImage[];
}

interface RunState {
  jobs: Record<number, ShotJob>;
  shots: Shot[];
  config: JobConfig | null;
  running: boolean;
  startedAt: number | null;
  start: (shots: Shot[], config: JobConfig) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  retry: (shotIndex: number) => void;
}

const POLL_INTERVAL = 6000;
const MAX_POLL_MS = 10 * 60 * 1000;

interface ImagePart {
  bytesBase64Encoded: string;
  mimeType: string;
}

export const useJobsStore = create<RunState>((set, get) => {
  let cancelled = false;
  /** Cache of generated frame to feed as the next shot's first frame in chain mode. */
  const lastFrameByIndex: Record<number, ImagePart> = {};

  const setJob = (shotIndex: number, patch: Partial<ShotJob>) =>
    set((s) => ({ jobs: { ...s.jobs, [shotIndex]: { ...s.jobs[shotIndex], ...patch } } }));

  const generateNanoBananaFrame = async (
    cfg: JobConfig,
    shot: Shot,
    extraRefs: ImagePart[] = []
  ): Promise<ImagePart | undefined> => {
    if (!cfg.imageModel) return undefined;
    const imgPrompt =
      `Cinematic still frame matching style "${cfg.detectedStyle}". ` +
      `Aspect ratio ${cfg.aspectRatio}. Scene: ${shot.summary}. ` +
      `Composition: ${shot.composition}. Camera: ${shot.camera}. ` +
      `Ambiance: ${shot.ambiance}. Photorealistic, no text, no watermark.`;
    const res = await fetch("/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.imageModel,
        prompt: imgPrompt,
        aspectRatio: cfg.aspectRatio,
        referenceImages: extraRefs,
      }),
    });
    if (!res.ok) return undefined;
    return (await res.json()) as ImagePart;
  };

  const pickFirstFrame = async (
    cfg: JobConfig,
    shot: Shot,
    prevIndex: number | null
  ): Promise<ImagePart | undefined> => {
    // 1) Explicit user-attached reference image (1-based) — highest priority.
    if (
      shot.referenceImageIndex &&
      shot.referenceImageIndex > 0 &&
      cfg.referenceImages[shot.referenceImageIndex - 1]
    ) {
      const r = cfg.referenceImages[shot.referenceImageIndex - 1];
      return { bytesBase64Encoded: r.bytesBase64Encoded, mimeType: r.mimeType };
    }
    // 2) Chain frame: extracted tail of previous shot.
    if (cfg.chainFrames && prevIndex != null && lastFrameByIndex[prevIndex]) {
      return lastFrameByIndex[prevIndex];
    }
    // 3) Synthesized frame via Nano Banana, optionally seeded with all user refs.
    if (cfg.withReferenceFrames && cfg.imageModel) {
      const refs = cfg.referenceImages.map((r) => ({
        bytesBase64Encoded: r.bytesBase64Encoded,
        mimeType: r.mimeType,
      }));
      return generateNanoBananaFrame(cfg, shot, refs);
    }
    return undefined;
  };

  const runShot = async (shot: Shot, prevIndex: number | null): Promise<void> => {
    const cfg = get().config;
    if (!cfg) return;
    setJob(shot.index, { status: "running", startedAt: Date.now() });

    // Snap shot duration to the nearest allowed value based on model capabilities.
    const snapDuration = (d: number): number => {
      const allowed = cfg.videoModel.includes("lite")
        ? [5, 6, 8]
        : cfg.videoModel.includes("veo-3.0")
          ? [8]
          : [4, 6, 8];
      return allowed.reduce((best, v) => (Math.abs(v - d) < Math.abs(best - d) ? v : best));
    };
    const durationSeconds = snapDuration(shot.durationSec);

    try {
      const imagePart = await pickFirstFrame(cfg, shot, prevIndex);
      if (cancelled) return;

      const startRes = await fetch("/api/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.videoModel,
          prompt: shot.veoPrompt,
          aspectRatio: cfg.aspectRatio,
          durationSeconds,
          resolution: cfg.resolution,
          image: imagePart,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "veo start failed");
      const op = startData.name as string;
      setJob(shot.index, { operationName: op });

      const begin = Date.now();
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        if (cancelled) return;
        const sRes = await fetch(`/api/video/status?op=${encodeURIComponent(op)}`);
        const sData = await sRes.json();
        if (!sRes.ok) throw new Error(sData.error || "status failed");
        if (sData.error) throw new Error(sData.error.message ?? "veo error");
        if (sData.done) {
          const uri =
            sData.response?.generatedVideos?.[0]?.video?.uri ??
            sData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (!uri) throw new Error("no video uri in response");

          // Cache the video bytes immediately so we survive Veo's 2-day expiry.
          let blobUrl: string | undefined;
          try {
            blobUrl = await fetchAndCacheVideo(uri);
          } catch {
            // best-effort; UI can still fall back to the live proxy
          }

          setJob(shot.index, {
            status: "done",
            videoUri: uri,
            videoBlobUrl: blobUrl,
            finishedAt: Date.now(),
          });

          // Extract tail frame for the next shot in chain mode.
          if (cfg.chainFrames) {
            try {
              const src = blobUrl ?? `/api/video/proxy?uri=${encodeURIComponent(uri)}`;
              const tail = await extractLastFrame(src, { maxEdge: 1280 });
              lastFrameByIndex[shot.index] = tail;
            } catch {
              // tail extraction is best-effort
            }
          }
          return;
        }
        if (Date.now() - begin > MAX_POLL_MS) throw new Error("poll timeout");
      }
    } catch (e) {
      setJob(shot.index, {
        status: "failed",
        error: (e as Error).message,
        finishedAt: Date.now(),
      });
    }
  };

  const drainSequential = async (shots: Shot[]) => {
    let prev: number | null = null;
    for (const s of shots) {
      if (cancelled) return;
      await runShot(s, prev);
      prev = s.index;
    }
  };

  const drainParallel = async (shots: Shot[], concurrency: number) => {
    const queue = [...shots];
    const next = () => queue.shift();
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (!cancelled) {
        const s = next();
        if (!s) return;
        await runShot(s, null);
      }
    });
    await Promise.all(workers);
  };

  return {
    jobs: {},
    shots: [],
    config: null,
    running: false,
    startedAt: null,
    start: async (shots, config) => {
      cancelled = false;
      for (const k of Object.keys(lastFrameByIndex)) delete lastFrameByIndex[Number(k)];
      const initialJobs: Record<number, ShotJob> = {};
      shots.forEach((s) => {
        initialJobs[s.index] = { shotIndex: s.index, status: "queued" };
      });
      set({
        jobs: initialJobs,
        shots,
        config,
        running: true,
        startedAt: Date.now(),
      });
      if (config.chainFrames) {
        await drainSequential([...shots]);
      } else {
        await drainParallel([...shots], config.concurrency);
      }
      set({ running: false });
    },
    cancel: () => {
      cancelled = true;
      set({ running: false });
    },
    reset: () => {
      cancelled = true;
      set({ jobs: {}, shots: [], config: null, running: false, startedAt: null });
    },
    retry: (shotIndex) => {
      const shot = get().shots.find((s) => s.index === shotIndex);
      if (!shot) return;
      setJob(shotIndex, { status: "queued", error: undefined, videoUri: undefined });
      void runShot(shot, null);
    },
  };
});

export type JobStatusBadge = ShotJobStatus;
