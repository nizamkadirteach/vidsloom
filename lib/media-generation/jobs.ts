import "server-only";

import { createHash } from "node:crypto";

import { readGeneratedAsset } from "@/lib/generated-asset-storage";
import { assembleFinalReviewVideo } from "@/lib/media-generation/final-assembler";
import { executableShotIdsFor, executionBlockersFor } from "@/lib/media-generation/cost-controls";
import { generateReferenceFrame, generateVideoClip, mediaFeatureFlags, type MediaGenerationResult } from "@/lib/media-generation/gemini-media";
import { buildMediaProductionPlan } from "@/lib/media-generation/production-plan";
import { promoteMediaGenerationAssets } from "@/lib/media-generation/promote-assets";
import { getCampaign, listCustomerAssetsForCustomer, saveCampaign } from "@/lib/storage";
import { defaultQueueLocation, enqueueHttpTask, queueStatus, type TaskEnqueueResult } from "@/lib/task-queue";
import type { Campaign } from "@/lib/schemas";
import type { MediaProductionPlan } from "@/lib/media-generation/schemas";

export type MediaGenerationJobResult = {
  ok: boolean;
  status: "not-found" | "planned" | "generated" | "disabled" | "blocked" | "failed";
  plan?: MediaProductionPlan;
  campaign?: Campaign;
  executionBlockers: string[];
  generatedAssets: Array<{
    shotId: string;
    type: "reference-frame" | "video-clip" | "final-video";
    result: MediaGenerationResult;
  }>;
};

export function mediaQueueStatus() {
  return queueStatus({
    queueName: mediaQueueName(),
    location: mediaQueueLocation(),
    workerUrl: process.env.VIDSLOOM_MEDIA_WORKER_URL
  });
}

export async function enqueueCampaignMediaJob({
  campaignId,
  origin,
  mode = "dry-run",
  execute = false,
  maxShots
}: {
  campaignId: string;
  origin: string;
  mode?: MediaProductionPlan["mode"];
  execute?: boolean;
  maxShots?: number;
}): Promise<TaskEnqueueResult> {
  const queueName = mediaQueueName();
  const secret = process.env.VIDSLOOM_AUTOMATION_SECRET?.trim() ?? "";
  if (!queueName || !secret) {
    return {
      queued: false,
      mode: "manual",
      reason: "Cloud Tasks media queue or automation secret is not configured."
    };
  }

  return enqueueHttpTask({
    queueName,
    location: mediaQueueLocation(),
    url: process.env.VIDSLOOM_MEDIA_WORKER_URL || new URL("/api/media/jobs", origin).toString(),
    body: { campaignId, mode, execute, ...(maxShots ? { maxShots } : {}) },
    dispatchDeadlineSeconds: mediaTaskDispatchDeadlineSeconds(),
    unavailableReason: "Cloud Tasks media queue or automation secret is not configured."
  });
}

export async function runCampaignMediaGenerationJob({
  campaignId,
  mode = "dry-run",
  execute = false,
  maxShots
}: {
  campaignId: string;
  mode?: MediaProductionPlan["mode"];
  execute?: boolean;
  maxShots?: number;
}): Promise<MediaGenerationJobResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return {
      ok: false,
      status: "not-found",
      executionBlockers: ["Campaign was not found."],
      generatedAssets: []
    };
  }

  const customerAssets = campaign.customerId ? await listCustomerAssetsForCustomer(campaign.customerId, 200) : [];
  const plan = buildMediaProductionPlan({ campaign, customerAssets, mode, maxShots });
  const flags = mediaFeatureFlags();
  const generatedAssets: MediaGenerationJobResult["generatedAssets"] = [];
  const executionBlockers = executionBlockersFor(plan);

  if (!execute || !flags.mediaGeneration || mode === "dry-run") {
    return {
      ok: true,
      status: !execute || mode === "dry-run" ? "planned" : "disabled",
      plan,
      campaign,
      executionBlockers,
      generatedAssets
    };
  }

  if (executionBlockers.length) {
    return {
      ok: true,
      status: "blocked",
      plan,
      campaign,
      executionBlockers,
      generatedAssets
    };
  }

  const executableShotIds = executableShotIdsFor(plan);
  const candidateShots = plan.shotPlans
    .filter((shot) => executableShotIds.has(shot.id))
    .slice(0, maxShots ?? maxShotsForMode(mode));

  for (const shot of candidateShots) {
    const packet = plan.promptPackets.find((item) => item.shotId === shot.id);
    if (!packet) continue;
    const storageBaseKey = mediaStorageBaseKey({ campaignId, conceptTitle: shot.conceptTitle, shotId: shot.id });
    let referenceImage: Buffer | undefined;

    if (mode === "reference-frame" || mode === "video-generation" || mode === "final-assembly") {
      const result = await generateReferenceFrame({ packet, storageBaseKey });
      generatedAssets.push({ shotId: shot.id, type: "reference-frame", result });
      if (result.asset) {
        const stored = await readGeneratedAsset(result.asset.key).catch(() => null);
        referenceImage = stored?.body;
      }
    }

    if (mode === "video-generation" || mode === "final-assembly") {
      const result = await generateVideoClip({ packet, storageBaseKey, referenceImage });
      generatedAssets.push({ shotId: shot.id, type: "video-clip", result });
    }
  }

  if (mode === "final-assembly") {
    const composition = plan.renderCompositions[0];
    const result = await assembleFinalReviewVideo({
      campaign,
      plan,
      generatedAssets,
      storageBaseKey: mediaStorageBaseKey({
        campaignId,
        conceptTitle: composition?.conceptTitle ?? campaign.intake.businessName,
        shotId: "final-assembly"
      })
    });
    generatedAssets.push({
      shotId: composition?.sourceShotIds[0] ?? "final-assembly",
      type: "final-video",
      result
    });
  }

  const status = jobStatusFor(generatedAssets);
  const updatedCampaign = promoteMediaGenerationAssets({
    campaign,
    plan,
    mode,
    status,
    generatedAssets
  });
  await saveCampaign(updatedCampaign);

  return {
    ok: true,
    status,
    plan,
    campaign: updatedCampaign,
    executionBlockers,
    generatedAssets
  };
}

function mediaStorageBaseKey({
  campaignId,
  conceptTitle,
  shotId
}: {
  campaignId: string;
  conceptTitle: string;
  shotId: string;
}) {
  return [
    process.env.VIDSLOOM_ENV ?? "local",
    "media-generation",
    storageSegment(campaignId, 96),
    storageSegment(conceptTitle, 72),
    storageSegment(shotId, 96)
  ].join("/");
}

function maxShotsForMode(mode: MediaProductionPlan["mode"]) {
  if (mode === "reference-frame") return positiveInteger(process.env.VIDSLOOM_REFERENCE_FRAME_MAX_SHOTS, 8);
  if (mode === "video-generation") return positiveInteger(process.env.VIDSLOOM_VIDEO_CLIP_MAX_SHOTS, 2);
  if (mode === "final-assembly") return positiveInteger(process.env.VIDSLOOM_VIDEO_CLIP_MAX_SHOTS, 3);
  return 0;
}

function jobStatusFor(generatedAssets: MediaGenerationJobResult["generatedAssets"]): "planned" | "generated" | "disabled" | "failed" {
  if (generatedAssets.some((item) => item.result.status === "failed")) return "failed";
  if (generatedAssets.some((item) => item.result.status === "generated")) return "generated";
  if (generatedAssets.some((item) => item.result.status === "disabled")) return "disabled";
  return "generated";
}

function mediaQueueName() {
  return (process.env.VIDSLOOM_MEDIA_QUEUE || "").trim();
}

function mediaQueueLocation() {
  return (process.env.VIDSLOOM_MEDIA_QUEUE_LOCATION || defaultQueueLocation()).trim();
}

function mediaTaskDispatchDeadlineSeconds() {
  const parsed = positiveInteger(process.env.VIDSLOOM_MEDIA_TASK_DISPATCH_DEADLINE_SECONDS, 1800);
  return Math.min(1800, Math.max(15, parsed));
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function storageSegment(input: string, maxLength: number) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (base.length <= maxLength) return base || "item";
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 10);
  return `${base.slice(0, Math.max(12, maxLength - hash.length - 1)).replace(/-+$/g, "")}-${hash}`;
}
