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

function deriveSessionTitle(messages: UiMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新会话";
  const t = first.content.trim().split(/\s+/).slice(0, 6).join(" ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || "新会话";
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

  const sessionsLoaded = useSessionsStore((s) => s.loaded);
  const sessionsList = useSessionsStore((s) => s.sessions);
  const activeId = useSessionsStore((s) => s.activeId);
  const loadSessions = useSessionsStore((s) => s.load);
  const newSession = useSessionsStore((s) => s.newSession);
  const saveActive = useSessionsStore((s) => s.saveActive);
  /** Tracks the id we last hydrated from to avoid clobbering pending edits. */
  const hydratedIdRef = useRef<string | null>(null);
  /** Pending resubmit stored when models aren't loaded yet at hydration time. */
  const pendingResubmitRef = useRef<{ script: string; history: UiMessage[] } | null>(null);

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
      toast.warning("\u8bf7\u5148\u9009\u62e9\u5bf9\u8bdd\u6a21\u578b");
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
        toast.danger("\u62c6\u5206\u5931\u8d25", { description: d.error });
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: `\u274c ${d.error}` },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `\u5df2\u62c6\u5206 ${d.storyboard.shots.length} \u4e2a\u5206\u955c`,
          storyboard: d.storyboard as Storyboard,
        },
      ]);
    } catch (e) {
      toast.danger("\u7f51\u7edc\u9519\u8bef", { description: String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [settings.chatModel, settings.videoModel, settings.durationSec, settings.aspectRatio, settings.withSubtitle, settings.language, refImages]);

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
    // Auto-resume: if the last message is an unanswered user message, the fetch
    // was interrupted (e.g. page refresh mid-generation). Re-submit it.
    const lastMsg = hydratedMessages[hydratedMessages.length - 1];
    if (lastMsg?.role === "user") {
      const pending = { script: lastMsg.content, history: hydratedMessages.slice(0, -1) };
      if (settings.chatModel) {
        void doFetchStoryboard(pending.script, pending.history);
      } else {
        pendingResubmitRef.current = pending;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, sessionsList]);

  // Fire pending resubmit once models are available (race: models load after hydration).
  useEffect(() => {
    if (!settings.chatModel || !pendingResubmitRef.current) return;
    const { script, history } = pendingResubmitRef.current;
    pendingResubmitRef.current = null;
    void doFetchStoryboard(script, history);
  }, [settings.chatModel, doFetchStoryboard]);

  // Persist edits back to IDB. Debounced via a microtask-batched effect.
  useEffect(() => {
    if (!activeId || hydratedIdRef.current !== activeId) return;
    const handle = window.setTimeout(() => {
      void saveActive({
        title: deriveSessionTitle(messages),
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
  }, [messages, refImages, activeId, saveActive]);

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
        toast.danger("\u65e0\u6cd5\u62c9\u53d6\u6a21\u578b\uff0c\u8bf7\u68c0\u67e5 Key");
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
        toast.warning(`\u6700\u591a\u4e0a\u4f20 ${MAX_REFERENCE_IMAGES} \u5f20\u53c2\u8003\u56fe`);
        return;
      }
      const toAdd = Array.from(files).slice(0, remaining);
      const out: ReferenceImage[] = [];
      for (const f of toAdd) {
        try {
          const c = await compressImage(f);
          out.push({ id: crypto.randomUUID(), name: f.name, ...c });
        } catch {
          toast.danger(`\u538b\u7f29\u5931\u8d25: ${f.name}`);
        }
      }
      setRefImages((prev) => [...prev, ...out]);
    },
    [refImages.length]
  );

  const removeRefImage = (id: string) =>
    setRefImages((prev) => prev.filter((r) => r.id !== id));

  const submit = async () => {
    const script = input.trim();
    if (!script) return;
    if (!settings.chatModel) {
      toast.warning("\u8bf7\u5148\u9009\u62e9\u5bf9\u8bdd\u6a21\u578b");
      return;
    }
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: script };
    const historyForApi = [...messages];
    setMessages((m) => [...m, userMsg]);
    setInput("");
    // Flush user message to IDB immediately so it survives a page refresh mid-generation.
    await saveActive({
      title: deriveSessionTitle([...messages, userMsg]),
      messages: [...messages, userMsg].map((m) => ({ id: m.id, role: m.role, content: m.content, storyboard: m.storyboard })),
      refImages,
    });
    await doFetchStoryboard(script, historyForApi);
  };

  const startGeneration = (sb: Storyboard) => {
    if (!settings.videoModel) {
      toast.warning("\u8bf7\u9009\u62e9\u89c6\u9891\u6a21\u578b");
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
        <Card.Content className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">参数</h2>
            <Button size="sm" variant="ghost" onPress={refreshModels} isDisabled={loadingModels}>
              {loadingModels ? <Spinner size="sm" /> : "刷新模型"}
            </Button>
          </div>

          <Select
            value={settings.chatModel ?? null}
            onChange={setSelected("chatModel")}
            placeholder="选择对话模型"
          >
            <Label>对话模型</Label>
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
            placeholder="选择视频模型"
          >
            <Label>视频模型 (Veo)</Label>
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
            placeholder="选择图像模型"
          >
            <Label>图像模型 (帧合成)</Label>
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
            <Label>画幅</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="16:9" textValue="横屏 16:9">
                  横屏 16:9
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="9:16" textValue="竖屏 9:16">
                  竖屏 9:16
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
            <Label>最大单镜头时长</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {allowedDurations.map((d) => (
                  <ListBox.Item key={d} id={String(d)} textValue={`${d} \u79d2`}>
                    {d} 秒
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
            <Label>字幕 / 对话语言</Label>
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
              <Label className="text-sm font-normal">字幕（软字幕 WebVTT）</Label>
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
              <Label className="text-sm font-normal">首帧合成 (Nano Banana)</Label>
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
              <Label className="text-sm font-normal">分镜衔接（串行抽尾帧）</Label>
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
              <Label className="text-sm font-normal">完成后自动继续</Label>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </Card.Content>
      </Card>

      {/* 右：聊天区 */}
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
        <div className="flex items-center justify-between">
          <SessionsPanel />
          <JobsPanel />
        </div>
        <Card className="flex-1 overflow-hidden">
          <Card.Content className="flex h-full flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="m-auto max-w-md text-center text-default-500">
                输入你的脚本，AI 会按所选视频模型时长拆分分镜，并生成可直接喂给 Veo 的英文 prompt。
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                refCount={refImages.length}
                onStart={startGeneration}
              />
            ))}
            {submitting && (
              <div className="flex items-center gap-2 text-sm text-default-500">
                <Spinner size="sm" /> 模型正在拆分镜...
              </div>
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
                  className="absolute -right-1 -top-1 rounded-full bg-default-900/80 px-1.5 text-[10px] text-white"
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
            上传参考 {refImages.length}/{MAX_REFERENCE_IMAGES}
          </Button>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="粘贴或输入脚本，Ctrl+Enter 发送"
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
            {submitting ? <Spinner size="sm" color="current" /> : "提交"}
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
}: {
  msg: UiMessage;
  refCount: number;
  onStart: (sb: Storyboard) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
      </div>
    );
  }
  return (
    <div className="mr-auto w-full max-w-full">
      <div className="mb-2 rounded-2xl bg-default-100 px-4 py-2 text-sm">{msg.content}</div>
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip variant="soft" color="accent">
          风格：{sb.detectedStyle}
        </Chip>
        <Chip variant="soft">语言：{sb.language}</Chip>
        <Chip variant="soft">总时长：{sb.totalDurationSec}s</Chip>
        <Chip variant="soft">分镜数：{sb.shots.length}</Chip>
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
                      参考图 #{s.referenceImageIndex}
                    </Chip>
                  )}
                </div>
              </div>
              <div className="text-default-700">{s.summary}</div>
              <div className="grid grid-cols-1 gap-2 text-xs text-default-600 sm:grid-cols-2">
                <div><span className="text-default-500">镜头：</span>{s.camera}</div>
                <div><span className="text-default-500">构图：</span>{s.composition}</div>
                <div className="sm:col-span-2">
                  <span className="text-default-500">氛围：</span>{s.ambiance}
                </div>
              </div>
              {s.dialogue.length > 0 && (
                <div className="text-xs">
                  <div className="text-default-500">对话</div>
                  {s.dialogue.map((d, i) => (
                    <div key={i}>
                      <b>{d.speaker}:</b> {d.line}
                    </div>
                  ))}
                </div>
              )}
              {s.subtitle && (
                <div className="text-xs">
                  <span className="text-default-500">字幕：</span>{s.subtitle}
                </div>
              )}
              {s.continuityHint && (
                <div className="text-xs text-default-500">衡接：{s.continuityHint}</div>
              )}
              <details>
                <summary className="cursor-pointer text-xs text-default-500">Veo Prompt</summary>
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
          确认并生成视频
        </Button>
      </div>
    </div>
  );
}

