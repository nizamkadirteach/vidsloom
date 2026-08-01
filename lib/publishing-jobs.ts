import "server-only";

import { buildCustomerPortalUrl, ensureCustomerPortalAccess } from "@/lib/customer-access";
import { createId } from "@/lib/id";
import { triggerPublishingNotifications } from "@/lib/sendgrid";
import { executePublishingAction, publishingTaskKey, refreshPublishingAttemptMetrics } from "@/lib/social-posting";
import { defaultQueueLocation, enqueueHttpTask, queueStatus, type TaskEnqueueResult } from "@/lib/task-queue";
import {
  Campaign,
  CustomerCampaignReview,
  CustomerOnboarding,
  CustomerPublishingReviewSchema,
  PublishingAttempt
} from "@/lib/schemas";
import {
  getCampaign,
  getBillingCustomer,
  getCustomerOnboardingByCustomerId,
  listCustomerCampaignReviews,
  listPublishingAttempts,
  saveBillingCustomer,
  saveCustomerCampaignReview
} from "@/lib/storage";

type PublishingDecision =
  | {
      ok: true;
      row: CustomerCampaignReview["publishingReviews"][number];
      scheduleTime: string;
    }
  | {
      ok: false;
      reason: string;
    };

type PublishingProofFollowUpType = "proof-24h" | "proof-48h";

export function publishingQueueStatus() {
  return queueStatus({
    queueName: publishingQueueName(),
    location: publishingQueueLocation(),
    workerUrl: process.env.VIDSLOOM_PUBLISHING_WORKER_URL
  });
}

export async function enqueuePublishingJob({
  campaignId,
  customerId,
  taskKey,
  origin,
  scheduleTime
}: {
  campaignId: string;
  customerId: string;
  taskKey: string;
  origin: string;
  scheduleTime: string;
}): Promise<TaskEnqueueResult> {
  const url = process.env.VIDSLOOM_PUBLISHING_WORKER_URL || new URL("/api/publishing/jobs", origin).toString();
  return enqueueHttpTask({
    queueName: publishingQueueName(),
    location: publishingQueueLocation(),
    url,
    scheduleTime,
    body: {
      campaignId,
      customerId,
      taskKey
    },
    unavailableReason: "Cloud Tasks publishing queue or automation secret is not configured."
  });
}

export async function enqueuePublishingFollowUp({
  campaignId,
  customerId,
  taskKey,
  followUpType,
  origin,
  scheduleTime
}: {
  campaignId: string;
  customerId: string;
  taskKey: string;
  followUpType: PublishingProofFollowUpType;
  origin: string;
  scheduleTime: string;
}): Promise<TaskEnqueueResult> {
  const url = process.env.VIDSLOOM_PUBLISHING_WORKER_URL || new URL("/api/publishing/jobs", origin).toString();
  return enqueueHttpTask({
    queueName: publishingQueueName(),
    location: publishingQueueLocation(),
    url,
    scheduleTime,
    body: {
      campaignId,
      customerId,
      taskKey,
      followUpType
    },
    unavailableReason: "Cloud Tasks publishing queue or automation secret is not configured."
  });
}

export async function enqueueApprovedPublishingTasks({
  review,
  campaign,
  onboarding,
  origin,
  force = false
}: {
  review: CustomerCampaignReview;
  campaign: Campaign;
  onboarding: CustomerOnboarding | null;
  origin: string;
  force?: boolean;
}) {
  const now = new Date().toISOString();
  const results: Array<{
    taskKey: string;
    queued: boolean;
    scheduleTime?: string;
    taskName?: string;
    reason?: string;
  }> = [];

  const publishingReviews = await Promise.all(
    review.publishingReviews.map(async (row) => {
      const decision = publishingDecision({ review, campaign, onboarding, row, now });
      if (!decision.ok) {
        results.push({
          taskKey: row.taskKey,
          queued: false,
          reason: decision.reason
        });
        return row;
      }

      if (!force && row.publishingJobId && row.publishingJobQueuedAt) {
        results.push({
          taskKey: row.taskKey,
          queued: false,
          scheduleTime: decision.scheduleTime,
          reason: "Publishing job is already queued."
        });
        return row;
      }

      const hasExisting = await hasExistingFinalOrActiveAttempt({
        campaignId: campaign.id,
        customerId: review.customerId,
        taskKey: row.taskKey
      });
      if (hasExisting && !force) {
        results.push({
          taskKey: row.taskKey,
          queued: false,
          scheduleTime: decision.scheduleTime,
          reason: "A publishing attempt is already active or complete."
        });
        return row;
      }

      const queue = await enqueuePublishingJob({
        campaignId: campaign.id,
        customerId: review.customerId,
        taskKey: row.taskKey,
        origin,
        scheduleTime: decision.scheduleTime
      }).catch(
        (error): TaskEnqueueResult => ({
          queued: false,
          mode: "manual" as const,
          reason: error instanceof Error ? error.message : "Publishing queue failed."
        })
      );

      results.push({
        taskKey: row.taskKey,
        queued: queue.queued,
        scheduleTime: decision.scheduleTime,
        taskName: queue.taskName,
        reason: queue.reason
      });

      return CustomerPublishingReviewSchema.parse({
        ...row,
        scheduledFor: decision.scheduleTime,
        publishingJobId: queue.taskName ?? row.publishingJobId,
        publishingJobQueuedAt: queue.queued ? now : row.publishingJobQueuedAt,
        publishingError: queue.queued ? "" : queue.reason ?? row.publishingError
      });
    })
  );

  let updatedReview = await saveCustomerCampaignReview({
    ...review,
    publishingReviews,
    updatedAt: now
  });

  await notifyQueuedPublishingJobs({
    campaign,
    review: updatedReview,
    results,
    origin
  });

  return {
    review: updatedReview,
    results
  };
}

export async function runPublishingJob({
  campaignId,
  customerId = "",
  taskKey,
  origin,
  force = false,
  dryRun = false
}: {
  campaignId: string;
  customerId?: string;
  taskKey: string;
  origin: string;
  force?: boolean;
  dryRun?: boolean;
}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return {
      ok: false,
      status: "not-found" as const,
      reason: "Campaign not found."
    };
  }

  const review = (await listCustomerCampaignReviews(500)).find(
    (item) => item.campaignId === campaign.id && (!customerId || item.customerId === customerId)
  );
  const onboarding = await getCustomerOnboardingByCustomerId(review?.customerId || campaign.customerId || customerId);
  const row = review?.publishingReviews.find((item) => item.taskKey === taskKey);
  if (!review || !row) {
    return {
      ok: false,
      status: "not-ready" as const,
      reason: "Customer publishing approval was not found."
    };
  }

  const decision = publishingDecision({ review, campaign, onboarding, row, now: new Date().toISOString() });
  if (!decision.ok && !force) {
    return {
      ok: true,
      status: "skipped" as const,
      reason: decision.reason,
      review,
      campaign
    };
  }

  const scheduledAt = decision.ok ? Date.parse(decision.scheduleTime) : Date.now();
  if (!force && Number.isFinite(scheduledAt) && scheduledAt > Date.now()) {
    return {
      ok: true,
      status: "not-due" as const,
      scheduleTime: decision.ok ? decision.scheduleTime : "",
      review,
      campaign
    };
  }

  if (await hasExistingFinalOrActiveAttempt({ campaignId, customerId: review.customerId, taskKey })) {
    return {
      ok: true,
      status: "already-active-or-published" as const,
      review,
      campaign
    };
  }

  if (dryRun) {
    return {
      ok: true,
      status: "dry-run-ready" as const,
      scheduleTime: decision.ok ? decision.scheduleTime : "",
      review,
      campaign
    };
  }

  const attempt = await executePublishingAction({
    campaignId,
    taskKey,
    method: "direct-api",
    origin,
    requestedBy: "system",
    customerId: review.customerId
  });
  const manualFallback =
    attempt.status === "blocked" || attempt.status === "failed"
      ? await executePublishingAction({
          campaignId,
          taskKey,
          method: "manual-assisted",
          origin,
          requestedBy: "system",
          customerId: review.customerId
        }).catch(() => null)
      : null;

  const now = new Date().toISOString();
  const updatedPublishingReviews = review.publishingReviews.map((item) => {
    if (item.taskKey !== taskKey) return item;
    return CustomerPublishingReviewSchema.parse({
      ...item,
      status:
        attempt.status === "blocked" || attempt.status === "failed"
          ? "blocked"
          : ["published", "queued"].includes(attempt.status)
            ? "scheduled"
            : item.status,
      publishingError:
        attempt.status === "blocked" || attempt.status === "failed"
          ? [attempt.error, manualFallback ? "Manual posting kit prepared automatically." : ""].filter(Boolean).join(" ")
          : "",
      updatedAt: now
    });
  });
  let updatedReview = await saveCustomerCampaignReview({
    ...review,
    publishingReviews: updatedPublishingReviews,
    updatedAt: now
  });
  const updatedRow = updatedReview.publishingReviews.find((item) => item.taskKey === taskKey) ?? row;
  await notifyPublishingAttemptResult({
    campaign,
    review: updatedReview,
    row: updatedRow,
    attempt,
    manualFallback,
    origin
  });
  if (attempt.status === "published" || attempt.status === "queued") {
    updatedReview = await enqueueProofFollowUpTasks({
      campaign,
      review: updatedReview,
      row: updatedRow,
      attempt,
      origin
    });
  }

  return {
    ok: true,
    status: attempt.status,
    attempt,
    manualFallback,
    review: updatedReview,
    campaign
  };
}

export async function runPublishingProofFollowUp({
  campaignId,
  customerId = "",
  taskKey,
  followUpType,
  origin
}: {
  campaignId: string;
  customerId?: string;
  taskKey: string;
  followUpType: PublishingProofFollowUpType;
  origin: string;
}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return {
      ok: false,
      status: "not-found" as const,
      reason: "Campaign not found."
    };
  }

  const review = (await listCustomerCampaignReviews(500)).find(
    (item) => item.campaignId === campaign.id && (!customerId || item.customerId === customerId)
  );
  const row = review?.publishingReviews.find((item) => item.taskKey === taskKey);
  if (!review || !row) {
    return {
      ok: false,
      status: "not-ready" as const,
      reason: "Customer publishing approval was not found."
    };
  }

  const now = new Date().toISOString();
  const attempts = await listPublishingAttempts({ campaignId, customerId: review.customerId, limit: 200 });
  const attempt = attempts
    .filter((item) => item.taskKey === taskKey)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const metricsSync =
    attempt && (attempt.status === "published" || attempt.status === "queued")
      ? await refreshPublishingAttemptMetrics({ attempt, campaign })
      : null;
  await notifyPublishing({
    event: followUpType,
    campaign,
    review,
    row,
    attempt,
    origin,
    reason: followUpType === "proof-24h" ? "24-hour proof follow-up." : "48-hour proof follow-up."
  });

  const updatedPublishingReviews = review.publishingReviews.map((item) => {
    if (item.taskKey !== taskKey) return item;
    return CustomerPublishingReviewSchema.parse({
      ...item,
      performance: updatePerformanceWithMetricsSync(
        {
          ...item.performance,
          [followUpType === "proof-24h" ? "followUp24hSentAt" : "followUp48hSentAt"]: now
        },
        metricsSync
      ),
      updatedAt: now
    });
  });
  const updatedReview = await saveCustomerCampaignReview({
    ...review,
    publishingReviews: updatedPublishingReviews,
    updatedAt: now
  });

  return {
    ok: true,
    status: followUpType,
    review: updatedReview,
    campaign,
    attempt
  };
}

export async function runPublishingSweep({
  origin,
  limit = 50,
  force = false,
  dryRun = false
}: {
  origin: string;
  limit?: number;
  force?: boolean;
  dryRun?: boolean;
}) {
  const reviews = await listCustomerCampaignReviews(Math.min(Math.max(limit, 1), 500));
  const results: Array<{
    campaignId: string;
    customerId: string;
    taskKey: string;
    status: string;
    reason?: string;
    attempt?: PublishingAttempt;
  }> = [];

  for (const review of reviews) {
    const campaign = await getCampaign(review.campaignId);
    if (!campaign) continue;
    const onboarding = await getCustomerOnboardingByCustomerId(review.customerId);
    for (const row of review.publishingReviews) {
      if (results.length >= limit) break;
      const decision = publishingDecision({ review, campaign, onboarding, row, now: new Date().toISOString() });
      if (!decision.ok) continue;
      if (!force && Date.parse(decision.scheduleTime) > Date.now()) continue;
      const result = await runPublishingJob({
        campaignId: campaign.id,
        customerId: review.customerId,
        taskKey: row.taskKey,
        origin,
        force,
        dryRun
      });
      results.push({
        campaignId: campaign.id,
        customerId: review.customerId,
        taskKey: row.taskKey,
        status: result.status,
        reason: "reason" in result ? result.reason : undefined,
        attempt: "attempt" in result ? result.attempt : undefined
      });
    }
  }

  return {
    ok: true,
    attempted: results.length,
    results
  };
}

async function notifyQueuedPublishingJobs({
  campaign,
  review,
  results,
  origin
}: {
  campaign: Campaign;
  review: CustomerCampaignReview;
  results: Array<{
    taskKey: string;
    queued: boolean;
    scheduleTime?: string;
    taskName?: string;
    reason?: string;
  }>;
  origin: string;
}) {
  await Promise.all(
    results
      .filter((result) => result.queued)
      .map(async (result) => {
        const row = review.publishingReviews.find((item) => item.taskKey === result.taskKey);
        if (!row) return;
        await notifyPublishing({
          event: "queued",
          campaign,
          review,
          row,
          origin,
          reason: result.scheduleTime ? `Scheduled for ${result.scheduleTime}.` : undefined
        });
      })
  );
}

async function notifyPublishingAttemptResult({
  campaign,
  review,
  row,
  attempt,
  manualFallback,
  origin
}: {
  campaign: Campaign;
  review: CustomerCampaignReview;
  row: CustomerCampaignReview["publishingReviews"][number];
  attempt: PublishingAttempt;
  manualFallback?: PublishingAttempt | null;
  origin: string;
}) {
  const event =
    attempt.status === "published"
      ? "published"
      : attempt.status === "queued"
        ? "submitted"
        : attempt.status === "blocked" || attempt.status === "failed"
          ? attempt.status
          : null;
  if (!event) return;

  await notifyPublishing({
    event,
    campaign,
    review,
    row,
    attempt,
    manualFallback,
    origin,
    reason: attempt.error || undefined
  });
}

async function enqueueProofFollowUpTasks({
  campaign,
  review,
  row,
  attempt,
  origin
}: {
  campaign: Campaign;
  review: CustomerCampaignReview;
  row: CustomerCampaignReview["publishingReviews"][number];
  attempt: PublishingAttempt;
  origin: string;
}) {
  const now = new Date().toISOString();
  const performance = row.performance;
  const publishingReviews = await Promise.all(
    review.publishingReviews.map(async (item) => {
      if (item.taskKey !== row.taskKey) return item;
      const followUp24h =
        performance.followUp24hJobId || performance.followUp24hSentAt
          ? null
          : await enqueuePublishingFollowUp({
              campaignId: campaign.id,
              customerId: review.customerId,
              taskKey: row.taskKey,
              followUpType: "proof-24h",
              origin,
              scheduleTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }).catch(() => null);
      const followUp48h =
        performance.followUp48hJobId || performance.followUp48hSentAt
          ? null
          : await enqueuePublishingFollowUp({
              campaignId: campaign.id,
              customerId: review.customerId,
              taskKey: row.taskKey,
              followUpType: "proof-48h",
              origin,
              scheduleTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            }).catch(() => null);

      return CustomerPublishingReviewSchema.parse({
        ...item,
        performance: {
          ...item.performance,
          livePostUrl: item.performance.livePostUrl || attempt.externalUrl,
          directPostUrl: attempt.externalUrl || item.performance.directPostUrl,
          directPostId: attempt.externalPostId || item.performance.directPostId,
          directPostStatus: attempt.status,
          directPostPrivacyStatus:
            attempt.providerResponse.privacyStatus || item.performance.directPostPrivacyStatus,
          directPostUploadStatus: attempt.providerResponse.uploadStatus || item.performance.directPostUploadStatus,
          directPostCapturedAt: item.performance.directPostCapturedAt || now,
          followUp24hJobId: followUp24h?.taskName ?? item.performance.followUp24hJobId,
          followUp48hJobId: followUp48h?.taskName ?? item.performance.followUp48hJobId,
          capturedAt: item.performance.capturedAt || now
        },
        updatedAt: now
      });
    })
  );

  return saveCustomerCampaignReview({
    ...review,
    publishingReviews,
    updatedAt: now
  });
}

function updatePerformanceWithMetricsSync(
  performance: CustomerCampaignReview["publishingReviews"][number]["performance"],
  metricsSync: Awaited<ReturnType<typeof refreshPublishingAttemptMetrics>> | null
) {
  if (!metricsSync) return performance;

  if (!metricsSync.ok) {
    return {
      ...performance,
      directPostMetricsAt: metricsSync.capturedAt,
      directNotes: appendPerformanceNote(
        performance.directNotes,
        metricsSync.reconnectRequired
          ? `Metrics refresh needs reconnect: ${metricsSync.reason}`
          : `Metrics refresh skipped: ${metricsSync.reason}`
      )
    };
  }

  return {
    ...performance,
    directPostUrl: metricsSync.externalUrl || performance.directPostUrl,
    directPostId: metricsSync.externalPostId || performance.directPostId,
    directPostStatus: "published",
    directPostPrivacyStatus: metricsSync.privacyStatus || performance.directPostPrivacyStatus,
    directPostUploadStatus: metricsSync.uploadStatus || performance.directPostUploadStatus,
    directPostMetricsAt: metricsSync.capturedAt,
    directPostCapturedAt: performance.directPostCapturedAt || metricsSync.capturedAt,
    directViews: metricsSync.views,
    directLikes: metricsSync.likes,
    directComments: metricsSync.comments,
    directShares: metricsSync.shares,
    directSaves: metricsSync.saves,
    directClicks: metricsSync.clicks,
    directNotes: appendPerformanceNote(performance.directNotes, metricsSync.note)
  };
}

function appendPerformanceNote(existing: string, next: string) {
  const text = [existing, next].filter(Boolean).join("\n").trim();
  return text.length > 1800 ? text.slice(0, 1797).trimEnd() + "..." : text;
}

async function notifyPublishing({
  event,
  campaign,
  review,
  row,
  attempt,
  manualFallback,
  origin,
  reason
}: {
  event: "queued" | "published" | "submitted" | "blocked" | "failed" | PublishingProofFollowUpType;
  campaign: Campaign;
  review: CustomerCampaignReview;
  row: CustomerCampaignReview["publishingReviews"][number];
  attempt?: PublishingAttempt;
  manualFallback?: PublishingAttempt | null;
  origin: string;
  reason?: string;
}) {
  try {
    const customer = await getBillingCustomer(review.customerId);
    if (!customer) return;
    const portalCustomer = await ensureCustomerPortalAccess(customer);
    const portalUrl = buildCustomerPortalUrl(origin, portalCustomer);
    const notification = await triggerPublishingNotifications({
      event,
      customer: portalCustomer,
      campaign,
      row,
      portalUrl,
      attempt,
      manualFallback,
      reason
    });
    await appendCustomerPublishingEvent({
      customer: portalCustomer,
      event,
      row,
      notificationConfigured: notification.configured
    });
  } catch {
    // Publishing outcomes must not fail because notification delivery failed.
  }
}

async function appendCustomerPublishingEvent({
  customer,
  event,
  row,
  notificationConfigured
}: {
  customer: Awaited<ReturnType<typeof ensureCustomerPortalAccess>>;
  event: string;
  row: CustomerCampaignReview["publishingReviews"][number];
  notificationConfigured: boolean;
}) {
  await saveBillingCustomer({
    ...customer,
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: createId("bill_event"),
        createdAt: new Date().toISOString(),
        type: "note" as const,
        summary: `Publishing ${event}: ${row.platform} - ${row.conceptTitle}. Notifications ${notificationConfigured ? "attempted" : "not configured"}.`,
        stripeEventId: ""
      },
      ...customer.events
    ].slice(0, 80)
  });
}

function publishingDecision({
  review,
  campaign,
  onboarding,
  row,
  now
}: {
  review: CustomerCampaignReview;
  campaign: Campaign;
  onboarding: CustomerOnboarding | null;
  row: CustomerCampaignReview["publishingReviews"][number];
  now: string;
}): PublishingDecision {
  if (campaign.planningStatus !== "pack-ready") return { ok: false, reason: "Campaign planning is not complete." };
  if (!onboarding?.autoPostingIntent) return { ok: false, reason: "Customer has not enabled auto-posting intent." };
  if (onboarding.publishingMode === "manual-only") return { ok: false, reason: "Customer selected manual-only publishing." };
  if (!onboarding.understandsOauth) return { ok: false, reason: "Customer has not acknowledged OAuth publishing permissions." };

  const task = campaign.pack.publishingQueue.find((item) => publishingTaskKey(item) === row.taskKey);
  if (!task) return { ok: false, reason: "Publishing task no longer exists in campaign." };

  const videoApproved = review.videoReviews.some(
    (item) => item.conceptTitle === row.conceptTitle && item.status === "approved"
  );
  if (!videoApproved) return { ok: false, reason: "Matching video concept is not approved." };

  const concept = campaign.pack.videoConcepts.find((item) => item.title === row.conceptTitle);
  if (concept?.qualityGate.status !== "pass") {
    const gate = concept?.qualityGate;
    return {
      ok: false,
      reason: gate
        ? `Quality gate is ${gate.status} (${gate.score}/${gate.minPublishScore}). ${gate.publishBlockers[0] || gate.nextActions[0] || "Resolve proof, claim, storyboard, and QA checks before publishing."}`
        : "Quality gate is missing for this concept."
    };
  }

  const approvedForAuto =
    row.autoPublishApproved || row.status === "scheduled" || onboarding.approvalPolicy === "auto-publish-after-24h";
  if (!approvedForAuto) return { ok: false, reason: "Publishing row is not approved for auto-posting." };
  if (row.status === "blocked" || row.status === "changes-requested" || row.status === "regenerate") {
    return { ok: false, reason: `Publishing row is ${row.status}.` };
  }

  const scheduleTime = scheduleTimeFor(row, onboarding, now);
  if (!scheduleTime) return { ok: false, reason: "No auto-publish time has been set." };
  return {
    ok: true,
    row,
    scheduleTime
  };
}

function scheduleTimeFor(
  row: CustomerCampaignReview["publishingReviews"][number],
  onboarding: CustomerOnboarding,
  now: string
) {
  if (row.scheduledFor && Number.isFinite(Date.parse(row.scheduledFor))) {
    return new Date(row.scheduledFor).toISOString();
  }

  if (onboarding.approvalPolicy === "auto-publish-after-24h" && row.updatedAt) {
    const base = Number.isFinite(Date.parse(row.updatedAt)) ? Date.parse(row.updatedAt) : Date.parse(now);
    return new Date(base + 24 * 60 * 60 * 1000).toISOString();
  }

  return "";
}

async function hasExistingFinalOrActiveAttempt({
  campaignId,
  customerId,
  taskKey
}: {
  campaignId: string;
  customerId: string;
  taskKey: string;
}) {
  const attempts = await listPublishingAttempts({ campaignId, customerId, limit: 200 });
  return attempts.some(
    (attempt) =>
      attempt.taskKey === taskKey && ["queued", "publishing", "published"].includes(attempt.status)
  );
}

function publishingQueueName() {
  return (process.env.VIDSLOOM_PUBLISHING_QUEUE || "").trim();
}

function publishingQueueLocation() {
  return (process.env.VIDSLOOM_PUBLISHING_QUEUE_LOCATION || defaultQueueLocation()).trim();
}
