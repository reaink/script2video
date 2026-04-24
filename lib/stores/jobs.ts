"use client";

import { create } from "zustand";
import type { Shot, ShotJob, ShotJobStatus } from "@/lib/types";

export interface JobConfig {
  videoModel: string;
  imageModel?: string; // Nano Banana, e.g. "gemini-2.5-flash-image-preview"
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  resolution?: "720p" | "1080p" | "4k";
  withReferenceFrames: boolean;
  concurrency: number;
  detectedStyle: string;
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

export const useJobsStore = create<RunState>((set, get) => {
  let cancelled = false;

  const setJob = (shotIndex: number, patch: Partial<ShotJob>) =>
    set((s) => ({ jobs: { ...s.jobs, [shotIndex]: { ...s.jobs[shotIndex], ...patch } } }));

  const runShot = async (shot: Shot): Promise<void> => {
    const cfg = get().config;
    if (!cfg) return;
    setJob(shot.index, { status: "running", startedAt: Date.now() });

    try {
      // 1) Optional first-frame via Nano Banana
      let imagePart: { bytesBase64Encoded: string; mimeType: string } | undefined;
      if (cfg.withReferenceFrames && cfg.imageModel) {
        const imgPrompt =
          `Cinematic still frame matching style "${cfg.detectedStyle}". ` +
          `Aspect ratio ${cfg.aspectRatio}. Scene: ${shot.summary}. ` +
          `Composition: ${shot.composition}. Camera: ${shot.camera}. ` +
          `Ambiance: ${shot.ambiance}. Photorealistic, no text, no watermark.`;
        const imgRes = await fetch("/api/image/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.imageModel,
            prompt: imgPrompt,
            aspectRatio: cfg.aspectRatio,
          }),
        });
        if (imgRes.ok) {
          imagePart = await imgRes.json();
        }
        // image failure is non-fatal — fall back to prompt-only
      }

      if (cancelled) return;

      // 2) Start Veo
      const startRes = await fetch("/api/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.videoModel,
          prompt: shot.veoPrompt,
          aspectRatio: cfg.aspectRatio,
          durationSeconds: cfg.durationSec,
          resolution: cfg.resolution,
          image: imagePart,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "veo start failed");
      const op = startData.name as string;
      setJob(shot.index, { operationName: op });

      // 3) Poll
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
          setJob(shot.index, {
            status: "done",
            videoUri: uri,
            finishedAt: Date.now(),
          });
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

  const drain = async (queue: Shot[], concurrency: number) => {
    const next = () => queue.shift();
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (!cancelled) {
        const s = next();
        if (!s) return;
        await runShot(s);
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
      await drain([...shots], config.concurrency);
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
      void runShot(shot);
    },
  };
});

export type JobStatusBadge = ShotJobStatus;
