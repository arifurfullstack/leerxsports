/**
 * Server-only AES-256-GCM helpers for payment gateway credential encryption.
 * Never import from client-reachable module scope; load via dynamic import
 * inside server-function handlers.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc::v1::";

function key(): Buffer {
  const raw = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
  if (!raw) throw new Error("PAYMENT_GATEWAY_ENCRYPTION_KEY is not set");
  // Normalise any-length input to a 32-byte key.
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (isEncrypted(plaintext)) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored; // legacy plaintext row
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}