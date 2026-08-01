import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { PlatformSchema } from "@/lib/schemas";
import { completeOAuthCallback } from "@/lib/social-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedPlatform = PlatformSchema.safeParse(url.searchParams.get("platform"));
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error") ?? "";
  const origin = publicUrl(request, "/").origin;

  if (!parsedPlatform.success) {
    return NextResponse.json({ error: "Unsupported platform." }, { status: 400 });
  }

  const fallbackReturnTo = "/app";
  if (providerError) {
    const redirectUrl = new URL(fallbackReturnTo, origin);
    redirectUrl.searchParams.set("social", "error");
    redirectUrl.searchParams.set("reason", providerError);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  try {
    const { connection, returnTo } = await completeOAuthCallback({
      platform: parsedPlatform.data,
      code,
      state,
      origin
    });
    const redirectUrl = new URL(returnTo, origin);
    redirectUrl.searchParams.set("platform", connection.platform);
    redirectUrl.searchParams.set("connection", connection.status);
    redirectUrl.searchParams.set("social", "connected");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch (error) {
    const redirectUrl = new URL(fallbackReturnTo, origin);
    redirectUrl.searchParams.set("social", "error");
    redirectUrl.searchParams.set("reason", error instanceof Error ? error.message.slice(0, 180) : "OAuth callback failed.");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }
}
