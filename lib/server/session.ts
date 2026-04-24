import { cookies } from "next/headers";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const COOKIE_NAME = "s2v_session";
const SECRET_FILE = path.join(process.cwd(), ".session-secret");

let cachedSecret: Buffer | null = null;

async function getSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = crypto
      .createHash("sha256")
      .update(process.env.SESSION_SECRET)
      .digest();
    return cachedSecret;
  }
  try {
    const buf = await fs.readFile(SECRET_FILE);
    cachedSecret = buf.length === 32 ? buf : crypto.createHash("sha256").update(buf).digest();
    return cachedSecret;
  } catch {
    const fresh = crypto.randomBytes(32);
    await fs.writeFile(SECRET_FILE, fresh, { mode: 0o600 });
    cachedSecret = fresh;
    return cachedSecret;
  }
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
    const key = await getSecret();
    return JSON.parse(decrypt(v, key)) as SessionData;
  } catch {
    return null;
  }
}

export async function writeSession(data: SessionData): Promise<void> {
  const c = await cookies();
  const key = await getSecret();
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
