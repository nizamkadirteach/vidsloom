import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "vidsloom_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthConfig = {
  username: string;
  password: string;
  secret: string;
};

function getAuthConfig(): AuthConfig | null {
  const username = process.env.VIDSLOOM_QA_USERNAME;
  const password = process.env.VIDSLOOM_QA_PASSWORD;
  const secret = process.env.VIDSLOOM_AUTH_SECRET;

  if (!username || !password || !secret) return null;
  return { username, password, secret };
}

export function isQaAuthConfigured() {
  return Boolean(getAuthConfig());
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyQaCredentials(username: string, password: string) {
  const config = getAuthConfig();
  if (!config) return false;

  return timingSafeEqualText(username, config.username) && timingSafeEqualText(password, config.password);
}

export function createSessionToken(username: string) {
  const config = getAuthConfig();
  if (!config) throw new Error("VIDSLOOM QA auth is not configured.");

  const payload = base64url(
    JSON.stringify({
      sub: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })
  );
  const signature = signPayload(payload, config.secret);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  const config = getAuthConfig();
  if (!config || !token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload, config.secret);
  if (!timingSafeEqualText(signature, expectedSignature)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
    };
    return data.sub === config.username && typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  const cookiesByName = Object.fromEntries(
    cookieHeader.split(";").map((item) => {
      const [key, ...value] = item.trim().split("=");
      return [key, value.join("=")];
    })
  );
  return cookiesByName[name] ? decodeURIComponent(cookiesByName[name]) : undefined;
}

export async function hasValidSessionFromNextCookies() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function hasValidSessionFromRequest(request: Request) {
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

export function requireQaSession(request: Request) {
  if (!isQaAuthConfigured()) {
    return NextResponse.json({ error: "QA login is not configured." }, { status: 503 });
  }

  if (!hasValidSessionFromRequest(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return null;
}

export function hasValidAutomationSecret(request: Request) {
  const secret = process.env.VIDSLOOM_AUTOMATION_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return Boolean(token) && timingSafeEqualText(token, secret);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return "/app";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/app";
  return value;
}

export function publicUrl(request: Request, path: string) {
  const configuredBaseUrl = process.env.VIDSLOOM_PUBLIC_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return new URL(path, configuredBaseUrl);
  }

  const fallbackUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? fallbackUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? fallbackUrl.protocol.replace(":", "") ?? "https";
  return new URL(path, `${protocol}://${host}`);
}
