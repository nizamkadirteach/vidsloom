import "server-only";

import { Campaign } from "@/lib/schemas";
import { getCampaign, saveCampaign } from "@/lib/storage";
import { defaultQueueLocation, enqueueHttpTask, queueStatus, type TaskEnqueueResult } from "@/lib/task-queue";
import { renderCampaignVideoAssets } from "@/lib/video-renderer";

export type RenderEnqueueResult = TaskEnqueueResult;

export function renderQueueStatus() {
  return queueStatus({
    queueName: renderQueueName(),
    location: renderQueueLocation(),
    workerUrl: process.env.VIDSLOOM_RENDER_WORKER_URL
  });
}

export async function enqueueCampaignRender({
  campaignId,
  origin
}: {
  campaignId: string;
  origin: string;
}): Promise<RenderEnqueueResult> {
  const queueName = renderQueueName();
  const secret = renderAutomationSecret();

  if (!queueName || !secret) {
    return {
      queued: false,
      mode: "manual",
      reason: "Cloud Tasks queue or automation secret is not configured."
    };
  }

  const location = renderQueueLocation();
  const url = process.env.VIDSLOOM_RENDER_WORKER_URL || new URL("/api/render/jobs", origin).toString();
  return enqueueHttpTask({
    queueName,
    location,
    url,
    body: { campaignId },
    unavailableReason: "Cloud Tasks render queue or automation secret is not configured."
  });
}

export async function runCampaignRenderJob({
  campaignId,
  force = false
}: {
  campaignId: string;
  force?: boolean;
}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return {
      ok: false,
      status: "not-found" as const,
      renderedAssets: 0,
      dynamicAssets: 0,
      failedAssets: 0
    };
  }

  const hasPendingWork = campaign.pack.videoAssets.some((asset) =>
    ["render-queued", "rendering", "render-failed"].includes(asset.status)
  );
  if (!force && !hasPendingWork) {
    return {
      ok: true,
      status: "already-rendered" as const,
      campaign,
      renderedAssets: campaign.pack.videoAssets.length,
      dynamicAssets: campaign.pack.videoAssets.filter((asset) => asset.renderMode === "dynamic-render").length,
      failedAssets: campaign.pack.videoAssets.filter((asset) => asset.status === "render-failed").length
    };
  }

  const startedAt = new Date().toISOString();
  const renderingCampaign: Campaign = {
    ...campaign,
    pack: {
      ...campaign.pack,
      videoAssets: campaign.pack.videoAssets.map((asset) => ({
        ...asset,
        status: "rendering" as const,
        renderMode: asset.renderMode === "dynamic-render" ? asset.renderMode : ("queued-render" as const),
        renderError: "",
        renderStartedAt: startedAt
      }))
    }
  };
  await saveCampaign(renderingCampaign);

  const videoAssets = await renderCampaignVideoAssets({
    campaignId: renderingCampaign.id,
    intake: renderingCampaign.intake,
    pack: renderingCampaign.pack,
    createdAt: new Date().toISOString()
  });

  const renderedCampaign: Campaign = {
    ...renderingCampaign,
    pack: {
      ...renderingCampaign.pack,
      videoAssets
    }
  };
  await saveCampaign(renderedCampaign);

  return {
    ok: true,
    status: "rendered" as const,
    campaign: renderedCampaign,
    renderedAssets: videoAssets.length,
    dynamicAssets: videoAssets.filter((asset) => asset.renderMode === "dynamic-render").length,
    failedAssets: videoAssets.filter((asset) => asset.status === "render-failed").length
  };
}

function renderQueueName() {
  return (process.env.VIDSLOOM_RENDER_QUEUE || "").trim();
}

function renderQueueLocation() {
  return (process.env.VIDSLOOM_RENDER_QUEUE_LOCATION || defaultQueueLocation()).trim();
}

function renderAutomationSecret() {
  return process.env.VIDSLOOM_AUTOMATION_SECRET?.trim() ?? "";
}
