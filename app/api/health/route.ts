import { NextResponse } from "next/server";

import { isQaAuthConfigured } from "@/lib/auth";
import { getGeminiRuntime } from "@/lib/gemini";
import { generatedAssetBucketName } from "@/lib/generated-asset-config";
import { mediaRuntimeStatus } from "@/lib/media-generation/gemini-media";
import { mediaQueueStatus } from "@/lib/media-generation/jobs";
import { planningQueueStatus } from "@/lib/planning-jobs";
import { publishingQueueStatus } from "@/lib/publishing-jobs";
import { getSendGridStatus } from "@/lib/sendgrid";
import { oauthProviderStatus } from "@/lib/social-oauth";
import { socialPostingStatus } from "@/lib/social-posting";
import { getStripeStatus } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const geminiRuntime = getGeminiRuntime();
  const followUpStatus = getSendGridStatus();
  const billingStatus = getStripeStatus();
  const planningQueue = planningQueueStatus();
  const mediaQueue = mediaQueueStatus();
  const mediaRuntime = mediaRuntimeStatus();
  const publishingQueue = publishingQueueStatus();
  const oauthStatus = oauthProviderStatus();
  const postingStatus = socialPostingStatus();

  return NextResponse.json({
    ok: true,
    app: "VIDSLOOM",
    env: process.env.VIDSLOOM_ENV ?? process.env.VIDLOOM_ENV ?? "local",
    storage: {
      configured: Boolean(process.env.VIDSLOOM_STORAGE ?? process.env.VIDLOOM_STORAGE)
    },
    generatedAssets: {
      renderEnabled: (process.env.VIDSLOOM_RENDER_DYNAMIC_ASSETS ?? "true").toLowerCase() !== "false",
      hasAssetStore: Boolean(generatedAssetBucketName()),
      maxAssetsPerCampaign: Number.parseInt(process.env.VIDSLOOM_RENDER_MAX_ASSETS ?? "5", 10),
      renderConcurrency: Number.parseInt(process.env.VIDSLOOM_RENDER_CONCURRENCY ?? "2", 10),
      queueConfigured: Boolean(process.env.VIDSLOOM_RENDER_QUEUE && process.env.VIDSLOOM_AUTOMATION_SECRET),
      workerUrlConfigured: Boolean(process.env.VIDSLOOM_RENDER_WORKER_URL)
    },
    planning: {
      queueConfigured: planningQueue.configured,
      workerUrlConfigured: planningQueue.workerUrlConfigured
    },
    mediaGeneration: {
      configured: mediaRuntime.configured,
      mediaGenerationEnabled: mediaRuntime.mediaGenerationEnabled,
      referenceFrameGenerationEnabled: mediaRuntime.referenceFrameGenerationEnabled,
      videoClipGenerationEnabled: mediaRuntime.videoClipGenerationEnabled,
      ttsEnabled: mediaRuntime.ttsEnabled,
      mediaBudgetCents: mediaRuntime.mediaBudgetCents,
      maxPremiumClips: mediaRuntime.maxPremiumClips,
      allowUnbudgetedGeneration: mediaRuntime.allowUnbudgetedGeneration,
      imageModelConfigured: mediaRuntime.imageModelConfigured,
      videoModelConfigured: mediaRuntime.videoModelConfigured,
      ttsModelConfigured: mediaRuntime.ttsModelConfigured,
      queueConfigured: mediaQueue.configured,
      workerUrlConfigured: mediaQueue.workerUrlConfigured
    },
    publishingAutomation: {
      queueConfigured: publishingQueue.configured,
      workerUrlConfigured: publishingQueue.workerUrlConfigured
    },
    socialPosting: {
      tokenVaultConfigured: postingStatus.tokenVaultConfigured,
      oauthProviders: oauthStatus.providers,
      directPlatforms: postingStatus.directPlatforms
    },
    ai: {
      configured: geminiRuntime.configured
    },
    auth: {
      configured: isQaAuthConfigured()
    },
    followUp: {
      configured: followUpStatus.configured,
      hasSender: followUpStatus.hasFromEmail,
      hasSalesContact: followUpStatus.hasSalesEmail,
      hasAutoresponder: followUpStatus.canSendLeadAutoresponder,
      hasOwnerNotification: followUpStatus.canSendOwnerNotification,
      autoresponderMode: followUpStatus.leadAutoresponderMode,
      ownerNotificationMode: followUpStatus.ownerNotificationMode,
      newsletterCaptureMode: followUpStatus.newsletterCaptureMode,
      externalListSyncMode: followUpStatus.externalListSyncMode,
      hasNewsletterCapture: true,
      canAttemptMarketingListSync: followUpStatus.canAttemptMarketingListSync,
      usesAutoresponderTemplate: followUpStatus.hasLeadTemplate,
      usesOwnerNotificationTemplate: followUpStatus.hasOwnerTemplate,
      marketingListCount: followUpStatus.marketingListCount,
      contactDbListCount: followUpStatus.contactDbListCount,
      listCount: followUpStatus.sendGridListCount
    },
    billing: {
      configured: billingStatus.configured,
      hasWebhookSecret: billingStatus.hasWebhookSecret,
      starterPriceConfigured: billingStatus.starterPriceConfigured,
      growthPriceConfigured: billingStatus.growthPriceConfigured,
      usingConfiguredPriceIds: billingStatus.usingConfiguredPriceIds,
      usesInlinePriceDataFallback: !billingStatus.usingConfiguredPriceIds,
      checkoutReady:
        billingStatus.configured &&
        (!billingStatus.usingConfiguredPriceIds ||
          (billingStatus.starterPriceConfigured && billingStatus.growthPriceConfigured)),
      checkoutMode: billingStatus.checkoutMode
    },
    timestamp: new Date().toISOString()
  });
}
