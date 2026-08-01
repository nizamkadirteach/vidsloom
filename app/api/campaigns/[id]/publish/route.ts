import { NextResponse } from "next/server";

import { publicUrl, requireQaSession } from "@/lib/auth";
import { executePublishingAction, listCampaignPublishingAttempts } from "@/lib/social-posting";
import { PublishingActionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await context.params;
  const attempts = await listCampaignPublishingAttempts(id);
  return NextResponse.json({ attempts });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const json = await request.json().catch(() => null);
  const parsed = PublishingActionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publishing action.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const attempt = await executePublishingAction({
      campaignId: id,
      taskKey: parsed.data.taskKey,
      method: parsed.data.method,
      origin: publicUrl(request, "/").origin,
      requestedBy: "qa"
    });
    return NextResponse.json({ ok: true, attempt }, { status: attempt.status === "blocked" ? 409 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publishing action failed." },
      { status: 400 }
    );
  }
}
