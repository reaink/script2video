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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.configured) setConfigured({ apiKeyMasked: d.apiKeyMasked });
      });
  }, []);

  const save = async () => {
    if (!apiKey.trim()) {
      toast.warning(t.settingsToastEmptyKey);
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
        toast.danger(t.settingsToastSaveFailed, { description: d.error });
        return;
      }
      toast.success(t.settingsToastSaved);
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
        toast.danger(t.settingsToastFetchFailed, { description: d.error });
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
    toast(t.settingsToastCleared);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t.settingsTitle}</h1>

      <Tabs aria-label="settings" defaultSelectedKey="provider">
        <Tabs.List>
          <Tabs.Tab id="provider">{t.settingsTabProvider}</Tabs.Tab>
          <Tabs.Tab id="about">{t.settingsTabAbout}</Tabs.Tab>
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
                      {t.settingsApiKeySaved}{configured.apiKeyMasked}
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={configured ? t.settingsApiKeyPlaceholderNew : t.settingsApiKeyPlaceholderEmpty}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" onPress={() => setShowKey((v) => !v)}>
                    {showKey ? t.settingsHide : t.settingsShow}
                  </Button>
                </div>
                <p className="text-xs text-default-500">
                  {t.settingsApiKeyHint.split("aistudio.google.com/apikey")[0]}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                  {t.settingsApiKeyHint.split("aistudio.google.com/apikey")[1]}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onPress={save} isDisabled={saving}>
                  {saving ? <Spinner size="sm" color="current" /> : t.settingsSave}
                </Button>
                <Button
                  variant="ghost"
                  onPress={loadModels}
                  isDisabled={!configured || loadingModels}
                >
                  {loadingModels ? <Spinner size="sm" /> : t.settingsFetchModels}
                </Button>
                {configured && (
                  <Button variant="danger" onPress={clear}>
                    {t.settingsClear}
                  </Button>
                )}
              </div>

              {models && (
                <div className="mt-2 space-y-3 rounded-lg bg-default-100 p-4 text-sm">
                  <ModelGroup title={t.settingsModelsChatTitle} items={models.chat} />
                  <ModelGroup title={t.settingsModelsVideoTitle} items={models.video} />
                  <ModelGroup title={t.settingsModelsImageTitle} items={models.image} />
                </div>
              )}
            </Card.Content>
          </Card>
        </Tabs.Panel>
        <Tabs.Panel id="about">
          <Card className="mt-4">
            <Card.Content className="space-y-2 p-6 text-sm text-default-600">
              <p>{t.settingsAboutLine1}</p>
              <p>{t.settingsAboutLine2}</p>
              <p>{t.settingsAboutLine3}</p>
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
