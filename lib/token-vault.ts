import "server-only";

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export function tokenVaultConfigured() {
  return Boolean(secretMaterial());
}

export function encryptToken(value: string) {
  if (!value) return "";
  const secret = secretMaterial();
  if (!secret) throw new Error("VIDSLOOM token encryption is not configured.");

  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(value: string) {
  if (!value) return "";
  const secret = secretMaterial();
  if (!secret) throw new Error("VIDSLOOM token encryption is not configured.");

  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored token is not readable.");

  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function secretMaterial() {
  return (
    process.env.VIDSLOOM_TOKEN_ENCRYPTION_SECRET ||
    process.env.VIDSLOOM_AUTH_SECRET ||
    process.env.VIDSLOOM_AUTOMATION_SECRET ||
    ""
  ).trim();
}
