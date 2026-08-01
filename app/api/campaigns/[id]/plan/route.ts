import { NextResponse } from "next/server";

import { publicUrl, requireQaSession } from "@/lib/auth";
import { enqueueCampaignPlanning } from "@/lib/planning-jobs";
import { toPublicCampaign } from "@/lib/public-campaign";
import { getCampaign } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await context.params;
  const planningQueue = await enqueueCampaignPlanning({
    campaignId: id,
    force: true,
    origin: publicUrl(request, "/").origin
  }).catch((error) => ({
    queued: false,
    mode: "manual" as const,
    reason: error instanceof Error ? error.message : "Planning queue failed."
  }));
  const campaign = await getCampaign(id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found.", status: "not-found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      status: "queued",
      planningQueue,
      campaign: toPublicCampaign(campaign)
    },
    { status: 202 }
  );
}
