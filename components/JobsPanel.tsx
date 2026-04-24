"use client";

import { Button, Card, Chip, Drawer, Spinner, useOverlayState } from "@heroui/react";
import { useMemo } from "react";
import { useJobsStore } from "@/lib/stores/jobs";
import type { JobConfig } from "@/lib/stores/jobs";
import type { Shot, Storyboard } from "@/lib/types";

interface Props {
  storyboard: Storyboard;
  videoModel: string;
  imageModel?: string;
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  withReferenceFrames: boolean;
  concurrency: number;
}

export function JobsPanel(props: Props) {
  const state = useOverlayState();
  const { jobs, running, shots, start, cancel, reset, retry } = useJobsStore();

  const cfg: JobConfig = useMemo(
    () => ({
      videoModel: props.videoModel,
      imageModel: props.imageModel,
      aspectRatio: props.aspectRatio,
      durationSec: props.durationSec,
      withReferenceFrames: props.withReferenceFrames,
      concurrency: props.concurrency,
      detectedStyle: props.storyboard.detectedStyle,
    }),
    [props]
  );

  const runHere = props.storyboard.shots === shots && Object.keys(jobs).length > 0;
  const stats = useMemo(() => {
    const list = Object.values(jobs);
    return {
      total: list.length,
      done: list.filter((j) => j.status === "done").length,
      failed: list.filter((j) => j.status === "failed").length,
      running: list.filter((j) => j.status === "running").length,
    };
  }, [jobs]);

  const onStart = async () => {
    state.open();
    await start(props.storyboard.shots, cfg);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onPress={onStart} isDisabled={running}>
          {running ? <Spinner size="sm" /> : "确认并生成视频"}
        </Button>
        {runHere && (
          <Button variant="ghost" size="sm" onPress={() => state.open()}>
            查看进度（{stats.done}/{stats.total}）
          </Button>
        )}
      </div>

      <Drawer state={state}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right" className="w-full max-w-3xl">
            <Drawer.Dialog>
              <Drawer.Header className="flex items-center justify-between p-4">
                <Drawer.Heading className="text-lg font-semibold">视频生成进度</Drawer.Heading>
                <div className="flex items-center gap-2 text-xs text-default-500">
                  <Chip size="sm">完成 {stats.done}</Chip>
                  <Chip size="sm" color="warning">
                    进行中 {stats.running}
                  </Chip>
                  {stats.failed > 0 && (
                    <Chip size="sm" color="danger">
                      失败 {stats.failed}
                    </Chip>
                  )}
                </div>
              </Drawer.Header>
              <Drawer.Body className="space-y-3 p-4">
                {(runHere ? shots : props.storyboard.shots).map((s) => (
                  <ShotJobCard key={s.index} shot={s} onRetry={() => retry(s.index)} />
                ))}
              </Drawer.Body>
              <Drawer.Footer className="flex justify-between gap-2 p-4">
                <Button variant="ghost" size="sm" onPress={reset} isDisabled={running}>
                  清空
                </Button>
                <div className="flex gap-2">
                  {running && (
                    <Button variant="danger" size="sm" onPress={cancel}>
                      取消
                    </Button>
                  )}
                  <Drawer.CloseTrigger>
                    <Button variant="ghost" size="sm">
                      关闭
                    </Button>
                  </Drawer.CloseTrigger>
                </div>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

function ShotJobCard({ shot, onRetry }: { shot: Shot; onRetry: () => void }) {
  const job = useJobsStore((s) => s.jobs[shot.index]);
  const status = job?.status ?? "queued";
  return (
    <Card>
      <Card.Content className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">
            #{shot.index} · {shot.summary}
          </div>
          <StatusChip status={status} />
        </div>
        {job?.error && <div className="text-xs text-danger">{job.error}</div>}
        {status === "done" && job?.videoUri && (
          <div className="space-y-2">
            <video
              controls
              className="w-full rounded-lg"
              src={`/api/video/proxy?uri=${encodeURIComponent(job.videoUri)}`}
            />
            <a
              href={`/api/video/proxy?uri=${encodeURIComponent(job.videoUri)}&download=1`}
              download={`shot-${shot.index}.mp4`}
              className="text-xs text-primary underline"
            >
              下载 MP4
            </a>
          </div>
        )}
        {status === "failed" && (
          <Button variant="ghost" size="sm" onPress={onRetry}>
            重试
          </Button>
        )}
        {status === "running" && (
          <div className="flex items-center gap-2 text-xs text-default-500">
            <Spinner size="sm" /> Veo 生成中...（约 1-3 分钟）
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "done"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "running"
          ? "warning"
          : "default";
  const label =
    status === "done"
      ? "完成"
      : status === "failed"
        ? "失败"
        : status === "running"
          ? "进行中"
          : "排队";
  return (
    <Chip size="sm" color={color as "success" | "danger" | "warning" | "default"}>
      {label}
    </Chip>
  );
}
