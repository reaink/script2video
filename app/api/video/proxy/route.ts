import { requireSession } from "@/lib/server/session";
import { downloadVideoStream } from "@/lib/providers/gemini";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("not configured", { status: 401 });
  }
  const url = new URL(req.url);
  const uri = url.searchParams.get("uri");
  if (!uri) return new Response("missing uri", { status: 400 });
  // Only allow Google generative language URIs to prevent SSRF
  if (!/^https:\/\/generativelanguage\.googleapis\.com\//.test(uri)) {
    return new Response("forbidden uri", { status: 403 });
  }
  const upstream = await downloadVideoStream(session.apiKey, uri);
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "upstream error", { status: upstream.status });
  }
  const isDownload = url.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp4",
    "Cache-Control": "private, max-age=3600",
  };
  if (isDownload) headers["Content-Disposition"] = `attachment; filename="clip.mp4"`;
  return new Response(upstream.body, { status: 200, headers });
}
