import "server-only";

import { getSendGridStatus } from "@/lib/sendgrid";
import {
  getGeminiFallbackModel,
  getGeminiModel,
  getGeminiRuntime,
  getPromptVersion
} from "@/lib/gemini";
import { mediaRuntimeStatus } from "@/lib/media-generation/gemini-media";
import {
  listBillingCustomers,
  listCampaigns,
  listCustomerCampaignReviews,
  listNewsletterEmailEvents,
  listOpsAlertSuppressions,
  listPublishingAttempts,
  listSocialConnections
} from "@/lib/storage";

type OpsAlertSeverity = "critical" | "warning" | "info";
type OpsAlertArea = "ai" | "planning" | "rendering" | "publishing" | "billing" | "email" | "social" | "configuration";

export type OpsAlert = {
  id: string;
  severity: OpsAlertSeverity;
  area: OpsAlertArea;
  title: string;
  detail: string;
  action: string;
  createdAt: string;
  customerId?: string;
  campaignId?: string;
  taskKey?: string;
  suppressed?: boolean;
  suppressedUntil?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgementNote?: string;
};

type OpsAlertBuildOptions = {
  nowIso?: string;
  includeSuppressed?: boolean;
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function buildOpsAlerts(options: string | OpsAlertBuildOptions = {}) {
  const nowIso = typeof options === "string" ? options : options.nowIso ?? new Date().toISOString();
  const includeSuppressed = typeof options === "object" ? options.includeSuppressed ?? false : false;
  const now = Date.parse(nowIso);
  const [campaigns, reviews, attempts, emailEvents, customers, socialConnections, suppressions] = await Promise.all([
    listCampaigns(),
    listCustomerCampaignReviews(500),
    listPublishingAttempts({ limit: 500 }),
    listNewsletterEmailEvents(500),
    listBillingCustomers(500),
    listSocialConnections(),
    listOpsAlertSuppressions({ limit: 3000 })
  ]);

  const alerts: OpsAlert[] = [];
  const geminiRuntime = getGeminiRuntime();
  const primaryModel = getGeminiModel();
  const fallbackModel = getGeminiFallbackModel();
  const mediaRuntime = mediaRuntimeStatus();

  if (!geminiRuntime.configured) {
    alerts.push({
      id: "ai-gemini-unconfigured",
      severity: "critical",
      area: "ai",
      title: "AI generation is not configured",
      detail: "Campaign generation will use deterministic fallback because the Gemini runtime is not configured.",
      action: "Configure the active Gemini runtime before taking paid customer generation jobs.",
      createdAt: nowIso
    });
  }

  if (mediaRuntime.mediaGenerationEnabled && mediaRuntime.mediaBudgetCents <= 0 && !mediaRuntime.allowUnbudgetedGeneration) {
    alerts.push({
      id: "ai-media-budget-not-configured",
      severity: "critical",
      area: "ai",
      title: "AI media generation has no budget cap",
      detail: "Media generation is enabled, but no per-campaign media budget is configured, so paid clip generation will be blocked.",
      action: "Set VIDSLOOM_MEDIA_BUDGET_PER_CAMPAIGN_CENTS for the environment before running paid media jobs.",
      createdAt: nowIso
    });
  }

  if (mediaRuntime.mediaGenerationEnabled && mediaRuntime.allowUnbudgetedGeneration) {
    alerts.push({
      id: "ai-media-unbudgeted-generation-allowed",
      severity: "warning",
      area: "ai",
      title: "Unbudgeted AI media generation is allowed",
      detail: "The active environment allows media generation without a per-campaign spend cap.",
      action: "Use this only for controlled staging tests, then disable VIDSLOOM_ALLOW_UNBUDGETED_MEDIA_GENERATION or set a budget cap.",
      createdAt: nowIso
    });
  }

  for (const campaign of campaigns) {
    if (campaign.mode === "fallback" && now - timestamp(campaign.planningCompletedAt || campaign.createdAt) <= SEVEN_DAYS_MS) {
      alerts.push({
        id: `ai-deterministic-fallback-${campaign.id}`,
        severity: campaign.source === "customer-portal" ? "critical" : "warning",
        area: "ai",
        title: "Campaign used deterministic fallback",
        detail: `${campaign.intake.businessName} received a deterministic fallback pack instead of a Gemini-generated pack.`,
        action: "Check Gemini quota and worker logs, then force-retry planning so the customer receives a real AI-generated pack.",
        createdAt: campaign.planningCompletedAt || campaign.createdAt,
        customerId: campaign.customerId,
        campaignId: campaign.id
      });
    }

    if (
      campaign.mode === "gemini" &&
      fallbackModel &&
      fallbackModel !== primaryModel &&
      campaign.agentRuns.some((run) => run.model === fallbackModel)
    ) {
      alerts.push({
        id: `ai-secondary-model-${campaign.id}`,
        severity: "warning",
        area: "ai",
        title: "Campaign used secondary AI model",
        detail: `${campaign.intake.businessName} was generated with the configured secondary AI model after the primary model was unavailable.`,
        action: "Review Vertex/Gemini quota and error logs for the primary model; keep the secondary model enabled until quota is stable.",
        createdAt: campaign.planningCompletedAt || campaign.createdAt,
        customerId: campaign.customerId,
        campaignId: campaign.id
      });
    }

    if (campaign.planningStatus === "planning-failed") {
      alerts.push({
        id: `planning-failed-${campaign.id}`,
        severity: "critical",
        area: "planning",
        title: "Campaign planning failed",
        detail: campaign.planningError || `${campaign.intake.businessName} did not receive a completed campaign pack.`,
        action: "Retry planning from the QA workspace or regenerate the customer campaign.",
        createdAt: campaign.planningCompletedAt || campaign.createdAt,
        customerId: campaign.customerId,
        campaignId: campaign.id
      });
    }

    if (campaign.planningStatus === "planning" || campaign.planningStatus === "planning-queued") {
      const startedAt = timestamp(campaign.planningStartedAt || campaign.planningQueuedAt || campaign.createdAt);
      if (now - startedAt > THIRTY_MINUTES_MS) {
        alerts.push({
          id: `planning-stale-${campaign.id}`,
          severity: "warning",
          area: "planning",
          title: "Campaign planning is taking too long",
          detail: `${campaign.intake.businessName} has been in ${campaign.planningStatus.replaceAll("-", " ")} for more than 30 minutes.`,
          action: "Check the planning queue, worker logs, and AI service status.",
          createdAt: campaign.planningStartedAt || campaign.planningQueuedAt || campaign.createdAt,
          customerId: campaign.customerId,
          campaignId: campaign.id
        });
      }
    }

    for (const asset of campaign.pack.videoAssets) {
      if (asset.status === "render-failed") {
        alerts.push({
          id: `render-failed-${campaign.id}-${asset.id}`,
          severity: "warning",
          area: "rendering",
          title: "Video render failed",
          detail: asset.renderError || `${asset.title} failed to render for ${campaign.intake.businessName}.`,
          action: "Retry rendering from the QA workspace and confirm the generated asset appears in the portal.",
          createdAt: asset.renderCompletedAt || asset.renderStartedAt || asset.renderQueuedAt || campaign.createdAt,
          customerId: campaign.customerId,
          campaignId: campaign.id
        });
      }

      if (asset.status === "render-queued" || asset.status === "rendering") {
        const assetTime = timestamp(asset.renderStartedAt || asset.renderQueuedAt || campaign.createdAt);
        if (now - assetTime > THIRTY_MINUTES_MS) {
          alerts.push({
            id: `render-stale-${campaign.id}-${asset.id}`,
            severity: "warning",
            area: "rendering",
            title: "Video render is stale",
            detail: `${asset.title} has been ${asset.status.replaceAll("-", " ")} for more than 30 minutes.`,
            action: "Check the render queue and retry the render if the worker did not complete.",
            createdAt: asset.renderStartedAt || asset.renderQueuedAt || campaign.createdAt,
            customerId: campaign.customerId,
            campaignId: campaign.id
          });
        }
      }
    }
  }

  const attemptsByTask = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const key = taskAttemptKey(attempt.campaignId, attempt.customerId, attempt.taskKey);
    attemptsByTask.set(key, [...(attemptsByTask.get(key) ?? []), attempt]);

    if ((attempt.status === "failed" || attempt.status === "blocked") && now - timestamp(attempt.updatedAt) <= SEVEN_DAYS_MS) {
      alerts.push({
        id: `publishing-${attempt.status}-${attempt.id}`,
        severity: attempt.status === "failed" ? "critical" : "warning",
        area: "publishing",
        title: attempt.status === "failed" ? "Publishing failed" : "Publishing blocked",
        detail: attempt.error || `${attempt.platform} ${attempt.method.replaceAll("-", " ")} did not complete.`,
        action:
          attempt.status === "failed"
            ? "Prepare the manual posting kit, check the connected account, then retry direct publishing after the blocker is resolved."
            : "Confirm social OAuth, platform permissions, asset availability, and customer approval.",
        createdAt: attempt.updatedAt || attempt.createdAt,
        customerId: attempt.customerId,
        campaignId: attempt.campaignId,
        taskKey: attempt.taskKey
      });
    }

    if ((attempt.status === "publishing" || attempt.status === "queued") && now - timestamp(attempt.updatedAt) > FOUR_HOURS_MS) {
      alerts.push({
        id: `publishing-stale-${attempt.id}`,
        severity: "warning",
        area: "publishing",
        title: "Publishing attempt is stale",
        detail: `${attempt.platform} has been ${attempt.status} for more than four hours.`,
        action: "Refresh platform status, capture the live URL if it posted, or mark the row blocked and prepare manual posting.",
        createdAt: attempt.updatedAt || attempt.createdAt,
        customerId: attempt.customerId,
        campaignId: attempt.campaignId,
        taskKey: attempt.taskKey
      });
    }
  }

  for (const review of reviews) {
    for (const row of review.publishingReviews) {
      if (row.publishingError) {
        alerts.push({
          id: `review-publishing-error-${review.id}-${row.taskKey}`,
          severity: "warning",
          area: "publishing",
          title: "Publishing row has an automation error",
          detail: row.publishingError,
          action: "Resolve the blocker or prepare the manual posting kit before the customer expects the post to go live.",
          createdAt: row.updatedAt || review.updatedAt,
          customerId: review.customerId,
          campaignId: review.campaignId,
          taskKey: row.taskKey
        });
      }

      const dueAt = timestamp(row.scheduledFor);
      const key = taskAttemptKey(review.campaignId, review.customerId, row.taskKey);
      const rowAttempts = attemptsByTask.get(key) ?? [];
      const hasActiveOrFinalAttempt = rowAttempts.some((attempt) =>
        ["manual-kit-ready", "queued", "publishing", "published"].includes(attempt.status)
      );
      if (row.autoPublishApproved && row.scheduledFor && dueAt < now - THIRTY_MINUTES_MS && !hasActiveOrFinalAttempt) {
        alerts.push({
          id: `publishing-overdue-${review.id}-${row.taskKey}`,
          severity: "critical",
          area: "publishing",
          title: "Approved post is overdue",
          detail: `${row.platform} was approved for hands-off posting at ${row.scheduledFor}, but no publishing attempt exists.`,
          action: "Run the publishing sweep, check Scheduler/Cloud Tasks, then prepare manual posting if needed.",
          createdAt: row.scheduledFor,
          customerId: review.customerId,
          campaignId: review.campaignId,
          taskKey: row.taskKey
        });
      }
    }
  }

  for (const event of emailEvents) {
    if (event.status !== "failed" || now - timestamp(event.createdAt) > SEVEN_DAYS_MS) continue;
    alerts.push({
      id: `email-failed-${event.id}`,
      severity: event.messageType === "internal-notification" ? "warning" : "critical",
      area: "email",
      title: "Email delivery failed",
      detail: `${event.subject}: ${event.reason || "SendGrid did not accept the message."}`,
      action: "Check SendGrid activity, sender verification, and whether the customer email address is valid.",
      createdAt: event.createdAt
    });
  }

  for (const customer of customers) {
    if (customer.status === "payment-failed" || customer.status === "incomplete") {
      alerts.push({
        id: `billing-${customer.status}-${customer.id}`,
        severity: "critical",
        area: "billing",
        title: "Customer billing needs attention",
        detail: `${customer.businessName} is ${customer.status.replaceAll("-", " ")}.`,
        action: "Follow up with the customer and check Stripe before continuing paid production work.",
        createdAt: customer.updatedAt || customer.createdAt,
        customerId: customer.id
      });
    }
  }

  for (const connection of socialConnections) {
    const expiresAt = timestamp(connection.expiresAt);
    if (connection.status === "needs-renewal" || (connection.expiresAt && expiresAt < now + SEVEN_DAYS_MS)) {
      alerts.push({
        id: `social-renewal-${connection.id}`,
        severity: "warning",
        area: "social",
        title: "Social connection needs renewal",
        detail: `${connection.platform} ${connection.accountName || connection.handle || "account"} is ${connection.status.replaceAll("-", " ")}${connection.expiresAt ? ` or expires on ${connection.expiresAt}` : ""}.`,
        action: "Ask the customer to reconnect the platform before direct posting is due.",
        createdAt: connection.updatedAt,
        customerId: connection.customerId
      });
    }
  }

  const sendGrid = getSendGridStatus();
  if (!sendGrid.configured || !sendGrid.canSendOwnerNotification) {
    alerts.push({
      id: "configuration-sendgrid-owner",
      severity: "critical",
      area: "configuration",
      title: "Owner email alerts are not fully configured",
      detail: "SendGrid or the VIDSLOOM sales email is missing, so operational alerts may not reach the team.",
      action: "Configure SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and VIDSLOOM_SALES_EMAIL on the active Cloud Run service.",
      createdAt: nowIso
    });
  }

  if (!fallbackModel || fallbackModel === primaryModel) {
    alerts.push({
      id: "ai-secondary-model-not-configured",
      severity: "warning",
      area: "ai",
      title: "Secondary AI model is not configured",
      detail: "The active deployment does not have a distinct secondary AI model for transient primary-model failures.",
      action: "Set GEMINI_FALLBACK_MODEL to a lower-cost Gemini model that has available quota.",
      createdAt: nowIso
    });
  }

  if (getPromptVersion() !== "campaign-pack-v1.0") {
    alerts.push({
      id: "ai-prompt-version-changed",
      severity: "info",
      area: "ai",
      title: "Campaign prompt version changed",
      detail: `Current prompt version is ${getPromptVersion()}.`,
      action: "Run a staging paid-customer generation smoke test before relying on the new prompt version in production.",
      createdAt: nowIso
    });
  }

  const activeSuppressions = activeSuppressionsByAlert(suppressions, now);
  const decoratedAlerts = dedupeAlerts(alerts).map((alert) => {
    const suppression = activeSuppressions.get(alert.id);
    if (!suppression) return alert;
    return {
      ...alert,
      suppressed: true,
      suppressedUntil: suppression.suppressUntil,
      acknowledgedAt: suppression.acknowledgedAt,
      acknowledgedBy: suppression.acknowledgedBy,
      acknowledgementNote: suppression.note
    };
  });
  const sorted = decoratedAlerts
    .filter((alert) => includeSuppressed || !alert.suppressed)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || timestamp(b.createdAt) - timestamp(a.createdAt))
    .slice(0, 100);

  return {
    ok: true,
    generatedAt: nowIso,
    counts: {
      total: sorted.length,
      critical: sorted.filter((alert) => alert.severity === "critical").length,
      warning: sorted.filter((alert) => alert.severity === "warning").length,
      info: sorted.filter((alert) => alert.severity === "info").length,
      suppressed: decoratedAlerts.filter((alert) => alert.suppressed).length
    },
    alerts: sorted
  };
}

export function formatOpsAlertSummary(report: Awaited<ReturnType<typeof buildOpsAlerts>>) {
  if (!report.alerts.length) {
    return `VIDSLOOM ops check at ${report.generatedAt}: no active alerts.`;
  }

  const lines = [
    `VIDSLOOM ops check at ${report.generatedAt}`,
    `Active alerts: ${report.counts.total} (${report.counts.critical} critical, ${report.counts.warning} warning)`,
    "",
    ...report.alerts.slice(0, 12).flatMap((alert, index) => [
      `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title}`,
      `Area: ${alert.area}`,
      `Detail: ${alert.detail}`,
      `Action: ${alert.action}`,
      alert.customerId ? `Customer: ${alert.customerId}` : "",
      alert.campaignId ? `Campaign: ${alert.campaignId}` : "",
      ""
    ])
  ];

  return lines.filter(Boolean).join("\n");
}

function taskAttemptKey(campaignId: string, customerId: string, taskKey: string) {
  return `${campaignId}::${customerId}::${taskKey}`;
}

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function severityRank(severity: OpsAlertSeverity) {
  return severity === "critical" ? 3 : severity === "warning" ? 2 : 1;
}

function dedupeAlerts(alerts: OpsAlert[]) {
  return Array.from(new Map(alerts.map((alert) => [alert.id, alert])).values());
}

function activeSuppressionsByAlert(
  suppressions: Awaited<ReturnType<typeof listOpsAlertSuppressions>>,
  now: number
) {
  const active = suppressions
    .filter((suppression) => !suppression.resolvedAt && timestamp(suppression.suppressUntil) > now)
    .sort((a, b) => timestamp(b.suppressUntil) - timestamp(a.suppressUntil));
  return new Map(active.map((suppression) => [suppression.alertId, suppression]));
}
