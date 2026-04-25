"use client";

import { Button, Drawer, useOverlayState } from "@heroui/react";
import { useEffect } from "react";
import { useSessionsStore } from "@/lib/stores/sessions";
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
  const { t } = useI18n();

  useEffect(() => {
    if (!loaded) void load();
  }, [load, loaded]);

  return (
    <>
      <Button variant="outline" size="sm" onPress={overlay.open}>
        {t.sessionsLabel}{sessions.length > 0 ? ` (${sessions.length})` : ""}
      </Button>
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
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-default-100 ${s.id === activeId ? "bg-default-100" : ""
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
                      <div className="truncate font-medium">{s.title}</div>
                      <div className="text-xs text-default-500">
                        {s.messages.length} {t.sessionsMessages} · {new Date(s.updatedAt).toLocaleString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      className="text-xs text-default-500 opacity-0 group-hover:opacity-100"
                      aria-label={t.sessionsDelete}
                    >
                      {t.sessionsDelete}
                    </button>
                  </div>
                ))}
              </Drawer.Body>
              <Drawer.Footer>
                <Button
                  variant="primary"
                  onPress={() => {
                    newSession();
                    overlay.close();
                  }}
                >
                  {t.sessionsNew}
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

