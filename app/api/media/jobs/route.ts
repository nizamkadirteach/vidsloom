import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAutomationSecret, publicUrl, requireQaSession } from "@/lib/auth";
import { enqueueCampaignMediaJob, runCampaignMediaGenerationJob } from "@/lib/media-generation/jobs";
import { toPublicCampaign } from "@/lib/public-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MediaJobRequestSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  mode: z.enum(["dry-run", "reference-frame", "video-generation", "final-assembly"]).default("dry-run"),
  execute: z.boolean().default(false),
  enqueue: z.boolean().default(false),
  maxShots: z.number().int().min(1).max(20).optional()
});

export async function POST(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    const authError = requireQaSession(request);
    if (authError) return authError;
  }

  const json = await request.json().catch(() => null);
  const parsed = MediaJobRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media generation job request.", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.enqueue) {
    const result = await enqueueCampaignMediaJob({
      campaignId: parsed.data.campaignId,
      origin: publicUrl(request, "/").origin,
      mode: parsed.data.mode,
      execute: parsed.data.execute,
      maxShots: parsed.data.maxShots
    });
    return NextResponse.json({ ok: result.queued, status: "queued", queue: result });
  }

  const result = await runCampaignMediaGenerationJob(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Campaign not found.", status: result.status }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    publicSummary: result.plan?.publicSummary,
    counts: {
      assetsAnalyzed: result.plan?.assetAnalyses.length ?? 0,
      shots: result.plan?.shotPlans.length ?? 0,
      executableShots: result.plan?.budget.executableShotIds.length ?? 0,
      blockedShots: result.plan?.budget.blockedShotIds.length ?? 0,
      promptPackets: result.plan?.promptPackets.length ?? 0,
      qaReports: result.plan?.qaReports.length ?? 0,
      regenerationRequests: result.plan?.regenerationRequests.length ?? 0,
      jobs: result.plan?.jobs.length ?? 0,
      generatedAssets: result.generatedAssets.length
    },
    executionBlockers: result.executionBlockers,
    generatedAssets: result.generatedAssets,
    campaign: result.campaign ? toPublicCampaign(result.campaign) : undefined,
    plan: result.plan
      ? {
          id: result.plan.id,
          campaignId: result.plan.campaignId,
          mode: result.plan.mode,
          createdAt: result.plan.createdAt,
          productionBrief: {
            businessName: result.plan.productionBrief.businessName,
            industry: result.plan.productionBrief.industry,
            platforms: result.plan.productionBrief.platforms,
            durationSeconds: result.plan.productionBrief.durationSeconds,
            qualityMode: result.plan.productionBrief.qualityMode,
            approvedProofCount: result.plan.productionBrief.approvedProof.length,
            prohibitedClaimsCount: result.plan.productionBrief.prohibitedClaims.length,
            referenceAssetCount: result.plan.productionBrief.referenceAssetIds.length
          },
          budget: result.plan.budget,
          shotPlans: result.plan.shotPlans,
          qaReports: result.plan.qaReports,
          renderCompositions: result.plan.renderCompositions,
          jobs: result.plan.jobs
        }
      : undefined
  });
}
