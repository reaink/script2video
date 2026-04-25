"use client";

import { Button, Card, Input, Label, Spinner, Tabs, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { Provider } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface ProviderStatus {
  configured: boolean;
  apiKeyMasked?: string;
}

interface SettingsData {
  providers: Partial<Record<Provider, ProviderStatus>>;
}

interface ProviderMeta {
  id: Provider;
  label: string;
  description: string;
  link: string;
  linkLabel: string;
  placeholder: string;
}

const PROVIDER_META: ProviderMeta[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Chat + image generation + Veo video generation",
    link: "https://aistudio.google.com/apikey",
    linkLabel: "aistudio.google.com/apikey",
    placeholder: "AIzaSy...",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Chat models: GPT-4.1, GPT-4o, o3, o4-mini",
    link: "https://platform.openai.com/api-keys",
    linkLabel: "platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Chat models: Claude Opus/Sonnet/Haiku 4.5",
    link: "https://console.anthropic.com/settings/keys",
    linkLabel: "console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  {
    id: "runway",
    label: "Runway",
    description: "Video generation: Gen-4.5, Gen-4 Turbo",
    link: "https://app.runwayml.com/settings",
    linkLabel: "app.runwayml.com/settings",
    placeholder: "key_...",
  },
  {
    id: "minimax",
    label: "MiniMax (Hailuo)",
    description: "Video generation: Hailuo 2.3, Hailuo 02",
    link: "https://platform.minimax.io/user-center/basic-information/interface-key",
    linkLabel: "platform.minimax.io",
    placeholder: "eyJ...",
  },
  {
    id: "luma",
    label: "Luma AI (Ray)",
    description: "Video generation: Ray 2, Ray 2 Flash",
    link: "https://lumalabs.ai/dream-machine/api/keys",
    linkLabel: "lumalabs.ai/dream-machine/api/keys",
    placeholder: "luma-...",
  },
];

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<Partial<Record<Provider, ProviderStatus>>>({});
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({});
  const [show, setShow] = useState<Partial<Record<Provider, boolean>>>({});
  const [saving, setSaving] = useState<Partial<Record<Provider, boolean>>>({});
  const [clearing, setClearing] = useState<Partial<Record<Provider, boolean>>>({});
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsData | { providers?: Partial<Record<Provider, ProviderStatus>> }) => {
        setStatuses(d.providers ?? {});
      });
  }, []);

  const save = async (provider: Provider) => {
    const key = keys[provider]?.trim();
    if (!key) {
      toast.warning(t.settingsToastEmptyKey);
      return;
    }
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.danger(t.settingsToastSaveFailed, { description: d.error });
        return;
      }
      toast.success(`${t.settingsToastSaved}: ${PROVIDER_META.find((p) => p.id === provider)?.label}`);
      setKeys((k) => ({ ...k, [provider]: "" }));
      setStatuses((s) => ({ ...s, [provider]: { configured: true, apiKeyMasked: d.providers?.[provider]?.apiKeyMasked } }));
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  };

  const clear = async (provider: Provider) => {
    setClearing((s) => ({ ...s, [provider]: true }));
    try {
      await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      setStatuses((s) => ({ ...s, [provider]: { configured: false } }));
      toast(t.settingsToastCleared);
    } finally {
      setClearing((s) => ({ ...s, [provider]: false }));
    }
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
          <div className="mt-4 flex flex-col gap-4">
            {PROVIDER_META.map((meta) => {
              const status = statuses[meta.id];
              const keyVal = keys[meta.id] ?? "";
              const isSaving = saving[meta.id];
              const isClearing = clearing[meta.id];
              return (
                <Card key={meta.id}>
                  <Card.Content className="flex flex-col gap-4 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          {meta.label}
                          {status?.configured && (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                              ✓ Configured
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-default-500">{meta.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-medium">
                        API Key
                        {status?.apiKeyMasked && (
                          <span className="ml-2 text-xs text-default-400">
                            {t.settingsApiKeySaved} {status.apiKeyMasked}
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type={show[meta.id] ? "text" : "password"}
                          placeholder={status?.configured ? t.settingsApiKeyPlaceholderNew : meta.placeholder}
                          value={keyVal}
                          onChange={(e) => setKeys((k) => ({ ...k, [meta.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && save(meta.id)}
                          className="flex-1"
                        />
                        <Button variant="ghost" onPress={() => setShow((s) => ({ ...s, [meta.id]: !s[meta.id] }))}>
                          {show[meta.id] ? t.settingsHide : t.settingsShow}
                        </Button>
                      </div>
                      <p className="text-xs text-default-400">
                        Get it at:{" "}
                        <a href={meta.link} target="_blank" rel="noreferrer" className="text-primary underline">
                          {meta.linkLabel}
                        </a>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onPress={() => save(meta.id)} isDisabled={!!isSaving}>
                        {isSaving ? <Spinner size="sm" color="current" /> : t.settingsSave}
                      </Button>
                      {status?.configured && (
                        <Button variant="danger" size="sm" onPress={() => clear(meta.id)} isDisabled={!!isClearing}>
                          {isClearing ? <Spinner size="sm" color="current" /> : t.settingsClear}
                        </Button>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="about">
          <Card className="mt-4">
            <Card.Content className="space-y-2 p-6 text-sm text-default-600">
              <p>Script2Video — Split scripts into shots with any supported chat model, generate videos with Veo, Runway, MiniMax, or Luma.</p>
              <p>{t.settingsAboutLine2}</p>
              <p>{t.settingsAboutLine3}</p>
              <p>Keys are AES-256-GCM encrypted and stored in an HttpOnly cookie, not in browser storage.</p>
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
