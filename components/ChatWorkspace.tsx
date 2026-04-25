"use client";

import {
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
  toast,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import { compressImage } from "@/lib/client/media";
import { useJobsStore } from "@/lib/stores/jobs";
import { useSessionsStore } from "@/lib/stores/sessions";
import { JobsPanel } from "@/components/JobsPanel";
import { SessionsPanel } from "@/components/SessionsPanel";
import type { GeminiModel, ReferenceImage, Storyboard } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type Models = { chat: GeminiModel[]; video: GeminiModel[]; image: GeminiModel[] };

const MAX_REFERENCE_IMAGES = 3;

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  storyboard?: Storyboard;
}

const SETTINGS_KEY = "s2v_ui_settings_v1";
interface UiSettings {
  chatModel?: string;
  videoModel?: string;
  imageModel?: string;
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  withSubtitle: boolean;
  withReferenceFrames: boolean;
  /** Sequential mode: chain previous shot's last frame as next shot's first frame. */
  chainFrames: boolean;
  concurrency: number;
  autoContinue: boolean;
  language: string;
}
const DEFAULT_SETTINGS: UiSettings = {
  aspectRatio: "16:9",
  durationSec: 8,
  withSubtitle: true,
  withReferenceFrames: true,
  chainFrames: true,
  concurrency: 1,
  autoContinue: true,
  language: "en-US",
};

function loadUiSettings(): UiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function deriveSessionTitle(messages: UiMessage[], defaultTitle: string): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return defaultTitle;
  const t = first.content.trim().split(/\s+/).slice(0, 6).join(" ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || defaultTitle;
}

function pickPreferred(list: GeminiModel[], preferred: string[]): string | undefined {
  for (const p of preferred) {
    if (list.some((m) => m.name === p)) return p;
  }
  return undefined;
}

export function ChatWorkspace() {
  const [models, setModels] = useState<Models | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  // Always start with DEFAULT_SETTINGS so server and client render identically.
  // useEffect below patches in the persisted values after hydration.
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const startJobs = useJobsStore((s) => s.start);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useI18n();

  const sessionsLoaded = useSessionsStore((s) => s.loaded);
  const sessionsList = useSessionsStore((s) => s.sessions);
  const activeId = useSessionsStore((s) => s.activeId);
  const loadSessions = useSessionsStore((s) => s.load);
  const newSession = useSessionsStore((s) => s.newSession);
  const saveActive = useSessionsStore((s) => s.saveActive);
  /** Tracks the id we last hydrated from to avoid clobbering pending edits. */
  const hydratedIdRef = useRef<string | null>(null);

  // Boot sessions: load IDB, ensure there is at least one active session.
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!sessionsLoaded) return;
    if (!activeId) {
      // Will trigger the hydrate effect below on the next tick.
      newSession();
    }
  }, [sessionsLoaded, activeId, newSession]);

  // Core fetch logic — extracted so both submit() and auto-resubmit can call it.
  const doFetchStoryboard = useCallback(async (script: string, historyMessages: UiMessage[]) => {
    if (!settings.chatModel) {
      toast.warning(t.toastNoChatModel);
      return;
    }
    const m = settings.videoModel ?? "";
    const durations: number[] = m.includes("lite") ? [5, 6, 8] : m.includes("veo-3.0") ? [8] : [4, 6, 8];
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.chatModel,
          script,
          durationSec: settings.durationSec,
          allowedDurations: durations,
          aspectRatio: settings.aspectRatio,
          withSubtitle: settings.withSubtitle,
          language: settings.language,
          history: historyMessages.map((h) => ({ role: h.role, content: h.content })),
          referenceImages: refImages.map((r) => ({
            name: r.name,
            mimeType: r.mimeType,
            bytesBase64Encoded: r.bytesBase64Encoded,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.danger(t.toastSplitFailed, { description: d.error });
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: `❌ ${d.error}` },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t.chatGenSuccess(d.storyboard.shots.length),
          storyboard: d.storyboard as Storyboard,
        },
      ]);
    } catch (e) {
      toast.danger(t.toastNetworkError, { description: String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [settings.chatModel, settings.videoModel, settings.durationSec, settings.aspectRatio, settings.withSubtitle, settings.language, refImages, t]);

  // Hydrate UI when the active session id flips (e.g. user picks from sidebar).
  useEffect(() => {
    if (!activeId || hydratedIdRef.current === activeId) return;
    const rec = sessionsList.find((s) => s.id === activeId);
    if (!rec) return;
    hydratedIdRef.current = activeId;
    const hydratedMessages = rec.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      storyboard: m.storyboard,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(hydratedMessages);
    setRefImages(rec.refImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, sessionsList]);

  // Persist edits back to IDB. Debounced via a microtask-batched effect.
  useEffect(() => {
    if (!activeId || hydratedIdRef.current !== activeId) return;
    const handle = window.setTimeout(() => {
      void saveActive({
        title: deriveSessionTitle(messages, t.newSessionTitle),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          storyboard: m.storyboard,
        })),
        refImages,
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [messages, refImages, activeId, saveActive, t.newSessionTitle]);

  // Restore persisted settings after hydration (client-only).
  useEffect(() => {
    const loaded = loadUiSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const refreshModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        toast.danger(t.toastNoModels);
        return;
      }
      const d = (await res.json()) as Models;
      setModels(d);
      setSettings((s) => ({
        ...s,
        chatModel: s.chatModel ?? pickPreferred(d.chat, [
          "models/gemini-3.1-pro-preview",
          "models/gemini-3-pro-preview",
          "models/gemini-2.5-pro",
        ]) ?? d.chat[0]?.name,
        videoModel: s.videoModel ?? pickPreferred(d.video, [
          "models/veo-3.1-fast-generate-preview",
          "models/veo-3.1-generate-preview",
          "models/veo-3.0-fast-generate-001",
        ]) ?? d.video[0]?.name,
        imageModel: s.imageModel ?? pickPreferred(d.image, [
          "models/gemini-3.1-flash-image-preview",
          "models/gemini-3-pro-image-preview",
        ]) ?? d.image.find((x) => /(image-preview|nano-banana)/.test(x.name))?.name,
      }));
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshModels();
  }, [refreshModels]);

  const allowedDurations = useMemo<(4 | 5 | 6 | 8)[]>(() => {
    const m = settings.videoModel ?? "";
    if (m.includes("lite")) return [5, 6, 8];
    if (m.includes("veo-3.0")) return [8];
    return [4, 6, 8];
  }, [settings.videoModel]);

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const remaining = MAX_REFERENCE_IMAGES - refImages.length;
      if (remaining <= 0) {
        toast.warning(t.toastMaxRefImages(MAX_REFERENCE_IMAGES));
        return;
      }
      const toAdd = Array.from(files).slice(0, remaining);
      const out: ReferenceImage[] = [];
      for (const f of toAdd) {
        try {
          const c = await compressImage(f);
          out.push({ id: crypto.randomUUID(), name: f.name, ...c });
        } catch {
          toast.danger(`${t.toastCompressFailed} ${f.name}`);
        }
      }
      setRefImages((prev) => [...prev, ...out]);
    },
    [refImages.length, t]
  );

  const removeRefImage = (id: string) =>
    setRefImages((prev) => prev.filter((r) => r.id !== id));

  const submit = async () => {
    const script = input.trim();
    if (!script) return;
    if (!settings.chatModel) {
      toast.warning(t.toastNoChatModel);
      return;
    }
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: script };
    const historyForApi = [...messages];
    setMessages((m) => [...m, userMsg]);
    setInput("");
    // Flush user message to IDB immediately so it survives a page refresh mid-generation.
    await saveActive({
      title: deriveSessionTitle([...messages, userMsg], t.newSessionTitle),
      messages: [...messages, userMsg].map((m) => ({ id: m.id, role: m.role, content: m.content, storyboard: m.storyboard })),
      refImages,
    });
    await doFetchStoryboard(script, historyForApi);
  };

  const startGeneration = (sb: Storyboard) => {
    if (!settings.videoModel) {
      toast.warning(t.toastNoVideoModel);
      return;
    }
    void startJobs(sb.shots, {
      videoModel: settings.videoModel,
      imageModel: settings.withReferenceFrames ? settings.imageModel : undefined,
      aspectRatio: settings.aspectRatio,
      durationSec: settings.durationSec,
      withReferenceFrames: settings.withReferenceFrames,
      chainFrames: settings.chainFrames,
      concurrency: settings.chainFrames ? 1 : settings.concurrency,
      detectedStyle: sb.detectedStyle,
      sessionId: activeId ?? "",
      referenceImages: refImages,
    });
  };

  const setSelected = <K extends keyof UiSettings>(key: K) =>
    (k: Key | Key[] | null) => {
      if (k == null || Array.isArray(k)) return;
      setSettings((s) => ({ ...s, [key]: k as UiSettings[K] }));
    };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[320px_1fr]">
      {/* 左：参数面板 */}
      <Card className="h-fit lg:sticky lg:top-20">
        <Card.Content className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t.paramsTitle}</h2>
            <Button size="sm" variant="ghost" onPress={refreshModels} isDisabled={loadingModels}>
              {loadingModels ? <Spinner size="sm" /> : t.paramsRefreshModels}
            </Button>
          </div>

          <Select
            value={settings.chatModel ?? null}
            onChange={setSelected("chatModel")}
            placeholder={t.paramsChatModelPlaceholder}
          >
            <Label>{t.paramsChatModel}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(models?.chat ?? []).map((m) => (
                  <ListBox.Item key={m.name} id={m.name} textValue={m.displayName ?? m.name}>
                    {m.displayName ?? m.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            value={settings.videoModel ?? null}
            onChange={setSelected("videoModel")}
            placeholder={t.paramsVideoModelPlaceholder}
          >
            <Label>{t.paramsVideoModel}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(models?.video ?? []).map((m) => (
                  <ListBox.Item key={m.name} id={m.name} textValue={m.displayName ?? m.name}>
                    {m.displayName ?? m.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            value={settings.imageModel ?? null}
            onChange={setSelected("imageModel")}
            placeholder={t.paramsImageModelPlaceholder}
          >
            <Label>{t.paramsImageModel}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(models?.image ?? []).map((m) => (
                  <ListBox.Item key={m.name} id={m.name} textValue={m.displayName ?? m.name}>
                    {m.displayName ?? m.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            value={settings.aspectRatio}
            onChange={(k) =>
              k && !Array.isArray(k) && setSettings((s) => ({ ...s, aspectRatio: k as "16:9" | "9:16" }))
            }
          >
            <Label>{t.paramsAspectRatio}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="16:9" textValue={t.paramsLandscape}>
                  {t.paramsLandscape}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="9:16" textValue={t.paramsPortrait}>
                  {t.paramsPortrait}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            value={String(settings.durationSec)}
            onChange={(k) =>
              k && !Array.isArray(k) && setSettings((s) => ({ ...s, durationSec: Number(k) as 4 | 5 | 6 | 8 }))
            }
          >
            <Label>{t.paramsDuration}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {allowedDurations.map((d) => (
                  <ListBox.Item key={d} id={String(d)} textValue={`${d} ${t.paramsDurationSec}`}>
                    {d} {t.paramsDurationSec}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            value={settings.language}
            onChange={(k) => k && !Array.isArray(k) && setSettings((s) => ({ ...s, language: String(k) }))}
          >
            <Label>{t.paramsSubtitleLang}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {([
                  { id: "zh-CN", label: "中文简体" },
                  { id: "zh-TW", label: "中文繁體" },
                  { id: "en-US", label: "English" },
                  { id: "ja", label: "日本語" },
                  { id: "ko", label: "한국어" },
                  { id: "fr", label: "Français" },
                  { id: "de", label: "Deutsch" },
                  { id: "es", label: "Español" },
                ] as const).map((l) => (
                  <ListBox.Item key={l.id} id={l.id} textValue={l.label}>
                    {l.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Switch
            isSelected={settings.withSubtitle}
            onChange={(v) => setSettings((s) => ({ ...s, withSubtitle: v }))}
            className="flex w-full items-center justify-between"
          >
            <Switch.Content>
              <Label className="text-sm font-normal">{t.paramsSubtitle}</Label>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <Switch
            isSelected={settings.withReferenceFrames}
            onChange={(v) => setSettings((s) => ({ ...s, withReferenceFrames: v }))}
            className="flex w-full items-center justify-between"
          >
            <Switch.Content>
              <Label className="text-sm font-normal">{t.paramsRefFrames}</Label>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <Switch
            isSelected={settings.chainFrames}
            onChange={(v) => setSettings((s) => ({ ...s, chainFrames: v }))}
            className="flex w-full items-center justify-between"
          >
            <Switch.Content>
              <Label className="text-sm font-normal">{t.paramsChainFrames}</Label>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <Switch
            isSelected={settings.autoContinue}
            onChange={(v) => setSettings((s) => ({ ...s, autoContinue: v }))}
            className="flex w-full items-center justify-between"
          >
            <Switch.Content>
              <Label className="text-sm font-normal">{t.paramsAutoContinue}</Label>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </Card.Content>
      </Card>

      {/* right: chat area */}
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SessionsPanel />
            {(() => {
              const rec = sessionsList.find((s) => s.id === activeId);
              if (!rec) return null;
              return (
                <span className="hidden text-xs text-default-400 sm:block">
                  {rec.title}
                  <span className="ml-2 opacity-60">
                    {new Date(rec.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              );
            })()}
          </div>
          <JobsPanel activeSessionId={activeId} />
        </div>
        <Card className="flex-1 overflow-hidden">
          <Card.Content className="flex h-full flex-col gap-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="m-auto max-w-md text-center text-default-500">
                {t.chatEmpty}
              </div>
            )}
            {messages.map((m, i) => {
              const isLastUnanswered =
                i === messages.length - 1 &&
                m.role === "user" &&
                !submitting;
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  refCount={refImages.length}
                  onStart={startGeneration}
                  isLastUnanswered={isLastUnanswered}
                  onRetry={() => {
                    void doFetchStoryboard(m.content, messages.slice(0, i));
                  }}
                />
              );
            })}
            {submitting && (
              <Card className="flex flex-row gap-2 text-sm text-default-500" variant="secondary">
                <Spinner size="sm" /> {t.chatSplitting}
              </Card>
            )}
          </Card.Content>
        </Card>

        {refImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {refImages.map((r, i) => (
              <div key={r.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${r.mimeType};base64,${r.bytesBase64Encoded}`}
                  alt={r.name}
                  className="h-16 w-16 rounded-md border border-default-200 object-cover"
                />
                <span className="absolute -left-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRefImage(r.id)}
                  className="absolute -right-1 -top-1 rounded-full bg-default-900/80 px-1.5 text-[10px] text-white bg-danger/50 hover:bg-danger/80"
                  aria-label="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onPickFiles(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          <Button
            variant="outline"
            onPress={() => fileInputRef.current?.click()}
            isDisabled={refImages.length >= MAX_REFERENCE_IMAGES}
          >
            {t.chatUpload} {refImages.length}/{MAX_REFERENCE_IMAGES}
          </Button>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={t.chatPlaceholder}
            rows={6}
            className="flex-1"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <Button variant="primary" onPress={submit} isDisabled={submitting || !input.trim()}>
            {submitting ? <Spinner size="sm" color="current" /> : t.chatSubmit}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  refCount,
  onStart,
  isLastUnanswered,
  onRetry,
}: {
  msg: UiMessage;
  refCount: number;
  onStart: (sb: Storyboard) => void;
  isLastUnanswered?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const copy = () => {
    void navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (msg.role === "user") {
    return (
      <div className="ml-auto max-w-[80%]">
        <button type="button" onClick={copy} className="group w-full text-left">
          <Card variant="secondary">
            <Card.Content className="relative">
              <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              <Chip className="absolute right-3 top-2 bg-accent opacity-0 transition-opacity group-hover:opacity-100">
                {copied ? t.chatCopied : t.chatClickCopy}
              </Chip>
            </Card.Content>
          </Card>
        </button>
        {isLastUnanswered && (
          <div className="mt-1 flex items-center justify-end gap-2">
            <span className="text-xs text-warning">{t.chatInterrupted}</span>
            <Button size="sm" variant="outline" onPress={onRetry}>
              {t.chatRetry}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mr-auto w-full max-w-full space-y-2">
      <Card variant="secondary">
        <Card.Content className="text-sm">{msg.content}</Card.Content>
      </Card>
      {msg.storyboard && (
        <StoryboardView sb={msg.storyboard} refCount={refCount} onStart={onStart} />
      )}
    </div>
  );
}

function StoryboardView({
  sb,
  refCount,
  onStart,
}: {
  sb: Storyboard;
  refCount: number;
  onStart: (sb: Storyboard) => void;
}) {
  const { t } = useI18n();
  return (
    <Card variant="secondary" className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip variant="soft" color="accent">
          {t.sbStyle}{sb.detectedStyle}
        </Chip>
        <Chip variant="soft">{t.sbLanguage}{sb.language}</Chip>
        <Chip variant="soft">{t.sbTotalDuration}{sb.totalDurationSec}s</Chip>
        <Chip variant="soft">{t.sbShots}{sb.shots.length}</Chip>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sb.shots.map((s) => (
          <Card key={s.index} className="w-full">
            <Card.Content className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">#{s.index}</span>
                  <Chip size="sm" variant="soft">{s.durationSec}s</Chip>
                  {s.referenceImageIndex && s.referenceImageIndex > 0 && refCount > 0 && (
                    <Chip size="sm" color="accent" variant="soft">
                      {t.sbRefImage}{s.referenceImageIndex}
                    </Chip>
                  )}
                </div>
              </div>
              <div className="text-default-700">{s.summary}</div>
              <div className="grid grid-cols-1 gap-2 text-xs text-default-600 sm:grid-cols-2">
                <div><span className="text-default-500">{t.sbCamera}</span>{s.camera}</div>
                <div><span className="text-default-500">{t.sbComposition}</span>{s.composition}</div>
                <div className="sm:col-span-2">
                  <span className="text-default-500">{t.sbAmbiance}</span>{s.ambiance}
                </div>
              </div>
              {s.dialogue.length > 0 && (
                <div className="text-xs">
                  <div className="text-default-500">{t.sbDialogue}</div>
                  {s.dialogue.map((d, i) => (
                    <div key={i}>
                      <b>{d.speaker}:</b> {d.line}
                    </div>
                  ))}
                </div>
              )}
              {s.subtitle && (
                <div className="text-xs">
                  <span className="text-default-500">{t.sbSubtitle}</span>{s.subtitle}
                </div>
              )}
              {s.continuityHint && (
                <div className="text-xs text-default-500">{t.sbContinuity}{s.continuityHint}</div>
              )}
              <details>
                <summary className="cursor-pointer text-xs text-default-500">{t.sbVeoPrompt}</summary>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-default-600">
                  {s.veoPrompt}
                </pre>
              </details>
            </Card.Content>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onPress={() => onStart(sb)}>
          {t.sbGenerate}
        </Button>
      </div>
    </Card>
  );
}

