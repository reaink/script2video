import { NextResponse } from "next/server";
import { requireSession, requireApiKey } from "@/lib/server/session";
import { getOperation } from "@/lib/providers/gemini";
import { getTaskStatus as runwayStatus } from "@/lib/providers/runway";
import { getTaskStatus as minimaxStatus, getFileDownloadUrl } from "@/lib/providers/minimax";
import { getGenerationStatus as lumaStatus } from "@/lib/providers/luma";

/** Normalize any provider's response to the shape the jobs store expects. */
interface NormalizedStatus {
  done: boolean;
  error?: { message: string };
  response?: { generatedVideos: { video: { uri: string } }[] };
}

function parseOp(op: string): { provider: string; id: string } {
  const colon = op.indexOf(":");
  if (colon === -1 || op.startsWith("operations/")) return { provider: "gemini", id: op };
  return { provider: op.slice(0, colon), id: op.slice(colon + 1) };
}

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

  const { provider, id } = parseOp(op);

  try {
    if (provider === "gemini") {
      const apiKey = requireApiKey(session, "gemini");
      const status = await getOperation(apiKey, id);
      return NextResponse.json(status);
    }

    if (provider === "runway") {
      const apiKey = requireApiKey(session, "runway");
      const status = await runwayStatus(apiKey, id);
      const out: NormalizedStatus = { done: false };
      if (status.status === "SUCCEEDED" && status.output?.[0]) {
        out.done = true;
        out.response = { generatedVideos: [{ video: { uri: status.output[0] } }] };
      } else if (status.status === "FAILED" || status.status === "CANCELLED") {
        out.done = true;
        out.error = { message: status.failure ?? `Runway task ${status.status}` };
      }
      return NextResponse.json(out);
    }

    if (provider === "minimax") {
      const apiKey = requireApiKey(session, "minimax");
      const status = await minimaxStatus(apiKey, id);
      const out: NormalizedStatus = { done: false };
      if (status.status === "success" && status.file_id) {
        const downloadUrl = await getFileDownloadUrl(apiKey, status.file_id);
        out.done = true;
        out.response = { generatedVideos: [{ video: { uri: downloadUrl } }] };
      } else if (status.status === "failed") {
        out.done = true;
        out.error = { message: status.error ?? "MiniMax generation failed" };
      }
      return NextResponse.json(out);
    }

    if (provider === "luma") {
      const apiKey = requireApiKey(session, "luma");
      const status = await lumaStatus(apiKey, id);
      const out: NormalizedStatus = { done: false };
      if (status.state === "completed" && status.assets?.video) {
        out.done = true;
        out.response = { generatedVideos: [{ video: { uri: status.assets.video } }] };
      } else if (status.state === "failed") {
        out.done = true;
        out.error = { message: status.failure_reason ?? "Luma generation failed" };
      }
      return NextResponse.json(out);
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
