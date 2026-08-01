import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAutomationSecret, publicUrl, requireQaSession } from "@/lib/auth";
import { enqueueCampaignPlanning, runCampaignPlanningJob } from "@/lib/planning-jobs";
import { toPublicCampaign } from "@/lib/public-campaign";
import { getCampaign } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PlanningJobRequestSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  force: z.boolean().default(false)
});

export async function POST(request: Request) {
  const isAutomationWorker = hasValidAutomationSecret(request);
  if (!isAutomationWorker) {
    const authError = requireQaSession(request);
    if (authError) return authError;
  }

  const json = await request.json().catch(() => null);
  const parsed = PlanningJobRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid planning job request.", issues: parsed.error.issues }, { status: 400 });
  }

  const origin = publicUrl(request, "/").origin;

  if (!isAutomationWorker) {
    const planningQueue = await enqueueCampaignPlanning({
      campaignId: parsed.data.campaignId,
      force: parsed.data.force,
      origin
    }).catch((error) => ({
      queued: false,
      mode: "manual" as const,
      reason: error instanceof Error ? error.message : "Planning queue failed."
    }));
    const campaign = await getCampaign(parsed.data.campaignId);

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

  const result = await runCampaignPlanningJob({
    ...parsed.data,
    origin
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Campaign not found.", status: result.status }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    renderQueue: result.renderQueue,
    campaign: result.campaign ? toPublicCampaign(result.campaign) : undefined
  });
}
