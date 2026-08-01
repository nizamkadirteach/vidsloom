import "server-only";

import { completeCampaignPlanning } from "@/lib/campaign-engine";
import { enqueueCampaignRender } from "@/lib/render-jobs";
import { getCampaign, saveCampaign } from "@/lib/storage";
import { defaultQueueLocation, enqueueHttpTask, queueStatus, type TaskEnqueueResult } from "@/lib/task-queue";

export type PlanningEnqueueResult = TaskEnqueueResult;

export function planningQueueStatus() {
  return queueStatus({
    queueName: planningQueueName(),
    location: planningQueueLocation(),
    workerUrl: process.env.VIDSLOOM_PLANNING_WORKER_URL
  });
}

export async function enqueueCampaignPlanning({
  campaignId,
  origin,
  force = false
}: {
  campaignId: string;
  origin: string;
  force?: boolean;
}): Promise<PlanningEnqueueResult> {
  const url = process.env.VIDSLOOM_PLANNING_WORKER_URL || new URL("/api/planning/jobs", origin).toString();
  const result = await enqueueHttpTask({
    queueName: planningQueueName(),
    location: planningQueueLocation(),
    url,
    body: { campaignId, force },
    unavailableReason: "Cloud Tasks planning queue or automation secret is not configured."
  });

  const campaign = await getCampaign(campaignId);
  if (campaign) {
    await saveCampaign({
      ...campaign,
      planningStatus: "planning-queued",
      planningQueuedAt: new Date().toISOString(),
      planningStartedAt: "",
      planningCompletedAt: "",
      planningJobId: result.taskName ?? "",
      planningError: result.queued ? "" : result.reason ?? "Planning queue is not configured."
    });
  }

  return result;
}

export async function runCampaignPlanningJob({
  campaignId,
  origin,
  force = false
}: {
  campaignId: string;
  origin: string;
  force?: boolean;
}) {
  const planning = await completeCampaignPlanning({ campaignId, force });
  if (!planning.ok || !planning.campaign) {
    return {
      ...planning,
      renderQueue: null
    };
  }

  if (planning.campaign.planningStatus !== "pack-ready") {
    return {
      ...planning,
      renderQueue: null
    };
  }

  const renderQueue = await enqueueCampaignRender({
    campaignId: planning.campaign.id,
    origin
  }).catch((error) => ({
    queued: false,
    mode: "manual" as const,
    reason: error instanceof Error ? error.message : "Render queue failed."
  }));

  return {
    ...planning,
    renderQueue
  };
}

function planningQueueName() {
  return (process.env.VIDSLOOM_PLANNING_QUEUE || process.env.VIDSLOOM_RENDER_QUEUE || "").trim();
}

function planningQueueLocation() {
  return (process.env.VIDSLOOM_PLANNING_QUEUE_LOCATION || defaultQueueLocation()).trim();
}
