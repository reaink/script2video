import { NextResponse } from "next/server";
import { clearSession, readSession, writeSession } from "@/lib/server/session";
import { listModels } from "@/lib/providers/gemini";
import { validateApiKey as validateOpenAI } from "@/lib/providers/openai";
import { validateApiKey as validateAnthropic } from "@/lib/providers/anthropic";
import { validateApiKey as validateRunway } from "@/lib/providers/runway";
import { validateApiKey as validateMiniMax } from "@/lib/providers/minimax";
import { validateApiKey as validateLuma } from "@/lib/providers/luma";
import type { Provider } from "@/lib/types";

async function validateProvider(provider: Provider, apiKey: string): Promise<void> {
  switch (provider) {
    case "gemini":
      await listModels(apiKey);
      break;
    case "openai":
      await validateOpenAI(apiKey);
      break;
    case "anthropic":
      await validateAnthropic(apiKey);
      break;
    case "runway":
      await validateRunway(apiKey);
      break;
    case "minimax":
      await validateMiniMax(apiKey);
      break;
    case "luma":
      await validateLuma(apiKey);
      break;
    default:
      throw new Error(`Unknown provider: ${provider as string}`);
  }
}

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ configured: false, providers: {} });
  const providers: Record<string, { configured: boolean; apiKeyMasked: string }> = {};
  for (const [p, k] of Object.entries(s.apiKeys)) {
    if (k) {
      providers[p] = {
        configured: true,
        apiKeyMasked: k.slice(0, 4) + "..." + k.slice(-4),
      };
    }
  }
  return NextResponse.json({ configured: Object.keys(providers).length > 0, providers });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { provider?: string; apiKey?: string };
  const validProviders: Provider[] = ["gemini", "openai", "anthropic", "runway", "minimax", "luma"];
  if (!body.provider || !validProviders.includes(body.provider as Provider) || !body.apiKey) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const provider = body.provider as Provider;
  try {
    await validateProvider(provider, body.apiKey);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 401 });
  }
  // Merge into existing session
  const existing = (await readSession()) ?? { apiKeys: {} };
  await writeSession({ apiKeys: { ...existing.apiKeys, [provider]: body.apiKey } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let provider: Provider | undefined;
  try {
    const body = (await req.json()) as { provider?: Provider };
    provider = body.provider;
  } catch {
    // no body — clear all
  }
  if (provider) {
    const existing = await readSession();
    if (existing) {
      const updated = { ...existing.apiKeys };
      delete updated[provider];
      await writeSession({ apiKeys: updated });
    }
  } else {
    await clearSession();
  }
  return NextResponse.json({ ok: true });
}
