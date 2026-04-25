import { requireSession, getApiKey } from "@/lib/server/session";
import { downloadVideoStream } from "@/lib/providers/gemini";

const ALLOWED_PATTERNS = [
  /^https:\/\/generativelanguage\.googleapis\.com\//,
  /^https:\/\/[a-z0-9-]+\.runwayml\.com\//,
  /^https:\/\/[a-z0-9-]+\.cdn-runway\.com\//,
  /^https:\/\/cdn\.minimax\.io\//,
  /^https:\/\/[a-z0-9-]+\.minimax\.io\//,
  /^https:\/\/[a-z0-9-]+\.lumastorage\.com\//,
  /^https:\/\/storage\.cdn-luma\.com\//,
  /^https:\/\/files\.lumalabs\.ai\//,
];

function isAllowedUri(uri: string): boolean {
  return ALLOWED_PATTERNS.some((p) => p.test(uri));
}

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
  if (!isAllowedUri(uri)) {
    return new Response("forbidden uri", { status: 403 });
  }

  const isDownload = url.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Cache-Control": "private, max-age=3600",
  };
  if (isDownload) headers["Content-Disposition"] = `attachment; filename="clip.mp4"`;

  // Google URIs require the API key for authentication
  if (/^https:\/\/generativelanguage\.googleapis\.com\//.test(uri)) {
    const geminiKey = getApiKey(session, "gemini");
    if (!geminiKey) return new Response("gemini not configured", { status: 401 });
    const upstream = await downloadVideoStream(geminiKey, uri);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return new Response(text || "upstream error", { status: upstream.status });
    }
    headers["Content-Type"] = upstream.headers.get("Content-Type") ?? "video/mp4";
    return new Response(upstream.body, { status: 200, headers });
  }

  // Other CDN URIs — proxy without auth
  const upstream = await fetch(uri, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: upstream.status });
  }
  headers["Content-Type"] = upstream.headers.get("Content-Type") ?? "video/mp4";
  return new Response(upstream.body, { status: 200, headers });
}
