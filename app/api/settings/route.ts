import { NextResponse } from "next/server";
import { clearSession, readSession, writeSession } from "@/lib/server/session";
import { listModels } from "@/lib/providers/gemini";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    provider: s.provider,
    apiKeyMasked: s.apiKey.slice(0, 4) + "..." + s.apiKey.slice(-4),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { provider?: string; apiKey?: string };
  if (body.provider !== "gemini" || !body.apiKey) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  // Validate by listing models once.
  try {
    await listModels(body.apiKey);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 401 });
  }
  await writeSession({ provider: "gemini", apiKey: body.apiKey });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
