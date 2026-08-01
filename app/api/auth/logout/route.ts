import { NextResponse } from "next/server";

import { clearSessionCookie, publicUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logoutResponse(request: Request) {
  const response = NextResponse.redirect(publicUrl(request, "/login"), { status: 303 });
  clearSessionCookie(response);
  return response;
}

export async function GET(request: Request) {
  return logoutResponse(request);
}

export async function POST(request: Request) {
  return logoutResponse(request);
}
