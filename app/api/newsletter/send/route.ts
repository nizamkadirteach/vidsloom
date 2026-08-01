import { NextResponse } from "next/server";
import { z } from "zod";

import { requireQaSession } from "@/lib/auth";
import { sendNewsletterBroadcast } from "@/lib/newsletter-automation";
import { NewsletterAudienceRuleSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NewsletterSendSchema = z.object({
  mode: z.enum(["test", "broadcast"]).default("test"),
  subject: z.string().trim().min(6).max(140),
  body: z.string().trim().min(20).max(4000),
  testEmail: z.string().trim().email().optional().or(z.literal("")),
  limit: z.number().int().min(1).max(500).default(500),
  audience: NewsletterAudienceRuleSchema.optional()
});

export async function POST(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const json = await request.json().catch(() => null);
  const parsed = NewsletterSendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid newsletter send request.", issues: parsed.error.issues }, { status: 400 });
  }

  const { mode, subject, body, testEmail, limit, audience } = parsed.data;
  const result = await sendNewsletterBroadcast({
    mode,
    subject,
    body,
    testEmail,
    limit,
    audience,
    requestUrl: request.url
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ mode, ...result }, { status: 400 });
  }

  return NextResponse.json({ mode, ...result });
}
