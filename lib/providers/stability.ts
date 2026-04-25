const BASE = "https://api.stability.ai";

export const STABILITY_IMAGE_MODELS = [
  { name: "stability/ultra", displayName: "Stable Image Ultra", provider: "stability" as const },
  { name: "stability/core", displayName: "Stable Image Core", provider: "stability" as const },
  { name: "stability/sd3-img2img", displayName: "SD3 Large (img2img)", provider: "stability" as const },
] as const;

export async function validateApiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/v1/user/account`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Stability AI API key invalid (${res.status})`);
  }
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function generateImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  referenceImages?: { mimeType: string; bytesBase64Encoded: string }[];
}): Promise<{ mimeType: string; bytesBase64Encoded: string }> {
  const ref = args.referenceImages?.[0];
  const form = new FormData();
  form.append("prompt", args.prompt);
  form.append("output_format", "png");
  if (args.aspectRatio) form.append("aspect_ratio", args.aspectRatio);

  let endpoint: string;
  if (args.model === "stability/sd3-img2img" && ref) {
    endpoint = `${BASE}/v2beta/stable-image/generate/sd3`;
    form.append("image", base64ToBlob(ref.bytesBase64Encoded, ref.mimeType), "frame.png");
    form.append("mode", "image-to-image");
    form.append("strength", "0.7");
    form.append("model", "sd3-large");
  } else if (args.model === "stability/core") {
    endpoint = `${BASE}/v2beta/stable-image/generate/core`;
  } else {
    endpoint = `${BASE}/v2beta/stable-image/generate/ultra`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      Accept: "application/json",
    },
    body: form,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stability AI ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { image?: string };
  if (!data.image) throw new Error("Stability AI: no image returned");
  return { mimeType: "image/png", bytesBase64Encoded: data.image };
}
