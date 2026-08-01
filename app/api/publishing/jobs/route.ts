import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAutomationSecret, publicUrl, requireQaSession } from "@/lib/auth";
import { runPublishingJob, runPublishingProofFollowUp, runPublishingSweep } from "@/lib/publishing-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PublishingJobRequestSchema = z.object({
  campaignId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  taskKey: z.string().trim().max(360).optional().or(z.literal("")).default(""),
  followUpType: z.enum(["proof-24h", "proof-48h"]).optional(),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50)
});

export async function POST(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    const authError = requireQaSession(request);
    if (authError) return authError;
  }

  const json = await request.json().catch(() => null);
  const parsed = PublishingJobRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publishing job request.", issues: parsed.error.issues }, { status: 400 });
  }

  const origin = publicUrl(request, "/").origin;
  const { campaignId, customerId, taskKey, followUpType, force, dryRun, limit } = parsed.data;
  const result =
    campaignId && taskKey && followUpType
      ? await runPublishingProofFollowUp({ campaignId, customerId, taskKey, followUpType, origin })
      : campaignId && taskKey
      ? await runPublishingJob({ campaignId, customerId, taskKey, origin, force, dryRun })
      : await runPublishingSweep({ origin, force, dryRun, limit });

  if (!result.ok && "status" in result && result.status === "not-found") {
    return NextResponse.json({ error: result.reason, status: result.status }, { status: 404 });
  }

  return NextResponse.json(result);
}
