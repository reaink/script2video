import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { getOperation } from "@/lib/providers/gemini";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  if (!op) return NextResponse.json({ error: "missing op" }, { status: 400 });
  try {
    const status = await getOperation(session.apiKey, op);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
