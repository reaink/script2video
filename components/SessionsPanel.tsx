"use client";

import { Button, Drawer, useOverlayState } from "@heroui/react";
import { useEffect } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useSessionsStore } from "@/lib/stores/sessions";
import { useJobsStore } from "@/lib/stores/jobs";
import { useI18n } from "@/lib/i18n";

export function SessionsPanel() {
  const overlay = useOverlayState();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeId = useSessionsStore((s) => s.activeId);
  const switchTo = useSessionsStore((s) => s.switchTo);
  const remove = useSessionsStore((s) => s.remove);
  const newSession = useSessionsStore((s) => s.newSession);
  const load = useSessionsStore((s) => s.load);
  const loaded = useSessionsStore((s) => s.loaded);
  const sessionProgress = useJobsStore((s) => s.sessionProgress);
  const sessionVideoUris = useJobsStore((s) => s.sessionVideoUris);
  const { t } = useI18n();

  useEffect(() => {
    if (!loaded) void load();
  }, [load, loaded]);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onPress={overlay.open} className="gap-1.5">
          <MessageSquare className="size-4" />{t.sessionsLabel}{sessions.length > 0 ? ` (${sessions.length})` : ""}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          onPress={() => newSession()}
          aria-label={t.sessionsNew}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <Drawer state={overlay}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog>
              <Drawer.Header>
                <div className="flex w-full items-center justify-between">
                  <h3 className="text-base font-semibold">{t.sessionsTitle}</h3>
                  <Drawer.CloseTrigger />
                </div>
              </Drawer.Header>
              <Drawer.Body className="space-y-1">
                {sessions.length === 0 && (
                  <div className="text-sm text-default-500">{t.sessionsEmpty}</div>
                )}
                {sessions.map((s) => {
                  const isActive = s.id === activeId;
                  const progress = sessionProgress[s.id];
                  const cachedCount = (sessionVideoUris[s.id] ?? []).length;
                  const progressLabel = progress
                    ? `${progress.done}/${progress.total}`
                    : cachedCount > 0
                      ? String(cachedCount)
                      : "0";
                  return (
                    <div
                      key={s.id}
                      className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm ${isActive
                        ? "border-l-4 border-accent-500 bg-primary/10 pl-1.5"
                        : "hover:bg-default-100"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          switchTo(s.id);
                          overlay.close();
                        }}
                        className="flex-1 truncate text-left"
                      >
                        <div className={`truncate font-medium ${isActive ? "text-primary" : ""}`}>
                          {s.title}
                        </div>
                        <div className="text-xs text-default-500">
                          {s.messages.length} {t.sessionsMessages} · {t.sessionsVideos} {progressLabel}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        className="text-xs text-default-500 opacity-0 group-hover:opacity-100"
                        aria-label={t.sessionsDelete}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </Drawer.Body>
              <Drawer.Footer>
                <Button
                  variant="primary"
                  onPress={() => {
                    newSession();
                    overlay.close();
                  }}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />{t.sessionsNew}
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

