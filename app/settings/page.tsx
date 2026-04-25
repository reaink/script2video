"use client";

import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Tabs,
  toast,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { GeminiModel } from "@/lib/types";

export default function SettingsPage() {
  const [provider, setProvider] = useState<"gemini">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<{
    chat: GeminiModel[];
    video: GeminiModel[];
    image: GeminiModel[];
  } | null>(null);
  const [configured, setConfigured] = useState<{ apiKeyMasked?: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.configured) setConfigured({ apiKeyMasked: d.apiKeyMasked });
      });
  }, []);

  const save = async () => {
    if (!apiKey.trim()) {
      toast.warning("请填写 API Key");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.danger("保存失败", { description: d.error });
        return;
      }
      toast.success("已保存");
      setApiKey("");
      setConfigured({ apiKeyMasked: "****" });
      void loadModels();
    } finally {
      setSaving(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models");
      const d = await res.json();
      if (!res.ok) {
        toast.danger("拉取模型失败", { description: d.error });
        return;
      }
      setModels(d);
    } finally {
      setLoadingModels(false);
    }
  };

  const clear = async () => {
    await fetch("/api/settings", { method: "DELETE" });
    setConfigured(null);
    setModels(null);
    toast("已清除");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">设置</h1>

      <Tabs aria-label="settings" defaultSelectedKey="provider">
        <Tabs.List>
          <Tabs.Tab id="provider">Provider</Tabs.Tab>
          <Tabs.Tab id="about">关于</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="provider">
          <Card className="mt-4">
            <Card.Content className="flex flex-col gap-5 p-6">
              <Select
                className="w-65"
                value={provider}
                onChange={(k) => k && !Array.isArray(k) && setProvider(k as "gemini")}
              >
                <Label>Provider</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="gemini" textValue="Google Gemini">
                      Google Gemini
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  API Key
                  {configured?.apiKeyMasked && (
                    <span className="ml-2 text-xs text-default-500">
                      已保存：{configured.apiKeyMasked}
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={configured ? "输入新 key 以替换" : "粘贴你的 Gemini API Key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" onPress={() => setShowKey((v) => !v)}>
                    {showKey ? "隐藏" : "显示"}
                  </Button>
                </div>
                <p className="text-xs text-default-500">
                  获取地址：
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                  。Key 通过 AES-256-GCM 加密后写入 HttpOnly cookie，不落浏览器存储。
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onPress={save} isDisabled={saving}>
                  {saving ? <Spinner size="sm" color="current" /> : "保存并验证"}
                </Button>
                <Button
                  variant="ghost"
                  onPress={loadModels}
                  isDisabled={!configured || loadingModels}
                >
                  {loadingModels ? <Spinner size="sm" /> : "拉取模型列表"}
                </Button>
                {configured && (
                  <Button variant="danger" onPress={clear}>
                    清除
                  </Button>
                )}
              </div>

              {models && (
                <div className="mt-2 space-y-3 rounded-lg bg-default-100 p-4 text-sm">
                  <ModelGroup title="对话模型" items={models.chat} />
                  <ModelGroup title="视频模型" items={models.video} />
                  <ModelGroup title="图像模型" items={models.image} />
                </div>
              )}
            </Card.Content>
          </Card>
        </Tabs.Panel>
        <Tabs.Panel id="about">
          <Card className="mt-4">
            <Card.Content className="space-y-2 p-6 text-sm text-default-600">
              <p>Script2Video — 用 Gemini 拆分镜，用 Veo 生成视频。</p>
              <p>分镜衔接：可选启用 Nano Banana 生成首尾参考帧。</p>
              <p>字幕：软字幕（WebVTT），不烧录到视频中。</p>
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function ModelGroup({ title, items }: { title: string; items: GeminiModel[] }) {
  return (
    <div>
      <div className="font-medium">
        {title} ({items.length})
      </div>
      <ul className="mt-1 max-h-32 overflow-auto text-default-600">
        {items.map((m) => (
          <li key={m.name}>{m.displayName ?? m.name}</li>
        ))}
      </ul>
    </div>
  );
}
