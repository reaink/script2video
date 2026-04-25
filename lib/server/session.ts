import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "s2v_session";

let cachedSecret: Buffer | null = null;

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error(
      "SESSION_SECRET environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "and add it to your .env.local file."
    );
  }
  cachedSecret = crypto.createHash("sha256").update(raw).digest();
  return cachedSecret;
}

export interface SessionData {
  provider: "gemini";
  apiKey: string;
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export async function readSession(): Promise<SessionData | null> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  if (!v) return null;
  try {
    const key = getSecret();
    return JSON.parse(decrypt(v, key)) as SessionData;
  } catch {
    return null;
  }
}

export async function writeSession(data: SessionData): Promise<void> {
  const c = await cookies();
  const key = getSecret();
  c.set(COOKIE_NAME, encrypt(JSON.stringify(data), key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function requireSession(): Promise<SessionData> {
  const s = await readSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}
