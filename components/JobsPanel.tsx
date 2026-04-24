"use client";

import { Button, Card, Chip, Drawer, Spinner, useOverlayState } from "@heroui/react";
import { useEffect } from "react";
import { useJobsStore } from "@/lib/stores/jobs";

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

  const total = shots.length;
  const done = shots.filter((s) => jobs[s.index]?.status === "done").length;
  const failed = shots.filter((s) => jobs[s.index]?.status === "failed").length;

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
          <Drawer.Content placement="right" className="w-full max-w-xl">
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
                          <div className="space-y-2">
                            <video
                              controls
                              src={`/api/video/proxy?uri=${encodeURIComponent(job.videoUri)}`}
                              className="w-full rounded-md bg-black"
                            />
                            <div className="flex gap-2">
                              <a
                                className="text-xs text-primary underline"
                                href={`/api/video/proxy?uri=${encodeURIComponent(job.videoUri)}&download=1`}
                              >
                                下载 mp4
                              </a>
                            </div>
                          </div>
                        )}
                        {status === "failed" && (
                          <Button size="sm" variant="ghost" onPress={() => retry(s.index)}>
                            重试
                          </Button>
                        )}
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
