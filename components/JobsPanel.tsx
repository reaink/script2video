"use client";

import { Button, Card, Chip, Drawer, Spinner, useOverlayState } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useJobsStore } from "@/lib/stores/jobs";
import { getCachedVideoUrl, getCacheStats } from "@/lib/db/videoCache";
import { buildShotVtt, buildFullSrt, buildFullVtt, vttToDataUrl } from "@/lib/utils/vtt";
import { downloadBlob, exportConcatenated } from "@/lib/client/exportVideo";
import type { ExportProgress } from "@/lib/client/exportVideo";
import type { Shot } from "@/lib/types";

interface Props {
  triggerLabel?: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "排队中",
  running: "生成中",
  done: "完成",
  failed: "失败",
};

const STATUS_COLOR: Record<string, "default" | "accent" | "success" | "warning" | "danger"> = {
  queued: "default",
  running: "accent",
  done: "success",
  failed: "danger",
};

export function JobsPanel({ triggerLabel = "查看生成进度" }: Props) {
  const overlay = useOverlayState();
  const jobs = useJobsStore((s) => s.jobs);
  const shots = useJobsStore((s) => s.shots);
  const running = useJobsStore((s) => s.running);
  const cancel = useJobsStore((s) => s.cancel);
  const retry = useJobsStore((s) => s.retry);
  const reset = useJobsStore((s) => s.reset);
  const regenerate = useJobsStore((s) => s.regenerate);

  const total = shots.length;
  const done = shots.filter((s) => jobs[s.index]?.status === "done").length;
  const failed = shots.filter((s) => jobs[s.index]?.status === "failed").length;

  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [cacheStats, setCacheStats] = useState<{ count: number; totalBytes: number } | null>(null);

  useEffect(() => {
    if (overlay.isOpen) {
      void getCacheStats().then(setCacheStats);
    }
  }, [overlay.isOpen]);

  const hasSubtitles = shots.some((s) => s.subtitle?.trim());
  const allDone = total > 0 && done === total;

  const exportVideo = async () => {
    const readyShots = shots
      .filter((s) => jobs[s.index]?.status === "done")
      .map((s) => ({
        index: s.index,
        blobUrl: jobs[s.index]?.videoBlobUrl,
        videoUri: jobs[s.index]?.videoUri,
      }));
    if (readyShots.length === 0) return;
    try {
      setExportProgress({ shot: 0, total: readyShots.length, phase: "preparing" });
      const blob = await exportConcatenated(readyShots, setExportProgress);
      downloadBlob(blob, "film.webm");
    } finally {
      setExportProgress(null);
    }
  };

  const exportSrt = () => {
    const srt = buildFullSrt(shots);
    downloadBlob(new Blob([srt], { type: "text/srt" }), "subtitles.srt");
  };

  const exportVtt = () => {
    const vtt = buildFullVtt(shots);
    downloadBlob(new Blob([vtt], { type: "text/vtt" }), "subtitles.vtt");
  };

  // Auto-open when a run starts.
  useEffect(() => {
    if (running && !overlay.isOpen) overlay.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return (
    <>
      <Button variant="outline" size="sm" onPress={overlay.open} isDisabled={total === 0}>
        {triggerLabel}
        {total > 0 && (
          <Chip size="sm" variant="soft" className="ml-2">
            {done}/{total}
          </Chip>
        )}
      </Button>
      <Drawer state={overlay}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.Header>
                <div className="flex w-full items-center justify-between">
                  <h3 className="text-base font-semibold">生成进度</h3>
                  <Drawer.CloseTrigger />
                </div>
              </Drawer.Header>
              <Drawer.Body className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip variant="soft">总数 {total}</Chip>
                  <Chip variant="soft" color="success">完成 {done}</Chip>
                  {failed > 0 && (
                    <Chip variant="soft" color="danger">失败 {failed}</Chip>
                  )}
                  {running && <Spinner size="sm" />}
                </div>

                {/* Export & subtitle actions */}
                {total > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={exportVideo}
                      isDisabled={done === 0 || !!exportProgress}
                    >
                      {exportProgress
                        ? exportProgress.phase === "done"
                          ? "完成"
                          : `${exportProgress.phase === "preparing" ? "准备" : "编码"} ${exportProgress.shot}/${exportProgress.total}`
                        : `导出整片 (${done}/${total})`}
                    </Button>
                    {hasSubtitles && (
                      <>
                        <Button size="sm" variant="outline" onPress={exportSrt} isDisabled={!allDone}>
                          导出 SRT
                        </Button>
                        <Button size="sm" variant="outline" onPress={exportVtt} isDisabled={!allDone}>
                          导出 VTT
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {cacheStats && (
                  <div className="text-xs text-default-500">
                    缓存：{cacheStats.count} 个视频 / {(cacheStats.totalBytes / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
                {shots.map((s) => {
                  const job = jobs[s.index];
                  const status = job?.status ?? "queued";
                  return (
                    <Card key={s.index}>
                      <Card.Content className="space-y-2 p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">
                            #{s.index} · {s.durationSec}s
                          </div>
                          <Chip size="sm" color={STATUS_COLOR[status]} variant="soft">
                            {STATUS_LABEL[status]}
                          </Chip>
                        </div>
                        <div className="text-default-600">{s.summary}</div>
                        {job?.error && (
                          <div className="text-danger">错误：{job.error}</div>
                        )}
                        {job?.videoUri && (
                          <ShotPlayer
                            shot={s}
                            videoUri={job.videoUri}
                            blobUrl={job.videoBlobUrl}
                          />
                        )}
                        <div className="flex flex-wrap gap-2">
                          {status === "failed" && (
                            <Button size="sm" variant="ghost" onPress={() => retry(s.index)}>
                              重试
                            </Button>
                          )}
                          <RegenerateButton shot={s} onRegenerate={regenerate} />
                        </div>
                      </Card.Content>
                    </Card>
                  );
                })}
              </Drawer.Body>
              <Drawer.Footer>
                {running ? (
                  <Button variant="danger" onPress={cancel}>
                    取消
                  </Button>
                ) : (
                  <Button variant="ghost" onPress={reset} isDisabled={total === 0}>
                    清空
                  </Button>
                )}
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

function ShotPlayer({
  shot,
  videoUri,
  blobUrl,
}: {
  shot: Shot;
  videoUri: string;
  blobUrl?: string;
}) {
  // Try the IDB cache first; fall back to the live proxy if Veo's URI is still fresh.
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(blobUrl ?? null);
  const [restoring, setRestoring] = useState<boolean>(!blobUrl);
  const [hasCache, setHasCache] = useState<boolean>(Boolean(blobUrl));

  useEffect(() => {
    if (blobUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedUrl(blobUrl);
      setHasCache(true);
      setRestoring(false);
      return;
    }
    let revoked: string | null = null;
    setRestoring(true);
    void (async () => {
      try {
        const cached = await getCachedVideoUrl(videoUri);
        if (cached) {
          revoked = cached;
          setResolvedUrl(cached);
          setHasCache(true);
        } else {
          setResolvedUrl(`/api/video/proxy?uri=${encodeURIComponent(videoUri)}`);
          setHasCache(false);
        }
      } finally {
        setRestoring(false);
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [videoUri, blobUrl]);

  const vttUrl = useMemo(() => {
    const vtt = buildShotVtt(shot);
    return vtt ? vttToDataUrl(vtt) : null;
  }, [shot]);

  if (restoring && !resolvedUrl) {
    return (
      <div className="flex items-center gap-2 text-xs text-default-500">
        <Spinner size="sm" /> 加载缓存…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video
        controls
        className="w-full rounded-md bg-black"
        crossOrigin="anonymous"
        src={resolvedUrl ?? undefined}
      >
        {vttUrl && (
          <track
            kind="subtitles"
            src={vttUrl}
            srcLang={inferLang(shot.subtitle)}
            label="字幕"
            default
          />
        )}
      </video>
      <div className="flex flex-wrap gap-3 text-xs">
        <a
          className="text-primary underline"
          href={`/api/video/proxy?uri=${encodeURIComponent(videoUri)}&download=1`}
        >
          下载 mp4
        </a>
        {vttUrl && (
          <a className="text-primary underline" href={vttUrl} download={`shot-${shot.index}.vtt`}>
            下载 vtt
          </a>
        )}
        <span className={hasCache ? "text-success" : "text-warning"}>
          {hasCache ? "已缓存" : "未缓存（实时代理）"}
        </span>
      </div>
    </div>
  );
}

function inferLang(text: string | undefined): string {
  if (!text) return "und";
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
}

function RegenerateButton({
  shot,
  onRegenerate,
}: {
  shot: Shot;
  onRegenerate: (shotIndex: number, newPrompt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(shot.veoPrompt);

  if (!editing) {
    return (
      <Button size="sm" variant="ghost" onPress={() => { setPrompt(shot.veoPrompt); setEditing(true); }}>
        重生镜头
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <textarea
        className="w-full rounded-md border border-default-200 bg-default-50 p-2 text-xs"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onPress={() => { onRegenerate(shot.index, prompt); setEditing(false); }}
          isDisabled={!prompt.trim()}
        >
          重新生成
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setEditing(false)}>
          取消
        </Button>
      </div>
    </div>
  );
}
