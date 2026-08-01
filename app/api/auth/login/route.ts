import { NextResponse } from "next/server";

import {
  createSessionToken,
  isQaAuthConfigured,
  publicUrl,
  safeNextPath,
  setSessionCookie,
  verifyQaCredentials
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let username = "";
  let password = "";
  let next = "/app";

  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => null)) as
      | { username?: string; password?: string; next?: string }
      | null;
    username = json?.username ?? "";
    password = json?.password ?? "";
    next = safeNextPath(json?.next);
  } else {
    const formData = await request.formData();
    username = String(formData.get("username") ?? "");
    password = String(formData.get("password") ?? "");
    next = safeNextPath(formData.get("next"));
  }

  if (!isQaAuthConfigured()) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "QA login is not configured." }, { status: 503 });
    }
    return NextResponse.redirect(publicUrl(request, "/login?error=not-configured"), { status: 303 });
  }

  if (!verifyQaCredentials(username, password)) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    const loginUrl = publicUrl(request, "/login");
    loginUrl.searchParams.set("error", "invalid");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true, next })
    : NextResponse.redirect(publicUrl(request, next), { status: 303 });

  setSessionCookie(response, createSessionToken(username));
  return response;
}
