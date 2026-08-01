import { NextResponse } from "next/server";

import { createCampaignDraft } from "@/lib/campaign-engine";
import { publicUrl, requireQaSession } from "@/lib/auth";
import { enqueueCampaignPlanning } from "@/lib/planning-jobs";
import { toPublicCampaign } from "@/lib/public-campaign";
import { CampaignIntakeSchema } from "@/lib/schemas";
import { listCampaigns } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns: campaigns.map(toPublicCampaign) });
}

export async function POST(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const json = await request.json().catch(() => null);
  const parsed = CampaignIntakeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid campaign intake.",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const campaign = await createCampaignDraft(parsed.data);
  const planningQueue = await enqueueCampaignPlanning({
    campaignId: campaign.id,
    origin: publicUrl(request, "/").origin
  }).catch((error) => ({
    queued: false,
    mode: "manual" as const,
    reason: error instanceof Error ? error.message : "Planning queue failed."
  }));

  return NextResponse.json({ campaignId: campaign.id, campaign: toPublicCampaign(campaign), planningQueue }, { status: 202 });
}
