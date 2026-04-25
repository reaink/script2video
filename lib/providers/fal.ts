const BASE = "https://fal.run";

export const FAL_IMAGE_MODELS = [
  { name: "fal-ai/flux-pro/kontext", displayName: "FLUX Kontext Pro (img2img)", provider: "fal" as const },
  { name: "fal-ai/flux-pro", displayName: "FLUX Pro", provider: "fal" as const },
] as const;

// fal.ai has no free account-info endpoint; we skip round-trip validation.
// An invalid key will surface as 401 on first generation.
export async function validateApiKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new Error("fal.ai API key is empty");
}

function aspectRatioToSize(ar?: "16:9" | "9:16"): { width: number; height: number } {
  if (ar === "16:9") return { width: 1344, height: 768 };
  if (ar === "9:16") return { width: 768, height: 1344 };
  return { width: 1024, height: 1024 };
}

export async function generateImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  referenceImages?: { mimeType: string; bytesBase64Encoded: string }[];
}): Promise<{ mimeType: string; bytesBase64Encoded: string }> {
  const ref = args.referenceImages?.[0];
  const isKontext = args.model.includes("kontext");

  const body: Record<string, unknown> = { prompt: args.prompt };
  if (ref && isKontext) {
    body.image_url = `data:${ref.mimeType};base64,${ref.bytesBase64Encoded}`;
  } else {
    body.image_size = aspectRatioToSize(args.aspectRatio);
  }

  const res = await fetch(`${BASE}/${args.model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${args.apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai generateImage ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { images?: { url: string; content_type?: string }[] };
  const imgUrl = data.images?.[0]?.url;
  if (!imgUrl) throw new Error("fal.ai: no image returned");

  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`fal.ai: failed to fetch image (${imgRes.status})`);
  const buf = await imgRes.arrayBuffer();
  const mimeType = imgRes.headers.get("content-type") ?? data.images?.[0]?.content_type ?? "image/jpeg";

  return { mimeType, bytesBase64Encoded: Buffer.from(buf).toString("base64") };
}
