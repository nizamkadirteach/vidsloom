import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAutomationSecret, requireQaSession } from "@/lib/auth";
import { toPublicCampaign } from "@/lib/public-campaign";
import { runCampaignRenderJob } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RenderJobRequestSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  force: z.boolean().default(false)
});

export async function POST(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    const authError = requireQaSession(request);
    if (authError) return authError;
  }

  const json = await request.json().catch(() => null);
  const parsed = RenderJobRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid render job request.", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await runCampaignRenderJob(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Campaign not found.", status: result.status }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    renderedAssets: result.renderedAssets,
    dynamicAssets: result.dynamicAssets,
    failedAssets: result.failedAssets,
    campaign: result.campaign ? toPublicCampaign(result.campaign) : undefined
  });
}
