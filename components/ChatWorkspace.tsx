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
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import type { GeminiModel, Storyboard } from "@/lib/types";

type Models = { chat: GeminiModel[]; video: GeminiModel[]; image: GeminiModel[] };

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
  aspectRatio: "16:9" | "9:16";
  durationSec: 4 | 5 | 6 | 8;
  withSubtitle: boolean;
  withReferenceFrames: boolean;
  concurrency: number;
  autoContinue: boolean;
  language: string;
}
const DEFAULT_SETTINGS: UiSettings = {
  aspectRatio: "16:9",
  durationSec: 8,
  withSubtitle: false,
  withReferenceFrames: true,
  concurrency: 1,
  autoContinue: true,
  language: "zh-CN",
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

export function ChatWorkspace() {
  const [models, setModels] = useState<Models | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSettings(loadUiSettings());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        toast.danger("无法拉取模型，请检查 Key");
        return;
      }
      const d = (await res.json()) as Models;
      setModels(d);
      setSettings((s) => ({
        ...s,
        chatModel: s.chatModel ?? d.chat[0]?.name,
        videoModel: s.videoModel ?? d.video[0]?.name,
      }));
    } finally {
      setLoadingModels(false);
    }
  };

  const allowedDurations = useMemo<(4 | 5 | 6 | 8)[]>(() => {
    const m = settings.videoModel ?? "";
    if (m.includes("lite")) return [5, 6, 8];
    if (m.includes("veo-3.0")) return [8];
    return [4, 6, 8];
  }, [settings.videoModel]);

  const submit = async () => {
    const script = input.trim();
    if (!script) return;
    if (!settings.chatModel) {
      toast.warning("请先选择对话模型");
      return;
    }
    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: script,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.chatModel,
          script,
          durationSec: settings.durationSec,
          aspectRatio: settings.aspectRatio,
          withSubtitle: settings.withSubtitle,
          language: settings.language,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.danger("拆分失败", { description: d.error });
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: `❌ ${d.error}` },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `已拆分 ${d.storyboard.shots.length} 个分镜`,
          storyboard: d.storyboard as Storyboard,
        },
      ]);
    } catch (e) {
      toast.danger("网络错误", { description: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const setSelected = <K extends keyof UiSettings>(key: K) =>
    (k: Key | null) => {
      if (k == null) return;
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
            selectedKey={settings.chatModel ?? null}
            onSelectionChange={setSelected("chatModel")}
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
            selectedKey={settings.videoModel ?? null}
            onSelectionChange={setSelected("videoModel")}
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
            selectedKey={settings.aspectRatio}
            onSelectionChange={(k) =>
              k && setSettings((s) => ({ ...s, aspectRatio: k as "16:9" | "9:16" }))
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
            selectedKey={String(settings.durationSec)}
            onSelectionChange={(k) =>
              k && setSettings((s) => ({ ...s, durationSec: Number(k) as 4 | 5 | 6 | 8 }))
            }
          >
            <Label>单镜头时长</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {allowedDurations.map((d) => (
                  <ListBox.Item key={d} id={String(d)} textValue={`${d} 秒`}>
                    {d} 秒
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <div className="flex items-center justify-between">
            <span className="text-sm">字幕（软字幕 WebVTT）</span>
            <Switch
              isSelected={settings.withSubtitle}
              onChange={(v) => setSettings((s) => ({ ...s, withSubtitle: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">分镜首尾帧衔接 (Nano Banana)</span>
            <Switch
              isSelected={settings.withReferenceFrames}
              onChange={(v) => setSettings((s) => ({ ...s, withReferenceFrames: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">完成后自动继续</span>
            <Switch
              isSelected={settings.autoContinue}
              onChange={(v) => setSettings((s) => ({ ...s, autoContinue: v }))}
            />
          </div>
        </Card.Content>
      </Card>

      {/* 右：聊天区 */}
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
        <Card className="flex-1 overflow-hidden">
          <Card.Content className="flex h-full flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="m-auto max-w-md text-center text-default-500">
                输入你的脚本，AI 会按所选视频模型时长拆分分镜，并生成可直接喂给 Veo 的英文 prompt。
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {submitting && (
              <div className="flex items-center gap-2 text-sm text-default-500">
                <Spinner size="sm" /> 模型正在拆分镜...
              </div>
            )}
          </Card.Content>
        </Card>

        <div className="flex gap-2">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="粘贴或输入脚本，Ctrl+Enter 发送"
            rows={3}
            className="flex-1"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <Button variant="primary" onPress={submit} isDisabled={submitting || !input.trim()}>
            {submitting ? <Spinner size="sm" /> : "提交"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: UiMessage }) {
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
      {msg.storyboard && <StoryboardView sb={msg.storyboard} />}
    </div>
  );
}

function StoryboardView({ sb }: { sb: Storyboard }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip color="accent" variant="soft">
          风格：{sb.detectedStyle}
        </Chip>
        <Chip variant="soft">语言：{sb.language}</Chip>
        <Chip variant="soft">总时长：{sb.totalDurationSec}s</Chip>
        <Chip variant="soft">分镜数：{sb.shots.length}</Chip>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sb.shots.map((s) => (
          <Card key={s.index} className="w-72 shrink-0">
            <Card.Content className="space-y-2 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">#{s.index}</span>
                <Chip size="sm">{s.durationSec}s</Chip>
              </div>
              <div className="text-default-700">{s.summary}</div>
              <details>
                <summary className="cursor-pointer text-default-500">Veo Prompt</summary>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-default-600">
                  {s.veoPrompt}
                </pre>
              </details>
              {s.dialogue.length > 0 && (
                <div>
                  <div className="text-default-500">对话</div>
                  {s.dialogue.map((d, i) => (
                    <div key={i}>
                      <b>{d.speaker}:</b> {d.line}
                    </div>
                  ))}
                </div>
              )}
              {s.subtitle && (
                <div>
                  <div className="text-default-500">字幕</div>
                  <div>{s.subtitle}</div>
                </div>
              )}
              {s.continuityHint && (
                <div className="text-default-500">衔接：{s.continuityHint}</div>
              )}
            </Card.Content>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" isDisabled>
          确认并生成视频（待实现）
        </Button>
        <Button variant="ghost" size="sm" isDisabled>
          重新拆分
        </Button>
      </div>
    </div>
  );
}
