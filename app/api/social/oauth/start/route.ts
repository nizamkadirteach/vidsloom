import { NextResponse } from "next/server";

import { hasValidSessionFromRequest, publicUrl } from "@/lib/auth";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { PlatformSchema } from "@/lib/schemas";
import { buildOAuthAuthorizationUrl } from "@/lib/social-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedPlatform = PlatformSchema.safeParse(url.searchParams.get("platform"));
  if (!parsedPlatform.success) {
    return NextResponse.json({ error: "Unsupported platform." }, { status: 400 });
  }

  const customerId = url.searchParams.get("customerId") ?? "";
  const accessToken = url.searchParams.get("accessToken") ?? "";
  const returnTo = url.searchParams.get("returnTo") ?? "/portal";
  const isQa = hasValidSessionFromRequest(request);
  const customer = customerId && accessToken ? await authorizeCustomerPortal({ customerId, accessToken }) : null;
  if (!isQa && !customer) {
    return NextResponse.json({ error: "Authentication required before connecting a social account." }, { status: 401 });
  }

  try {
    const origin = publicUrl(request, "/").origin;
    const authUrl = buildOAuthAuthorizationUrl({
      platform: parsedPlatform.data,
      customerId: customer?.id ?? customerId,
      origin,
      returnTo
    });
    return NextResponse.redirect(authUrl, { status: 303 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start social account connection." },
      { status: 503 }
    );
  }
}
