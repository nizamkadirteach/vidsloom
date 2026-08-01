import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import { toPublicCampaign } from "@/lib/public-campaign";
import { runCampaignRenderJob } from "@/lib/render-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await context.params;
  const result = await runCampaignRenderJob({ campaignId: id, force: true });

  if (!result.ok || !result.campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    renderedAssets: result.renderedAssets,
    dynamicAssets: result.dynamicAssets,
    failedAssets: result.failedAssets,
    campaign: toPublicCampaign(result.campaign)
  });
}
