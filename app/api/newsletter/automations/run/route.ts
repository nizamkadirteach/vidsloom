import { NextResponse } from "next/server";

import { hasValidAutomationSecret, requireQaSession } from "@/lib/auth";
import { runDueNewsletterAutomations } from "@/lib/newsletter-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    const authError = requireQaSession(request);
    if (authError) return authError;
  }

  const result = await runDueNewsletterAutomations({
    requestUrl: request.url,
    limit: 50
  });

  return NextResponse.json(result);
}
