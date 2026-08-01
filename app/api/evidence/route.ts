import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import { sanitizePublicText } from "@/lib/public-campaign";
import { listAgentRuns, listCampaigns, listCustomerCampaignReviews, listPublishingAttempts } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const [campaigns, agentRuns, campaignReviews, publishingAttempts] = await Promise.all([
    listCampaigns(),
    listAgentRuns(150),
    listCustomerCampaignReviews(100),
    listPublishingAttempts({ limit: 500 })
  ]);
  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const attemptsByRow = new Map<string, typeof publishingAttempts>();
  publishingAttempts.forEach((attempt) => {
    const key = publishingAttemptKey(attempt.campaignId, attempt.customerId, attempt.taskKey);
    attemptsByRow.set(key, [...(attemptsByRow.get(key) ?? []), attempt]);
  });
  const reviewReports = campaignReviews.map((review) => {
    const campaign = campaignsById.get(review.campaignId);
    const publishingRows = review.publishingReviews.map((row) => {
      const metrics = {
        views: safeCount(row.performance.views),
        likes: safeCount(row.performance.likes),
        comments: safeCount(row.performance.comments),
        shares: safeCount(row.performance.shares),
        saves: safeCount(row.performance.saves),
        clicks: safeCount(row.performance.clicks),
        directMessages: safeCount(row.performance.directMessages),
        bookings: safeCount(row.performance.bookings),
        salesValue: safeMoney(row.performance.salesValue),
        currency: normalizeCurrency(row.performance.currency),
        engagement:
          safeCount(row.performance.likes) +
          safeCount(row.performance.comments) +
          safeCount(row.performance.shares) +
          safeCount(row.performance.saves) +
          safeCount(row.performance.clicks)
      };
      const directMetrics = {
        views: safeCount(row.performance.directViews),
        likes: safeCount(row.performance.directLikes),
        comments: safeCount(row.performance.directComments),
        shares: safeCount(row.performance.directShares),
        saves: safeCount(row.performance.directSaves),
        clicks: safeCount(row.performance.directClicks),
        engagement:
          safeCount(row.performance.directLikes) +
          safeCount(row.performance.directComments) +
          safeCount(row.performance.directShares) +
          safeCount(row.performance.directSaves) +
          safeCount(row.performance.directClicks)
      };
      const livePostUrl = safePublicUrl(row.performance.livePostUrl);
      const rowAttempts = attemptsByRow.get(publishingAttemptKey(review.campaignId, review.customerId, row.taskKey)) ?? [];
      const latestDirectAttempt = rowAttempts.find((attempt) => attempt.method === "direct-api") ?? null;
      const latestManualAttempt = rowAttempts.find((attempt) => attempt.method === "manual-assisted") ?? null;
      const directPublishUrl = safePublicUrl(latestDirectAttempt?.externalUrl ?? row.performance.directPostUrl);
      const directPublishStatus = latestDirectAttempt?.status ?? row.performance.directPostStatus;
      const directPublishProofCaptured =
        Boolean(directPublishUrl) ||
        directPublishStatus === "published" ||
        directPublishStatus === "queued" ||
        Object.values(directMetrics).some((value) => Number(value) > 0);
      const screenshotLinks = splitSafeLinks(row.performance.screenshotLinks);
      const hasProofCapture =
        Boolean(livePostUrl) ||
        directPublishProofCaptured ||
        screenshotLinks.length > 0 ||
        Boolean(row.performance.capturedAt) ||
        Boolean(row.performance.notes.trim()) ||
        Object.entries(metrics).some(([key, value]) => key !== "currency" && Number(value) > 0);

      return {
        taskKey: row.taskKey,
        conceptTitle: sanitizePublicText(row.conceptTitle).slice(0, 180),
        platform: row.platform,
        status: row.status,
        day: sanitizePublicText(row.day).slice(0, 80),
        scheduledFor: row.scheduledFor,
        autoPublishApproved: row.autoPublishApproved,
        livePostUrl,
        directPublish: latestDirectAttempt
          ? {
              status: directPublishStatus,
              method: latestDirectAttempt.method,
              externalUrl: directPublishUrl,
              externalPostId: sanitizePublicText(latestDirectAttempt.externalPostId).slice(0, 160),
              privacyStatus: sanitizePublicText(
                row.performance.directPostPrivacyStatus || latestDirectAttempt.providerResponse.privacyStatus || ""
              ).slice(0, 80),
              uploadStatus: sanitizePublicText(
                row.performance.directPostUploadStatus || latestDirectAttempt.providerResponse.uploadStatus || ""
              ).slice(0, 80),
              updatedAt: row.performance.directPostMetricsAt || row.performance.directPostCapturedAt || latestDirectAttempt.updatedAt,
              error: sanitizePublicText(latestDirectAttempt.error).slice(0, 500)
            }
          : row.performance.directPostUrl || row.performance.directPostStatus
          ? {
              status: sanitizePublicText(row.performance.directPostStatus).slice(0, 80),
              method: "direct-api",
              externalUrl: safePublicUrl(row.performance.directPostUrl),
              externalPostId: sanitizePublicText(row.performance.directPostId).slice(0, 160),
              privacyStatus: sanitizePublicText(row.performance.directPostPrivacyStatus).slice(0, 80),
              uploadStatus: sanitizePublicText(row.performance.directPostUploadStatus).slice(0, 80),
              updatedAt: row.performance.directPostMetricsAt || row.performance.directPostCapturedAt,
              error: ""
            }
          : null,
        manualFallback: latestManualAttempt
          ? {
              status: latestManualAttempt.status,
              method: latestManualAttempt.method,
              updatedAt: latestManualAttempt.updatedAt,
              error: sanitizePublicText(latestManualAttempt.error).slice(0, 500)
            }
          : null,
        screenshotLinks,
        metrics,
        directMetrics,
        directNotes: sanitizePublicText(row.performance.directNotes).slice(0, 700),
        notes: sanitizePublicText(row.performance.notes).slice(0, 700),
        capturedAt: row.performance.capturedAt,
        followUp24hSentAt: row.performance.followUp24hSentAt,
        followUp48hSentAt: row.performance.followUp48hSentAt,
        hasProofCapture
      };
    });
    const aggregate = aggregatePublishingRows(publishingRows);

    return {
      id: review.id,
      customerId: review.customerId,
      campaignId: review.campaignId,
      updatedAt: review.updatedAt,
      overallStatus: review.overallStatus,
      businessName: sanitizePublicText(campaign?.intake.businessName ?? "Customer campaign").slice(0, 120),
      industry: sanitizePublicText(campaign?.intake.industry ?? "").slice(0, 120),
      offer: sanitizePublicText(campaign?.intake.offer ?? "").slice(0, 240),
      goal: sanitizePublicText(campaign?.intake.goal ?? "").slice(0, 240),
      platforms: campaign?.intake.platforms ?? [],
      campaignCreatedAt: campaign?.createdAt ?? "",
      approvedVideos: review.videoReviews.filter((item) => item.status === "approved").length,
      changeRequests: review.videoReviews.filter((item) => item.status === "changes-requested" || item.status === "regenerate").length,
      readyTasks: review.publishingReviews.filter((item) => item.status === "ready-to-schedule" || item.status === "scheduled").length,
      proofPermission: review.proofPermission,
      hasProofNotes: Boolean(review.proofNotes.trim()),
      proofNotes: sanitizePublicText(review.proofNotes).slice(0, 600),
      customerNotes: sanitizePublicText(review.customerNotes).slice(0, 600),
      publishingRows,
      aggregate
    };
  });
  const allRows = reviewReports.flatMap((review) => review.publishingRows);
  const salesByCurrency = aggregateSalesByCurrency(allRows);

  return NextResponse.json({
    summary: {
      campaignCount: campaigns.length,
      agentRunCount: agentRuns.length,
      campaignReviewCount: campaignReviews.length,
      approvedReviewCount: campaignReviews.filter((review) =>
        ["approved", "ready-to-schedule", "scheduled"].includes(review.overallStatus)
      ).length,
      proofPermissionCount: campaignReviews.filter((review) => review.proofPermission).length,
      proofCapturedCount: allRows.filter((row) => row.hasProofCapture).length,
      livePostCount: allRows.filter((row) => row.livePostUrl).length,
      directPublishedCount: allRows.filter((row) => row.directPublish?.status === "published").length,
      totalDirectViews: allRows.reduce((total, row) => total + row.directMetrics.views, 0),
      totalDirectEngagement: allRows.reduce((total, row) => total + row.directMetrics.engagement, 0),
      screenshotProofCount: allRows.reduce((total, row) => total + row.screenshotLinks.length, 0),
      totalViews: allRows.reduce((total, row) => total + row.metrics.views, 0),
      totalEngagement: allRows.reduce((total, row) => total + row.metrics.engagement, 0),
      totalDirectMessages: allRows.reduce((total, row) => total + row.metrics.directMessages, 0),
      totalBookings: allRows.reduce((total, row) => total + row.metrics.bookings, 0),
      salesByCurrency,
      latestCampaignAt: campaigns[0]?.createdAt ?? null,
      aiGeneratedCampaigns: campaigns.filter((campaign) => campaign.mode === "gemini").length,
      offlineFallbackCampaigns: campaigns.filter((campaign) => campaign.mode === "fallback").length
    },
    campaigns: campaigns.map((campaign) => ({
      createdAt: campaign.createdAt,
      generationStatus: campaign.mode === "gemini" ? "ai-generated" : "offline-fallback",
      businessName: sanitizePublicText(campaign.intake.businessName),
      platforms: campaign.intake.platforms,
      videoConceptCount: campaign.pack.videoConcepts.length,
      videoAssetCount: campaign.pack.videoAssets.length || campaign.pack.videoConcepts.length
    })),
    agentRuns: agentRuns.map((run) => ({
      agentName: run.agentName,
      status: run.status,
      promptVersion: run.promptVersion,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      inputSummary: sanitizePublicText(run.inputSummary),
      outputSummary:
        run.status === "completed"
          ? `${run.agentName} completed its campaign-planning responsibility.`
          : `${run.agentName} prepared a review-safe planning draft for this run.`
    })),
    campaignReviews: reviewReports
  });
}

type EvidencePublishingRow = ReturnType<typeof buildPublishingRowForAggregation>;

function buildPublishingRowForAggregation(row: {
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    directMessages: number;
    bookings: number;
    salesValue: number;
    currency: string;
    engagement: number;
  };
  livePostUrl: string;
  directPublish?: {
    status: string;
    method: string;
    externalUrl: string;
    externalPostId: string;
    privacyStatus: string;
    uploadStatus: string;
    updatedAt: string;
    error: string;
  } | null;
  directMetrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    engagement: number;
  };
  screenshotLinks: string[];
  hasProofCapture: boolean;
}) {
  return row;
}

function safeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function safeMoney(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

function normalizeCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "SGD";
}

function safePublicUrl(value: string) {
  const raw = sanitizePublicText(value).trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function splitSafeLinks(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => safePublicUrl(item))
    .filter(Boolean)
    .slice(0, 8);
}

function aggregatePublishingRows(rows: EvidencePublishingRow[]) {
  return {
    publishedRows: rows.filter((row) => row.livePostUrl || row.directPublish?.externalUrl).length,
    proofCapturedRows: rows.filter((row) => row.hasProofCapture).length,
    screenshotCount: rows.reduce((total, row) => total + row.screenshotLinks.length, 0),
    views: rows.reduce((total, row) => total + row.metrics.views, 0),
    engagement: rows.reduce((total, row) => total + row.metrics.engagement, 0),
    directViews: rows.reduce((total, row) => total + row.directMetrics.views, 0),
    directEngagement: rows.reduce((total, row) => total + row.directMetrics.engagement, 0),
    directMessages: rows.reduce((total, row) => total + row.metrics.directMessages, 0),
    bookings: rows.reduce((total, row) => total + row.metrics.bookings, 0),
    salesByCurrency: aggregateSalesByCurrency(rows)
  };
}

function publishingAttemptKey(campaignId: string, customerId: string, taskKey: string) {
  return `${campaignId}::${customerId}::${taskKey}`;
}

function aggregateSalesByCurrency(rows: EvidencePublishingRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    if (row.metrics.salesValue <= 0) return;
    totals.set(row.metrics.currency, (totals.get(row.metrics.currency) ?? 0) + row.metrics.salesValue);
  });

  return Array.from(totals.entries())
    .map(([currency, value]) => ({ currency, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}
