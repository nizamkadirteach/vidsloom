"use client";

import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  PhoneCall,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Wand2
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { PublicCampaign } from "@/lib/public-campaign";
import type { CampaignIntake, GeneratedVideoAsset, Lead, Platform, PublishingAttempt, PublishingMethod } from "@/lib/schemas";

const platformOptions: Platform[] = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "LinkedIn",
  "X",
  "Facebook Reels"
];

const defaultQualityInstructions =
  "Use a strong first-three-second hook, premium 9:16 mobile framing, visible product/service context, realistic motion, large readable subtitles, claim-safe proof overlays, clean safe zones, and one clear CTA. Keep exact text, logos, prices, captions, reviews, metrics, and proof in deterministic post-production; never generate them inside AI footage.";

const defaultIntake: CampaignIntake = {
  businessName: "VIDSLOOM",
  website: "https://vidsloom.com",
  industry: "AI social media marketing automation",
  offer:
    "A service-assisted platform that creates monthly short-form video campaign packs for small businesses.",
  audience:
    "Small business owners, ecommerce operators, coaches, and small agencies who need consistent short-form video marketing but cannot hire a full creative team.",
  goal: "Increase qualified enquiries, bookings, trials, or sales from consistent short-form video campaigns.",
  brandVoice: "Confident, practical, energetic, proof-led",
  platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  constraints:
    "Do not claim guaranteed virality or guaranteed revenue. Human approval is required before publishing. Revenue numbers are not finalized yet.",
  proofPoints:
    "Uses the business offer, audience, available assets, customer proof points, and platform-ready content structure.",
  assets: "Logo, product screenshots, founder clips, customer reviews, website copy, and social profile links",
  cadence: "Launch sprint",
  brandKit: {
    logoUrl: "",
    primaryColor: "#05b6d4",
    secondaryColor: "#111827",
    fontStyle: "Clean, bold, highly readable",
    brandDo: "Use clear captions, confident proof-led language, and visual consistency.",
    brandDont: "Avoid unsupported claims, cluttered overlays, tiny text, or off-brand gimmicks."
  },
  creativeSettings: {
    hookStyle: "proof-first",
    captionStyle: "bold-subtitles",
    ctaType: "send-dm",
    visualStyle: "fast-cut",
    musicMood: "upbeat",
    voiceoverStyle: "narrator",
    subtitlesRequired: true
  },
  videoSettings: {
    durationSeconds: 15,
    qualityMode: "balanced",
    qualityInstructions: defaultQualityInstructions
  },
  automationSetup: {
    publishingMode: "approval-first",
    approvalPolicy: "approve-every-post",
    notificationChannels: ["Email"],
    notificationContact: "",
    postingTimezone: "Customer local time",
    quietHours: "9:00 PM-8:00 AM local time",
    budgetSensitivity: "lowest-cost",
    assetSource: "customer-uploaded",
    connectedAccounts: platformOptions.map((platform) => ({
      platform,
      handle: "",
      status: "not-connected",
      autoPublish: false
    }))
  }
};

type View = "brief" | "trends" | "videos" | "publish" | "calendar" | "evidence";
type ReviewState = "approved" | "changes-requested";
type LeadPipelineItem = Lead & {
  contactLinks: {
    email: string;
    whatsapp: string;
    sms: string;
  };
  due: boolean;
};
type LeadPipelineSummary = {
  total: number;
  hot: number;
  warm: number;
  nurture: number;
  due: number;
  won: number;
  proposal: number;
};
type NewsletterSummary = {
  capture: string;
  count: number;
  operations?: {
    segments: Array<{
      id: string;
      name: string;
      description: string;
      count: number;
      rule: {
        tags: string[];
        sources: string[];
        statuses: string[];
      };
    }>;
    sequences: Array<{
      id: string;
      name: string;
      description: string;
      trigger: string;
      status: string;
      steps: Array<{
        id: string;
        name: string;
        delayHours: number;
        subject: string;
        messageType: string;
      }>;
    }>;
    broadcasts: Array<{
      id: string;
      updatedAt: string;
      subject: string;
      status: string;
      stats: {
        attempted: number;
        sent: number;
        skipped: number;
        failed: number;
      };
    }>;
    events: Array<{
      id: string;
      createdAt: string;
      email: string;
      subject: string;
      messageType: string;
      status: string;
      category: string;
    }>;
    automation: {
      activeEnrollments: number;
      dueNow: number;
    };
  };
  contacts: Array<{
    id: string;
    createdAt: string;
    email: string;
    contactName: string;
    businessName: string;
    source: string;
  }>;
};
type OpsAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  area: "ai" | "planning" | "rendering" | "publishing" | "billing" | "email" | "social" | "configuration";
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
type OpsAlertReport = {
  ok: boolean;
  generatedAt: string;
  counts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    suppressed: number;
  };
  alerts: OpsAlert[];
  acknowledgedCount?: number;
  notification?: {
    sent: boolean;
    skipped?: boolean;
    reason?: string;
    status?: number;
    error?: string;
    jobId?: string;
  };
};
type MediaJobMode = "dry-run" | "reference-frame" | "video-generation" | "final-assembly";
type MediaJobAssetResult = {
  shotId: string;
  type: "reference-frame" | "video-clip" | "final-video";
  result: {
    ok: boolean;
    status: "disabled" | "generated" | "failed";
    asset?: {
      key: string;
      url: string;
      provider: string;
    };
    posterAsset?: {
      key: string;
      url: string;
      provider: string;
    };
    qa?: {
      playable: boolean;
      durationSeconds: number;
      resolution: string;
      fileSizeBytes: number;
      checks: string[];
      warnings: string[];
      verdict: "pass" | "review" | "failed";
    };
    error?: string;
  };
};
type MediaJobResponse = {
  ok: boolean;
  status: "not-found" | "planned" | "generated" | "disabled" | "blocked" | "failed";
  error?: string;
  campaign?: PublicCampaign;
  counts?: {
    assetsAnalyzed: number;
    shots: number;
    executableShots: number;
    blockedShots: number;
    promptPackets: number;
    qaReports: number;
    regenerationRequests: number;
    jobs: number;
    generatedAssets: number;
  };
  executionBlockers?: string[];
  generatedAssets?: MediaJobAssetResult[];
  plan?: {
    id: string;
    campaignId: string;
    mode: string;
    productionBrief: {
      businessName: string;
      industry: string;
      durationSeconds: number;
      qualityMode: string;
    };
    budget?: {
      configuredBudgetCents: number;
      estimatedCostCents: number;
      remainingBudgetCents: number;
      allowUnbudgetedGeneration: boolean;
      maxPremiumClips: number;
      premiumClipsPlanned: number;
      executableShotIds: string[];
      blockedShotIds: string[];
      status: string;
      blockers: string[];
      costLines: Array<{
        label: string;
        jobType: string;
        shotId?: string;
        costTier: string;
        estimatedCents: number;
      }>;
    };
  };
};
type EvidenceSummary = {
  summary: {
    campaignCount: number;
    agentRunCount: number;
    campaignReviewCount: number;
    approvedReviewCount: number;
    proofPermissionCount: number;
    proofCapturedCount: number;
    livePostCount: number;
    directPublishedCount: number;
    screenshotProofCount: number;
    totalViews: number;
    totalEngagement: number;
    totalDirectViews: number;
    totalDirectEngagement: number;
    totalDirectMessages: number;
    totalBookings: number;
    salesByCurrency: Array<{ currency: string; value: number }>;
    latestCampaignAt: string | null;
    aiGeneratedCampaigns: number;
    offlineFallbackCampaigns: number;
  };
  campaignReviews: EvidenceCampaignReview[];
};

type EvidenceCampaignReview = {
  id: string;
  customerId: string;
  campaignId: string;
  updatedAt: string;
  overallStatus: string;
  businessName: string;
  industry: string;
  offer: string;
  goal: string;
  platforms: Platform[];
  campaignCreatedAt: string;
  approvedVideos: number;
  changeRequests: number;
  readyTasks: number;
  proofPermission: boolean;
  hasProofNotes: boolean;
  proofNotes: string;
  customerNotes: string;
  publishingRows: EvidencePublishingRow[];
  aggregate: EvidenceAggregate;
};

type EvidencePublishingRow = {
  taskKey: string;
  conceptTitle: string;
  platform: Platform;
  status: string;
  day: string;
  scheduledFor: string;
  autoPublishApproved: boolean;
  livePostUrl: string;
  directPublish: {
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
  directNotes: string;
  manualFallback: {
    status: string;
    method: string;
    updatedAt: string;
    error: string;
  } | null;
  screenshotLinks: string[];
  metrics: EvidenceMetrics;
  notes: string;
  capturedAt: string;
  followUp24hSentAt: string;
  followUp48hSentAt: string;
  hasProofCapture: boolean;
};

type EvidenceMetrics = {
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

type EvidenceAggregate = {
  publishedRows: number;
  proofCapturedRows: number;
  screenshotCount: number;
  views: number;
  engagement: number;
  directViews: number;
  directEngagement: number;
  directMessages: number;
  bookings: number;
  salesByCurrency: Array<{ currency: string; value: number }>;
};

const progressMessages = [
  "Reading business context",
  "Finding relevant video angles",
  "Writing hooks and captions",
  "Building schedule and approval queue",
  "Finalizing campaign pack"
];

const videoPreviewAssets = [
  {
    label: "Local offer final preview",
    src: "/samples/restaurant-reel-sample.mp4",
    poster: "/samples/restaurant-reel-poster.png"
  },
  {
    label: "Service booking final preview",
    src: "/samples/service-proof-sample.mp4",
    poster: "/samples/service-proof-poster.png"
  },
  {
    label: "Product sales final preview",
    src: "/samples/ecommerce-launch-sample.mp4",
    poster: "/samples/ecommerce-launch-poster.png"
  }
];

const quickStartTemplates: Array<{
  label: string;
  description: string;
  patch: Pick<
    CampaignIntake,
    "businessName" | "website" | "industry" | "offer" | "audience" | "goal" | "brandVoice" | "platforms" | "proofPoints" | "assets" | "cadence"
  >;
}> = [
  {
    label: "Restaurant",
    description: "Bookings, menu highlights, events",
    patch: {
      businessName: "Harbour Table",
      website: "",
      industry: "Restaurant",
      offer: "A modern local restaurant with signature dishes, private dining, and limited-time menu highlights.",
      audience: "Local diners, office teams, couples, and families looking for a memorable meal or private event booking.",
      goal: "Increase table bookings, event enquiries, and repeat visits from short-form social content.",
      brandVoice: "Warm, appetizing, local, confident",
      platforms: ["Instagram Reels", "TikTok"],
      proofPoints: "Popular signature dish, strong diner reviews, chef-led preparation, private dining enquiries.",
      assets: "Menu photos, dish photos, review screenshots, chef/team photos, booking link.",
      cadence: "Launch sprint"
    }
  },
  {
    label: "Clinic",
    description: "Trust, first visit, safe claims",
    patch: {
      businessName: "GlowPath Clinic",
      website: "",
      industry: "Clinic and wellness studio",
      offer: "A patient-friendly consultation and treatment experience focused on clear expectations and safe outcomes.",
      audience: "Busy adults comparing providers who want to understand the first visit before booking.",
      goal: "Increase qualified consultation bookings while keeping claims accurate and compliant.",
      brandVoice: "Calm, expert, reassuring, precise",
      platforms: ["Instagram Reels", "YouTube Shorts"],
      proofPoints: "Licensed team, clear consultation process, anonymized patient questions, approved testimonials.",
      assets: "Clinic photos, team credentials, FAQ list, approved testimonial snippets, booking link.",
      cadence: "3 posts/week"
    }
  },
  {
    label: "Ecommerce",
    description: "Product demo, bundle, objections",
    patch: {
      businessName: "Northstar Goods",
      website: "",
      industry: "Ecommerce",
      offer: "A curated product bundle that solves a repeat purchase problem with fewer steps and clearer value.",
      audience: "Online shoppers who want a faster, easier, and more reliable solution before they buy.",
      goal: "Increase product page visits, add-to-cart actions, and repeat purchases from short-form product videos.",
      brandVoice: "Clear, stylish, helpful, conversion-focused",
      platforms: ["TikTok", "Instagram Reels", "Facebook Reels"],
      proofPoints: "Customer reviews, bundle value, product routine, common objections, delivery or guarantee details.",
      assets: "Product photos, unboxing clips, review screenshots, product page, offer details.",
      cadence: "Launch sprint"
    }
  },
  {
    label: "Agency",
    description: "Multi-client approvals, proof, reporting",
    patch: {
      businessName: "Bridgeway Agency",
      website: "",
      industry: "Marketing agency",
      offer: "A managed short-form video production workflow for clients who need trend-aware assets and approval queues.",
      audience: "Agency owners and marketing managers serving local businesses, ecommerce brands, and service companies.",
      goal: "Improve client retention and campaign speed by producing approval-ready video assets for multiple accounts.",
      brandVoice: "Strategic, reliable, performance-led, client-safe",
      platforms: ["Instagram Reels", "TikTok", "LinkedIn"],
      proofPoints: "Client outcomes, approval process, reporting cadence, white-label delivery requirements.",
      assets: "Client briefs, brand guidelines, testimonial permissions, campaign examples, reporting templates.",
      cadence: "5 posts/week"
    }
  }
];

function Field({
  label,
  children,
  span = false
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={span ? "field fieldWide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="scoreBar" aria-label={`Score ${value}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function buildGrowthReadiness(intake: CampaignIntake) {
  const selectedAccounts = intake.automationSetup.connectedAccounts.filter((account) =>
    intake.platforms.includes(account.platform)
  );
  const connectedAccounts = selectedAccounts.filter((account) => account.status === "connected");
  const hasBusinessContext =
    intake.businessName.trim().length >= 2 &&
    intake.industry.trim().length >= 2 &&
    intake.offer.trim().length >= 60 &&
    intake.audience.trim().length >= 40 &&
    intake.goal.trim().length >= 30;
  const hasProof = (intake.proofPoints ?? "").trim().length >= 40 || (intake.assets ?? "").trim().length >= 40;
  const hasConversionPath = ["book-call", "send-dm", "buy-now", "claim-offer", "learn-more"].includes(
    intake.creativeSettings.ctaType
  );
  const hasQualityDefaults =
    intake.videoSettings.qualityInstructions.toLowerCase().includes("safe zone") ||
    intake.videoSettings.qualityInstructions.toLowerCase().includes("subtitle") ||
    intake.videoSettings.qualityInstructions.toLowerCase().includes("proof");
  const hasNotificationRoute =
    intake.automationSetup.notificationChannels.length > 0 && intake.automationSetup.notificationContact.trim().length >= 5;
  const handsOffReady =
    connectedAccounts.length > 0 ||
    intake.automationSetup.publishingMode === "manual-only" ||
    intake.automationSetup.publishingMode === "approval-first";

  const checks = [
    {
      label: "Business brief",
      status: hasBusinessContext ? "ready" : "needs-work",
      value: hasBusinessContext ? "Ready" : "Add clearer offer, audience, and goal",
      action: "Make the offer, buyer, and conversion goal specific enough for campaign planning."
    },
    {
      label: "Proof source",
      status: hasProof ? "ready" : "needs-work",
      value: hasProof ? "Usable proof" : "Proof needed",
      action: "Add reviews, product facts, screenshots, testimonials, FAQs, or service evidence."
    },
    {
      label: "Conversion path",
      status: hasConversionPath ? "ready" : "needs-work",
      value: formatStatus(intake.creativeSettings.ctaType),
      action: "Use one direct CTA that matches the business goal: book, DM, buy, claim, or learn."
    },
    {
      label: "Video standard",
      status: hasQualityDefaults ? "ready" : "needs-work",
      value: `${intake.videoSettings.durationSeconds}s ${formatStatus(intake.videoSettings.qualityMode)}`,
      action: "Keep 9:16 framing, first-second motion, readable captions, clean safe zones, and deterministic proof overlays."
    },
    {
      label: "Posting route",
      status: handsOffReady ? "ready" : "needs-work",
      value: connectedAccounts.length ? `${connectedAccounts.length} connected` : formatStatus(intake.automationSetup.publishingMode),
      action: "Use approval-first or connect platform permissions before enabling direct auto-posting."
    },
    {
      label: "Notifications",
      status: hasNotificationRoute ? "ready" : "needs-work",
      value: hasNotificationRoute ? intake.automationSetup.notificationChannels.join(", ") : "Contact missing",
      action: "Add the owner email, phone, or team contact for approval, posting, and performance alerts."
    }
  ] as const;

  const score =
    (hasBusinessContext ? 24 : 8) +
    (hasProof ? 18 : 4) +
    (intake.platforms.length ? 10 : 0) +
    (hasConversionPath ? 12 : 0) +
    (hasQualityDefaults ? 16 : 6) +
    (handsOffReady ? 10 : 2) +
    (hasNotificationRoute ? 10 : 0);
  const normalizedScore = Math.max(0, Math.min(100, score));
  const firstGap = checks.find((check) => check.status !== "ready");

  return {
    score: normalizedScore,
    tier: normalizedScore >= 85 ? "Scale-ready" : normalizedScore >= 65 ? "Production-ready" : "Needs setup",
    nextAction: firstGap?.action ?? "Generate the campaign pack, review the first video queue, then approve or schedule.",
    checks
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function formatOptionalDate(value: string) {
  if (!value) return "Not captured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not captured";
  return formatDate(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-SG", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatCents(value: number) {
  return formatMoney(value / 100, "USD");
}

function formatSalesBreakdown(items: Array<{ currency: string; value: number }>) {
  if (!items.length) return "No sales value captured";
  return items.map((item) => formatMoney(item.value, item.currency)).join(" + ");
}

function buildProofReport(review: EvidenceCampaignReview) {
  const lines = [
    `VIDSLOOM campaign proof report: ${review.businessName}`,
    `Status: ${formatStatus(review.overallStatus)}`,
    `Last updated: ${formatDate(review.updatedAt)}`,
    "",
    "Campaign context:",
    `- Industry: ${review.industry || "Not specified"}`,
    `- Offer: ${review.offer || "Not specified"}`,
    `- Goal: ${review.goal || "Not specified"}`,
    `- Platforms: ${review.platforms.length ? review.platforms.join(", ") : "Not specified"}`,
    "",
    "Approval and publishing:",
    `- Approved videos: ${review.approvedVideos}`,
    `- Schedule rows ready: ${review.readyTasks}`,
    `- Live posts captured: ${review.aggregate.publishedRows}`,
    `- Proof rows captured: ${review.aggregate.proofCapturedRows}`,
    `- Case-study permission: ${review.proofPermission ? "Yes" : "Not yet"}`,
    "",
    "Performance captured:",
    `- Views: ${formatNumber(review.aggregate.views)}`,
    `- Engagement actions: ${formatNumber(review.aggregate.engagement)}`,
    `- Direct messages: ${formatNumber(review.aggregate.directMessages)}`,
    `- Bookings: ${formatNumber(review.aggregate.bookings)}`,
    `- Sales value: ${formatSalesBreakdown(review.aggregate.salesByCurrency)}`,
    "",
    "Post proof:"
  ];

  review.publishingRows
    .filter((row) => row.hasProofCapture || row.livePostUrl)
    .slice(0, 8)
    .forEach((row) => {
      lines.push(
        `- ${row.platform}: ${row.conceptTitle}`,
        `  Link: ${row.livePostUrl || "Pending"}`,
        `  Metrics: ${formatNumber(row.metrics.views)} views, ${formatNumber(row.metrics.engagement)} engagement actions, ${formatNumber(row.metrics.directMessages)} DMs, ${formatNumber(row.metrics.bookings)} bookings`,
        `  Captured: ${formatOptionalDate(row.capturedAt)}`
      );
      if (row.directPublish) {
        lines.push(
          `  Direct publish: ${formatStatus(row.directPublish.status)}${row.directPublish.privacyStatus ? ` (${row.directPublish.privacyStatus})` : ""}`,
          `  Direct URL: ${row.directPublish.externalUrl || "Stored without public URL"}`,
          `  Direct metrics: ${formatNumber(row.directMetrics.views)} views, ${formatNumber(row.directMetrics.engagement)} engagement actions`,
          `  Direct updated: ${formatOptionalDate(row.directPublish.updatedAt)}`
        );
        if (row.directNotes) lines.push(`  Direct notes: ${row.directNotes}`);
      }
      if (row.manualFallback) {
        lines.push(`  Manual recovery kit: ${formatStatus(row.manualFallback.status)}`);
      }
      if (row.notes) lines.push(`  Notes: ${row.notes}`);
    });

  if (review.proofNotes) {
    lines.push("", "Customer proof notes:", review.proofNotes);
  }

  return lines.join("\n");
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function isAiGenerated(campaign: PublicCampaign | null) {
  return campaign?.generationStatus === "ai-generated";
}

function campaignKey(campaign: PublicCampaign) {
  return campaign.id || `${campaign.createdAt}-${campaign.intake.businessName}`;
}

function publishingTaskKey(task: PublicCampaign["pack"]["publishingQueue"][number]) {
  return `${task.platform}-${task.conceptTitle}-${task.day}-${task.publishWindow}`;
}

function isRenderActiveAsset(asset: GeneratedVideoAsset) {
  return asset.status === "render-queued" || asset.status === "rendering";
}

function hasActiveRender(campaign: PublicCampaign | null) {
  return Boolean(campaign?.pack.videoAssets.some(isRenderActiveAsset));
}

function hasFailedRender(campaign: PublicCampaign | null) {
  return Boolean(campaign?.pack.videoAssets.some((asset) => asset.status === "render-failed"));
}

function isPlanningActive(campaign: PublicCampaign | null) {
  return campaign?.planningStatus === "planning-queued" || campaign?.planningStatus === "planning";
}

function isPlanningFailed(campaign: PublicCampaign | null) {
  return campaign?.planningStatus === "planning-failed";
}

function campaignRenderKey(campaign: PublicCampaign | null) {
  if (!campaign) return "";
  return [
    campaign.planningStatus,
    campaign.planningCompletedAt,
    campaign.planningError,
    ...campaign.pack.videoAssets.map((asset) =>
      `${asset.id}:${asset.status}:${asset.renderMode}:${asset.renderCompletedAt || asset.renderStartedAt || asset.renderQueuedAt}`
    )
  ].join("|");
}

function renderStatusSummary(campaign: PublicCampaign | null) {
  if (isPlanningActive(campaign)) {
    return {
      state: "active",
      label: campaign?.planningStatus === "planning" ? "AI campaign planning running" : "AI campaign planning queued",
      detail:
        "VIDSLOOM is preparing trend intelligence, scripts, captions, thumbnails, schedule rows, and approval checks. MP4 rendering will start automatically after planning."
    };
  }

  if (isPlanningFailed(campaign)) {
    return {
      state: "failed",
      label: "Campaign planning needs retry",
      detail: campaign?.planningError || "AI campaign planning failed before the pack could be completed."
    };
  }

  const assets = campaign?.pack.videoAssets ?? [];
  const total = assets.length || campaign?.pack.videoConcepts.length || 0;
  const queued = assets.filter((asset) => asset.status === "render-queued").length;
  const rendering = assets.filter((asset) => asset.status === "rendering").length;
  const failed = assets.filter((asset) => asset.status === "render-failed").length;
  const readyGenerated = assets.filter((asset) => asset.renderMode === "dynamic-render" || asset.renderMode === "ai-generated").length;
  const duration = campaign?.intake.videoSettings.durationSeconds ?? 15;
  const quality = formatStatus(campaign?.intake.videoSettings.qualityMode ?? "balanced");

  if (queued || rendering) {
    return {
      state: "active",
      label: `${queued + rendering}/${total} MP4s rendering`,
      detail: `${duration}s ${quality} videos are being prepared. Scripts, captions, thumbnails, and the schedule are ready while the real previews finish.`
    };
  }

  if (failed) {
    return {
      state: "failed",
      label: `${failed}/${total} renders need attention`,
      detail: "Review previews are visible, but one or more customer-specific MP4 renders failed and should be retried."
    };
  }

  if (readyGenerated) {
    return {
      state: "ready",
      label: `${readyGenerated}/${total} customer-specific MP4s ready`,
      detail: `${duration}s ${quality} videos have been rendered from this campaign brief and are ready for review.`
    };
  }

  return {
    state: "pending",
    label: "Sample previews available",
    detail: `${duration}s ${quality} video settings are saved. Customer-specific rendering starts after the render queue runs.`
  };
}

function mediaAssetUrl(asset: MediaJobAssetResult) {
  return asset.result.asset?.url ?? "";
}

export function VidsloomWorkbench({ initialCampaigns }: { initialCampaigns: PublicCampaign[] }) {
  const [intake, setIntake] = useState<CampaignIntake>(defaultIntake);
  const [campaign, setCampaign] = useState<PublicCampaign | null>(initialCampaigns[0] ?? null);
  const [recent, setRecent] = useState<PublicCampaign[]>(initialCampaigns);
  const [view, setView] = useState<View>(initialCampaigns.length ? "videos" : "brief");
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({});
  const [leads, setLeads] = useState<LeadPipelineItem[]>([]);
  const [leadSummary, setLeadSummary] = useState<LeadPipelineSummary | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);
  const [leadUpdatingId, setLeadUpdatingId] = useState<string | null>(null);
  const [leadNoteDrafts, setLeadNoteDrafts] = useState<Record<string, string>>({});
  const [leadTaskDrafts, setLeadTaskDrafts] = useState<Record<string, string>>({});
  const [leadFollowUpDrafts, setLeadFollowUpDrafts] = useState<Record<string, string>>({});
  const [newsletter, setNewsletter] = useState<NewsletterSummary | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSending, setNewsletterSending] = useState<"test" | "broadcast" | null>(null);
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [newsletterSubject, setNewsletterSubject] = useState("This week's short-form video opportunities");
  const [newsletterBody, setNewsletterBody] = useState(
    "Here are three video angles worth testing this week:\n\n1. Show the customer problem before the offer.\n2. Turn one proof point into a simple before-and-after story.\n3. End with one direct action: book, reply, enquire, or buy.\n\nVIDSLOOM can turn these angles into approval-ready videos, captions, thumbnails, and posting windows."
  );
  const [newsletterSegmentId, setNewsletterSegmentId] = useState("all-active");
  const [opsReport, setOpsReport] = useState<OpsAlertReport | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsAction, setOpsAction] = useState<string | null>(null);
  const [opsStatus, setOpsStatus] = useState<string | null>(null);
  const [opsIncludeSuppressed, setOpsIncludeSuppressed] = useState(false);
  const [opsNote, setOpsNote] = useState(
    "Known operational state; revisit after platform approvals or customer reconnection."
  );
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [copiedEvidenceId, setCopiedEvidenceId] = useState<string | null>(null);
  const [manualRenderLoading, setManualRenderLoading] = useState(false);
  const [mediaJobLoading, setMediaJobLoading] = useState<MediaJobMode | null>(null);
  const [mediaJobResult, setMediaJobResult] = useState<MediaJobResponse | null>(null);
  const [mediaJobStatus, setMediaJobStatus] = useState<string | null>(null);
  const [postingAttempts, setPostingAttempts] = useState<PublishingAttempt[]>([]);
  const [postingLoading, setPostingLoading] = useState<string | null>(null);
  const [postingStatus, setPostingStatus] = useState<string | null>(null);

  const selectedPlatformCount = intake.platforms.length;
  const averageQuality = useMemo(() => {
    if (!campaign) return null;
    const scores = campaign.pack.videoConcepts.map((item) => item.qualityScore);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [campaign]);
  const renderStatus = useMemo(() => renderStatusSummary(campaign), [campaign]);
  const renderPollKey = campaignRenderKey(campaign);
  const activeEvidenceReview = useMemo(
    () => evidence?.campaignReviews.find((review) => review.campaignId === campaign?.id) ?? null,
    [campaign?.id, evidence]
  );
  const intakeReadiness = useMemo(() => buildGrowthReadiness(intake), [intake]);
  const visibleOpsAlerts = opsReport?.alerts ?? [];
  const activeOpsAlerts = visibleOpsAlerts.filter((alert) => !alert.suppressed);
  const activeWarningIds = activeOpsAlerts.filter((alert) => alert.severity === "warning").map((alert) => alert.id);

  useEffect(() => {
    void loadLeads();
    void loadNewsletter();
    void loadOpsAlerts();
    void loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!campaign || (!isPlanningActive(campaign) && !hasActiveRender(campaign))) return;

    let cancelled = false;
    const pollCampaign = async () => {
      try {
        const nextCampaign = await fetchCampaignById(campaign.id);
        if (!cancelled) {
          adoptCampaign(nextCampaign);
        }
      } catch {
        // Keep the existing campaign visible; the next poll can recover.
      }
    };

    const timer = window.setInterval(pollCampaign, 6000);
    void pollCampaign();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [campaign, renderPollKey]);

  useEffect(() => {
    if (!campaign?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/publish`, { cache: "no-store" });
        const data = (await response.json()) as { attempts?: PublishingAttempt[] };
        if (response.ok && !cancelled) {
          setPostingAttempts(data.attempts ?? []);
        }
      } catch {
        // Publishing attempts are secondary; keep the campaign usable if this read fails.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaign?.id]);

  function adoptCampaign(nextCampaign: PublicCampaign, resetMediaJob = true) {
    setCampaign(nextCampaign);
    if (resetMediaJob) {
      setMediaJobResult(null);
      setMediaJobStatus(null);
    }
    setRecent((current) => [nextCampaign, ...current.filter((item) => item.id !== nextCampaign.id)].slice(0, 10));
  }

  async function fetchCampaignById(id: string) {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = (await response.json()) as { campaign?: PublicCampaign; error?: string };
    if (!response.ok || !data.campaign) {
      throw new Error(data.error ?? "Campaign refresh failed.");
    }
    return data.campaign;
  }

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = (await response.json()) as { campaigns?: PublicCampaign[] };
      setRecent(data.campaigns ?? []);
    } finally {
      setLoadingRecent(false);
    }
  }

  async function loadNewsletter() {
    setNewsletterLoading(true);
    try {
      const response = await fetch("/api/newsletter?limit=5", { cache: "no-store" });
      const data = (await response.json()) as NewsletterSummary;
      if (response.ok) {
        setNewsletter(data);
      }
    } finally {
      setNewsletterLoading(false);
    }
  }

  async function loadOpsAlerts(includeSuppressed = opsIncludeSuppressed) {
    setOpsLoading(true);
    try {
      const response = await fetch(`/api/ops/alerts${includeSuppressed ? "?includeSuppressed=true" : ""}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as OpsAlertReport & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Ops alert check failed.");
      }
      setOpsReport(data);
    } catch (err) {
      setOpsStatus(err instanceof Error ? err.message : "Ops alert check failed.");
    } finally {
      setOpsLoading(false);
    }
  }

  async function acknowledgeOpsAlerts(alertIds: string[], suppressHours = 72, actionId = "bulk") {
    const uniqueAlertIds = Array.from(new Set(alertIds));
    if (!uniqueAlertIds.length) return;
    setOpsAction(actionId);
    setOpsStatus(null);
    try {
      const response = await fetch("/api/ops/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgeIds: uniqueAlertIds,
          suppressHours,
          acknowledgedBy: "qa-ui",
          note: opsNote,
          includeSuppressed: opsIncludeSuppressed
        })
      });
      const data = (await response.json()) as OpsAlertReport & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Alert acknowledgement failed.");
      }
      setOpsReport(data);
      const acknowledgedCount = data.acknowledgedCount ?? uniqueAlertIds.length;
      setOpsStatus(
        `${acknowledgedCount} alert${acknowledgedCount === 1 ? "" : "s"} acknowledged for ${suppressHours} hours.`
      );
    } catch (err) {
      setOpsStatus(err instanceof Error ? err.message : "Alert acknowledgement failed.");
    } finally {
      setOpsAction(null);
    }
  }

  async function runCriticalOpsCheck() {
    setOpsAction("critical-check");
    setOpsStatus(null);
    try {
      const response = await fetch("/api/ops/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify: true,
          minSeverity: "critical",
          includeSuppressed: opsIncludeSuppressed
        })
      });
      const data = (await response.json()) as OpsAlertReport & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Critical ops check failed.");
      }
      setOpsReport(data);
      setOpsStatus(data.notification?.sent ? "Critical alert email sent." : data.notification?.reason ?? "No critical alerts found.");
    } catch (err) {
      setOpsStatus(err instanceof Error ? err.message : "Critical ops check failed.");
    } finally {
      setOpsAction(null);
    }
  }

  async function loadEvidence() {
    setEvidenceLoading(true);
    try {
      const response = await fetch("/api/evidence", { cache: "no-store" });
      const data = (await response.json()) as EvidenceSummary;
      if (response.ok) {
        setEvidence(data);
      }
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function copyEvidenceReport(review: EvidenceCampaignReview) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(buildProofReport(review));
    setCopiedEvidenceId(review.id);
    window.setTimeout(() => setCopiedEvidenceId((current) => (current === review.id ? null : current)), 1800);
  }

  function latestPostingAttempt(taskKey: string) {
    return postingAttempts.find((attempt) => attempt.taskKey === taskKey);
  }

  async function runPublishingAction(taskKey: string, method: PublishingMethod) {
    if (!campaign) return;
    setPostingLoading(`${taskKey}-${method}`);
    setPostingStatus(null);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey, method })
      });
      const data = (await response.json()) as { attempt?: PublishingAttempt; error?: string };
      if (!data.attempt && !response.ok) {
        throw new Error(data.error ?? "Publishing action failed.");
      }
      if (data.attempt) {
        setPostingAttempts((current) => [data.attempt!, ...current.filter((attempt) => attempt.id !== data.attempt!.id)]);
        setPostingStatus(
          data.attempt.status === "manual-kit-ready"
            ? "Manual posting kit prepared."
            : data.attempt.status === "blocked"
              ? data.attempt.error || "Direct publishing is blocked until the account is connected."
              : `Publishing attempt status: ${data.attempt.status.replaceAll("-", " ")}.`
        );
      }
    } catch (err) {
      setPostingStatus(err instanceof Error ? err.message : "Publishing action failed.");
    } finally {
      setPostingLoading(null);
    }
  }

  async function loadLeads() {
    setLeadsLoading(true);
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const data = (await response.json()) as { leads?: LeadPipelineItem[]; summary?: LeadPipelineSummary };
      if (response.ok) {
        const nextLeads = data.leads ?? [];
        setLeads(nextLeads);
        setLeadSummary(data.summary ?? null);
        setLeadNoteDrafts((current) => ({
          ...Object.fromEntries(nextLeads.map((lead) => [lead.id, lead.sales.notes ?? ""])),
          ...current
        }));
        setLeadTaskDrafts((current) => ({
          ...Object.fromEntries(nextLeads.map((lead) => [lead.id, lead.sales.followUpTask ?? ""])),
          ...current
        }));
        setLeadFollowUpDrafts((current) => ({
          ...Object.fromEntries(nextLeads.map((lead) => [lead.id, toDateTimeLocal(lead.sales.nextFollowUpAt)])),
          ...current
        }));
      }
    } finally {
      setLeadsLoading(false);
    }
  }

  async function updateLead(id: string, patch: Record<string, unknown>) {
    setLeadUpdatingId(id);
    setLeadStatus(null);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = (await response.json()) as { lead?: LeadPipelineItem; error?: string };
      if (!response.ok || !data.lead) {
        throw new Error(data.error ?? "Lead update failed.");
      }
      setLeads((current) => current.map((lead) => (lead.id === id ? data.lead! : lead)));
      setLeadStatus("Lead pipeline updated.");
      await loadLeads();
    } catch (err) {
      setLeadStatus(err instanceof Error ? err.message : "Lead update failed.");
    } finally {
      setLeadUpdatingId(null);
    }
  }

  async function sendNewsletter(mode: "test" | "broadcast") {
    setNewsletterSending(mode);
    setNewsletterStatus(null);
    try {
      const segment = newsletter?.operations?.segments.find((item) => item.id === newsletterSegmentId);
      const response = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          subject: newsletterSubject,
          body: newsletterBody,
          audience: segment?.rule
        })
      });
      const data = (await response.json()) as { sent?: number; attempted?: number; skipped?: number; failed?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Newsletter send failed.");
      }
      setNewsletterStatus(
        mode === "test"
          ? `Test sent: ${data.sent ?? 0} sent, ${data.skipped ?? 0} skipped.`
          : `Broadcast complete: ${data.sent ?? 0}/${data.attempted ?? 0} sent, ${data.failed ?? 0} failed.`
      );
      await loadNewsletter();
    } catch (err) {
      setNewsletterStatus(err instanceof Error ? err.message : "Newsletter send failed.");
    } finally {
      setNewsletterSending(null);
    }
  }

  async function runNewsletterAutomations() {
    setNewsletterSending("broadcast");
    setNewsletterStatus(null);
    try {
      const response = await fetch("/api/newsletter/automations/run", {
        method: "POST"
      });
      const data = (await response.json()) as { attempted?: number; sent?: number; skipped?: number; failed?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Automation run failed.");
      }
      setNewsletterStatus(
        `Automations checked: ${data.attempted ?? 0} due, ${data.sent ?? 0} sent, ${data.skipped ?? 0} skipped, ${data.failed ?? 0} failed.`
      );
      await loadNewsletter();
    } catch (err) {
      setNewsletterStatus(err instanceof Error ? err.message : "Automation run failed.");
    } finally {
      setNewsletterSending(null);
    }
  }

  function update<K extends keyof CampaignIntake>(key: K, value: CampaignIntake[K]) {
    setIntake((current) => ({ ...current, [key]: value }));
  }

  function togglePlatform(platform: Platform) {
    setIntake((current) => {
      const exists = current.platforms.includes(platform);
      const next = exists
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform];
      return { ...current, platforms: next.length ? next : current.platforms };
    });
  }

  function updateAutomation<K extends keyof CampaignIntake["automationSetup"]>(
    key: K,
    value: CampaignIntake["automationSetup"][K]
  ) {
    setIntake((current) => ({
      ...current,
      automationSetup: {
        ...current.automationSetup,
        [key]: value
      }
    }));
  }

  function updateVideoSettings<K extends keyof CampaignIntake["videoSettings"]>(
    key: K,
    value: CampaignIntake["videoSettings"][K]
  ) {
    setIntake((current) => ({
      ...current,
      videoSettings: {
        ...current.videoSettings,
        [key]: value
      }
    }));
  }

  function updateBrandKit<K extends keyof CampaignIntake["brandKit"]>(
    key: K,
    value: CampaignIntake["brandKit"][K]
  ) {
    setIntake((current) => ({
      ...current,
      brandKit: {
        ...current.brandKit,
        [key]: value
      }
    }));
  }

  function updateCreativeSettings<K extends keyof CampaignIntake["creativeSettings"]>(
    key: K,
    value: CampaignIntake["creativeSettings"][K]
  ) {
    setIntake((current) => ({
      ...current,
      creativeSettings: {
        ...current.creativeSettings,
        [key]: value
      }
    }));
  }

  function toggleNotificationChannel(channel: CampaignIntake["automationSetup"]["notificationChannels"][number]) {
    setIntake((current) => {
      const exists = current.automationSetup.notificationChannels.includes(channel);
      const next = exists
        ? current.automationSetup.notificationChannels.filter((item) => item !== channel)
        : [...current.automationSetup.notificationChannels, channel];
      return {
        ...current,
        automationSetup: {
          ...current.automationSetup,
          notificationChannels: next.length ? next : current.automationSetup.notificationChannels
        }
      };
    });
  }

  function updateConnectedAccount(
    platform: Platform,
    patch: Partial<CampaignIntake["automationSetup"]["connectedAccounts"][number]>
  ) {
    setIntake((current) => {
      const existing = current.automationSetup.connectedAccounts;
      const emptyAccount: CampaignIntake["automationSetup"]["connectedAccounts"][number] = {
        platform,
        handle: "",
        status: "not-connected",
        autoPublish: false
      };
      const hasPlatform = existing.some((account) => account.platform === platform);
      const next = (hasPlatform ? existing : [...existing, emptyAccount]).map((account) =>
        account.platform === platform ? { ...account, ...patch } : account
      );

      return {
        ...current,
        automationSetup: {
          ...current.automationSetup,
          connectedAccounts: next
        }
      };
    });
  }

  function applyQuickStart(template: (typeof quickStartTemplates)[number]) {
    setIntake((current) => {
      const connectedAccounts = template.patch.platforms.map((platform) => {
        return (
          current.automationSetup.connectedAccounts.find((account) => account.platform === platform) ?? {
            platform,
            handle: "",
            status: "not-connected" as const,
            autoPublish: false
          }
        );
      });

      return {
        ...current,
        ...template.patch,
        automationSetup: {
          ...current.automationSetup,
          connectedAccounts
        }
      };
    });
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setProgressStep(0);

    const progressTimer = window.setInterval(() => {
      setProgressStep((current) => Math.min(current + 1, progressMessages.length - 1));
    }, 1400);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake)
      });
      const data = (await response.json()) as { campaign?: PublicCampaign; error?: string };
      if (!response.ok || !data.campaign) {
        throw new Error(data.error ?? "Campaign generation failed.");
      }
      adoptCampaign(data.campaign);
      setReviewStates({});
      setProgressStep(progressMessages.length - 1);
      setView("videos");
      await loadRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      window.clearInterval(progressTimer);
      setLoading(false);
    }
  }

  async function runRenderNow() {
    if (!campaign) return;
    setManualRenderLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/render`, {
        method: "POST"
      });
      const data = (await response.json()) as { campaign?: PublicCampaign; error?: string };
      if (!response.ok || !data.campaign) {
        throw new Error(data.error ?? "Render retry failed.");
      }
      adoptCampaign(data.campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render retry failed.");
    } finally {
      setManualRenderLoading(false);
    }
  }

  async function runMediaJob(mode: MediaJobMode, execute: boolean) {
    if (!campaign) return;
    setMediaJobLoading(mode);
    setMediaJobStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/media/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          mode,
          execute,
          maxShots: mode === "final-assembly" ? 3 : 1
        })
      });
      const data = (await response.json()) as MediaJobResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "AI media job failed.");
      }
      setMediaJobResult(data);
      if (data.campaign) {
        adoptCampaign(data.campaign, false);
      }
      if (data.status === "disabled") {
        setMediaJobStatus("AI media execution is disabled in this environment; the production plan is still available.");
      } else if (data.status === "blocked") {
        const reason = data.executionBlockers?.[0] ?? data.plan?.budget?.blockers?.[0] ?? "Budget or QA gates blocked this media run.";
        setMediaJobStatus(`AI media generation blocked: ${reason}`);
      } else if (data.status === "planned") {
        setMediaJobStatus("AI media production plan prepared.");
      } else {
        const generatedCount = data.generatedAssets?.filter((asset) => asset.result.status === "generated").length ?? 0;
        setMediaJobStatus(`${generatedCount} AI media asset${generatedCount === 1 ? "" : "s"} generated for review.`);
      }
    } catch (err) {
      setMediaJobStatus(err instanceof Error ? err.message : "AI media job failed.");
    } finally {
      setMediaJobLoading(null);
    }
  }

  async function runPlanningNow() {
    if (!campaign) return;
    setManualRenderLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/plan`, {
        method: "POST"
      });
      const data = (await response.json()) as { campaign?: PublicCampaign; error?: string };
      if (!response.ok || !data.campaign) {
        throw new Error(data.error ?? "Planning retry failed.");
      }
      adoptCampaign(data.campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning retry failed.");
    } finally {
      setManualRenderLoading(false);
    }
  }

  function exportCampaign() {
    if (!campaign) return;
    const blob = new Blob([JSON.stringify(campaign, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const created = campaign.createdAt.slice(0, 10);
    anchor.download = `${campaign.intake.businessName.replaceAll(" ", "-").toLowerCase()}-${created}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brandLockup">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={48} height={48} priority unoptimized />
          <div>
            <p className="eyebrow">VIDSLOOM OPERATIONS</p>
            <h1>Campaign Engine</h1>
          </div>
        </div>
        <div className="topBarActions">
          <div className="topMetrics" aria-label="Workspace status">
            <div>
              <span>{recent.length}</span>
              <p>campaigns</p>
            </div>
            <div>
              <span>{selectedPlatformCount}</span>
              <p>platforms</p>
            </div>
            <div>
              <span>{isAiGenerated(campaign) ? "AI" : "Local"}</span>
              <p>engine</p>
            </div>
            <div>
              <span>{newsletter?.count ?? 0}</span>
              <p>opt-ins</p>
            </div>
          </div>
          <a className="secondaryButton signOutButton" href="/api/auth/logout">
            <LogOut size={16} />
            Sign out
          </a>
        </div>
      </header>

      <section className="workspace">
        <form className="intakePanel" onSubmit={generate}>
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Customer Intake</p>
              <h2>Launch Campaign</h2>
            </div>
            <button className="iconButton" type="button" onClick={() => setIntake(defaultIntake)} title="Reset form">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="quickStartPanel" aria-label="Quick-start business templates">
            <div>
              <strong>Quick-start brief</strong>
              <span>Prefill a realistic business type, then edit the details.</span>
            </div>
            <div className="quickStartGrid">
              {quickStartTemplates.map((template) => (
                <button key={template.label} type="button" onClick={() => applyQuickStart(template)}>
                  <Sparkles size={15} />
                  <span>
                    <strong>{template.label}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="intakeAssistPanel" aria-label="Fast intake guidance">
            <strong>Quick-start mode: answer the essentials first.</strong>
            <p>
              A busy owner can start with five inputs: business name, website, offer, audience, and proof. VIDSLOOM
              uses safe defaults for hook style, visual style, captions, approvals, quality, and posting rules.
            </p>
            <div>
              {["Offer", "Audience", "Proof", "Platforms", "Approval contact"].map((item) => (
                <span key={item}>
                  <CheckCircle2 size={14} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="growthReadinessPanel" aria-label="Growth readiness">
            <div className="growthReadinessHeader">
              <div>
                <p className="eyebrow">Growth Readiness</p>
                <h3>{intakeReadiness.tier}</h3>
              </div>
              <strong>{intakeReadiness.score}/100</strong>
            </div>
            <ScoreBar value={intakeReadiness.score} />
            <div className="growthReadinessChecks">
              {intakeReadiness.checks.map((check) => (
                <div key={check.label} className={`readinessCheck ${check.status}`}>
                  <span>{check.label}</span>
                  <strong>{check.value}</strong>
                </div>
              ))}
            </div>
            <p className="growthReadinessAction">{intakeReadiness.nextAction}</p>
          </div>

          <div className="formGrid">
            <Field label="Business name">
              <input value={intake.businessName} onChange={(event) => update("businessName", event.target.value)} />
            </Field>
            <Field label="Website">
              <input value={intake.website ?? ""} onChange={(event) => update("website", event.target.value)} />
            </Field>
            <Field label="Industry" span>
              <input value={intake.industry} onChange={(event) => update("industry", event.target.value)} />
            </Field>
            <Field label="Offer" span>
              <textarea value={intake.offer} onChange={(event) => update("offer", event.target.value)} />
            </Field>
            <Field label="Audience" span>
              <textarea value={intake.audience} onChange={(event) => update("audience", event.target.value)} />
            </Field>
            <Field label="Campaign goal" span>
              <textarea value={intake.goal} onChange={(event) => update("goal", event.target.value)} />
            </Field>
            <Field label="Brand voice">
              <input value={intake.brandVoice} onChange={(event) => update("brandVoice", event.target.value)} />
            </Field>
            <Field label="Cadence">
              <select value={intake.cadence} onChange={(event) => update("cadence", event.target.value as CampaignIntake["cadence"])}>
                <option>3 posts/week</option>
                <option>5 posts/week</option>
                <option>Daily</option>
                <option>Launch sprint</option>
              </select>
            </Field>
            <Field label="Video length">
              <select
                value={intake.videoSettings.durationSeconds}
                onChange={(event) =>
                  updateVideoSettings(
                    "durationSeconds",
                    Number.parseInt(event.target.value, 10) as CampaignIntake["videoSettings"]["durationSeconds"]
                  )
                }
              >
                <option value={10}>10s quick proof preview</option>
                <option value={15}>15s recommended offer clip</option>
                <option value={20}>20s demo/explainer</option>
                <option value={30}>30s proof + objection</option>
                <option value={45}>45s story + proof</option>
                <option value={60}>60s deep short</option>
              </select>
            </Field>
            <Field label="Video quality">
              <select
                value={intake.videoSettings.qualityMode}
                onChange={(event) =>
                  updateVideoSettings("qualityMode", event.target.value as CampaignIntake["videoSettings"]["qualityMode"])
                }
              >
                <option value="fast-preview">Fast preview: low-cost draft</option>
                <option value="balanced">Balanced: recommended</option>
                <option value="highest-quality">Highest quality: hero clips</option>
              </select>
            </Field>
            <Field label="Quality instructions" span>
              <textarea
                value={intake.videoSettings.qualityInstructions}
                onChange={(event) => updateVideoSettings("qualityInstructions", event.target.value)}
              />
              <small className="fieldGuidance">
                Best default: strong movement in the first second, 9:16 framing, clean safe zones, large subtitles, exact proof and
                logos added in post-production only.
              </small>
            </Field>
          </div>

          <details className="advancedPanel">
            <summary>
              <span>
                <strong>Advanced creative and brand settings</strong>
                <small>Optional. Defaults are already set for a mobile-first approval-ready campaign.</small>
              </span>
              <Sparkles size={16} />
            </summary>
            <div className="formGrid">
            <Field label="Hook style">
              <select
                value={intake.creativeSettings.hookStyle}
                onChange={(event) =>
                  updateCreativeSettings("hookStyle", event.target.value as CampaignIntake["creativeSettings"]["hookStyle"])
                }
              >
                <option value="proof-first">Proof first</option>
                <option value="direct-problem">Direct problem</option>
                <option value="before-after">Before-after</option>
                <option value="founder-pov">Founder POV</option>
                <option value="trend-remix">Trend remix</option>
              </select>
            </Field>
            <Field label="Visual style">
              <select
                value={intake.creativeSettings.visualStyle}
                onChange={(event) =>
                  updateCreativeSettings("visualStyle", event.target.value as CampaignIntake["creativeSettings"]["visualStyle"])
                }
              >
                <option value="fast-cut">Fast cut</option>
                <option value="premium-clean">Premium clean</option>
                <option value="ugc-authentic">UGC authentic</option>
                <option value="product-demo">Product demo</option>
                <option value="testimonial-proof">Testimonial proof</option>
              </select>
            </Field>
            <Field label="Caption style">
              <select
                value={intake.creativeSettings.captionStyle}
                onChange={(event) =>
                  updateCreativeSettings("captionStyle", event.target.value as CampaignIntake["creativeSettings"]["captionStyle"])
                }
              >
                <option value="bold-subtitles">Bold subtitles</option>
                <option value="clean-premium">Clean premium</option>
                <option value="ugc-native">UGC native</option>
                <option value="minimal">Minimal</option>
              </select>
            </Field>
            <Field label="CTA type">
              <select
                value={intake.creativeSettings.ctaType}
                onChange={(event) =>
                  updateCreativeSettings("ctaType", event.target.value as CampaignIntake["creativeSettings"]["ctaType"])
                }
              >
                <option value="send-dm">Send DM</option>
                <option value="book-call">Book call</option>
                <option value="buy-now">Buy now</option>
                <option value="claim-offer">Claim offer</option>
                <option value="learn-more">Learn more</option>
              </select>
            </Field>
            <Field label="Primary brand color">
              <input value={intake.brandKit.primaryColor} onChange={(event) => updateBrandKit("primaryColor", event.target.value)} />
            </Field>
            <Field label="Secondary brand color">
              <input value={intake.brandKit.secondaryColor} onChange={(event) => updateBrandKit("secondaryColor", event.target.value)} />
            </Field>
            <Field label="Brand logo URL" span>
              <input value={intake.brandKit.logoUrl} onChange={(event) => updateBrandKit("logoUrl", event.target.value)} />
            </Field>
            <Field label="Brand do / avoid" span>
              <textarea
                value={`${intake.brandKit.brandDo}\n\nAvoid: ${intake.brandKit.brandDont}`}
                onChange={(event) => {
                  const [brandDo, ...rest] = event.target.value.split(/\n\s*Avoid:\s*/i);
                  updateBrandKit("brandDo", brandDo.trim());
                  updateBrandKit("brandDont", rest.join(" Avoid: ").trim());
                }}
              />
            </Field>
            </div>
          </details>

          <div className="platformGroup">
            <span>Platforms</span>
            <div>
              {platformOptions.map((platform) => (
                <label key={platform} className={intake.platforms.includes(platform) ? "platform active" : "platform"}>
                  <input
                    type="checkbox"
                    checked={intake.platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform}
                </label>
              ))}
            </div>
          </div>

          <div className="formGrid">
            <Field label="Constraints" span>
              <textarea value={intake.constraints ?? ""} onChange={(event) => update("constraints", event.target.value)} />
            </Field>
            <Field label="Proof points" span>
              <textarea value={intake.proofPoints ?? ""} onChange={(event) => update("proofPoints", event.target.value)} />
            </Field>
            <Field label="Available assets" span>
              <textarea value={intake.assets ?? ""} onChange={(event) => update("assets", event.target.value)} />
            </Field>
          </div>

          <details className="advancedPanel automationAdvanced">
            <summary>
              <span>
                <strong>Advanced approvals, notifications, and posting rules</strong>
                <small>Optional. Approval-first and email notifications are the safest defaults.</small>
              </span>
              <Bell size={16} />
            </summary>
          <section className="automationSetup">
            <div className="miniSectionHeader">
              <div>
                <p className="eyebrow">Automation Setup</p>
                <h3>Hands-off publishing rules</h3>
              </div>
              <Bell size={18} />
            </div>
            <p className="automationNotice">
              Start with email notifications and manual approval. Direct scheduling or auto-posting is enabled only
              after the customer connects each social account and grants the required platform permissions.
            </p>
            <div className="formGrid">
              <Field label="Publishing mode">
                <select
                  value={intake.automationSetup.publishingMode}
                  onChange={(event) =>
                    updateAutomation(
                      "publishingMode",
                      event.target.value as CampaignIntake["automationSetup"]["publishingMode"]
                    )
                  }
                >
                  <option value="approval-first">Approval first</option>
                  <option value="auto-after-rules">Auto after rules pass</option>
                  <option value="manual-only">Manual upload only</option>
                </select>
              </Field>
              <Field label="Approval policy">
                <select
                  value={intake.automationSetup.approvalPolicy}
                  onChange={(event) =>
                    updateAutomation(
                      "approvalPolicy",
                      event.target.value as CampaignIntake["automationSetup"]["approvalPolicy"]
                    )
                  }
                >
                  <option value="approve-every-post">Approve every post</option>
                  <option value="auto-approve-low-risk">Auto-approve low-risk</option>
                  <option value="auto-publish-after-24h">Auto-publish after 24h</option>
                </select>
              </Field>
              <Field label="Notification contact">
                <input
                  value={intake.automationSetup.notificationContact}
                  placeholder="email, phone, or Slack handle"
                  onChange={(event) => updateAutomation("notificationContact", event.target.value)}
                />
              </Field>
              <Field label="Posting timezone">
                <input
                  value={intake.automationSetup.postingTimezone}
                  onChange={(event) => updateAutomation("postingTimezone", event.target.value)}
                />
              </Field>
              <Field label="Quiet hours">
                <input
                  value={intake.automationSetup.quietHours}
                  onChange={(event) => updateAutomation("quietHours", event.target.value)}
                />
              </Field>
              <Field label="Budget setting">
                <select
                  value={intake.automationSetup.budgetSensitivity}
                  onChange={(event) =>
                    updateAutomation(
                      "budgetSensitivity",
                      event.target.value as CampaignIntake["automationSetup"]["budgetSensitivity"]
                    )
                  }
                >
                  <option value="lowest-cost">Lowest cost</option>
                  <option value="balanced">Balanced</option>
                  <option value="maximum-impact">Maximum impact</option>
                </select>
              </Field>
              <Field label="Asset source" span>
                <select
                  value={intake.automationSetup.assetSource}
                  onChange={(event) =>
                    updateAutomation("assetSource", event.target.value as CampaignIntake["automationSetup"]["assetSource"])
                  }
                >
                  <option value="customer-uploaded">Customer uploaded assets</option>
                  <option value="vidsloom-assisted">VIDSLOOM assisted production</option>
                  <option value="stock-and-template-light">Stock and lightweight templates</option>
                </select>
              </Field>
            </div>
            <div className="platformGroup notificationGroup">
              <span>Notifications</span>
              <div>
                {(["Email", "WhatsApp", "SMS", "Slack"] as const).map((channel) => (
                  <label key={channel} className={intake.automationSetup.notificationChannels.includes(channel) ? "platform active" : "platform"}>
                    <input
                      type="checkbox"
                      checked={intake.automationSetup.notificationChannels.includes(channel)}
                      onChange={() => toggleNotificationChannel(channel)}
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
            <div className="accountSetupList">
              {intake.platforms.map((platform) => {
                const account =
                  intake.automationSetup.connectedAccounts.find((item) => item.platform === platform) ??
                  { platform, handle: "", status: "not-connected" as const, autoPublish: false };
                return (
                  <article key={platform} className="accountSetupRow">
                    <strong>{platform}</strong>
                    <input
                      aria-label={`${platform} handle`}
                      value={account.handle}
                      placeholder="@handle or page"
                      onChange={(event) => updateConnectedAccount(platform, { handle: event.target.value })}
                    />
                    <select
                      aria-label={`${platform} status`}
                      value={account.status}
                      onChange={(event) =>
                        updateConnectedAccount(platform, {
                          status: event.target.value as CampaignIntake["automationSetup"]["connectedAccounts"][number]["status"]
                        })
                      }
                    >
                      <option value="not-connected">Not connected</option>
                      <option value="connected">Connected</option>
                      <option value="needs-renewal">Needs renewal</option>
                      <option value="pending-review">Pending review</option>
                    </select>
                    <label className="inlineCheck">
                      <input
                        type="checkbox"
                        checked={account.autoPublish}
                        onChange={(event) => updateConnectedAccount(platform, { autoPublish: event.target.checked })}
                      />
                      Auto-publish
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
          </details>

          {error ? <p className="errorLine">{error}</p> : null}

          <button className="primaryButton" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
            {loading ? "Building campaign" : "Generate Campaign Pack"}
          </button>
          {loading ? <p className="loadingProgress">{progressMessages[progressStep]}</p> : null}
        </form>

        <section className="outputPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Review Queue</p>
              <h2>{campaign ? campaign.intake.businessName : "No campaign generated"}</h2>
            </div>
            <button className="secondaryButton" type="button" onClick={exportCampaign} disabled={!campaign}>
              <Download size={17} />
              Export
            </button>
          </div>

          {campaign ? (
            <>
              <div className="statusGrid">
                <div>
                  <span>Workflow</span>
                  <strong>{isAiGenerated(campaign) ? "AI production" : "AI-assisted"}</strong>
                  <small>Customer-ready outputs</small>
                </div>
                <div>
                  <span>Quality</span>
                  <strong>{averageQuality}</strong>
                  <small>Draft readiness score</small>
                </div>
                <div>
                  <span>Concepts</span>
                  <strong>{campaign.pack.videoConcepts.length}</strong>
                  <small>Ready for review</small>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{formatDate(campaign.createdAt)}</strong>
                  <small>Saved to workspace</small>
                </div>
              </div>

              <nav className="tabs" aria-label="Campaign sections">
                <button type="button" className={view === "brief" ? "active" : ""} onClick={() => setView("brief")}>
                  <FileText size={16} />
                  Brief
                </button>
                <button type="button" className={view === "trends" ? "active" : ""} onClick={() => setView("trends")}>
                  <TrendingUp size={16} />
                  Trends
                </button>
                <button type="button" className={view === "videos" ? "active" : ""} onClick={() => setView("videos")}>
                  <Play size={16} />
                  Videos
                </button>
                <button type="button" className={view === "publish" ? "active" : ""} onClick={() => setView("publish")}>
                  <UploadCloud size={16} />
                  Publish
                </button>
                <button type="button" className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>
                  <CalendarDays size={16} />
                  Calendar
                </button>
                <button type="button" className={view === "evidence" ? "active" : ""} onClick={() => setView("evidence")}>
                  <ShieldCheck size={16} />
                  Proof + ROI
                </button>
              </nav>

              {view === "brief" ? (
                <div className="sectionStack">
                  <section className="plainSection">
                    <h3>Executive Brief</h3>
                    <p>{campaign.pack.executiveBrief}</p>
                  </section>
                  <section className="plainSection">
                    <h3>Positioning</h3>
                    <p>{campaign.pack.positioning}</p>
                  </section>
                  <section className="plainSection">
                    <h3>Trend Angles</h3>
                    <div className="angleList">
                      {campaign.pack.trendAngles.map((angle) => (
                        <article key={angle.name} className="listItem">
                          <div>
                            <h4>{angle.name}</h4>
                            <p>{angle.insight}</p>
                            <small>{angle.executionNote}</small>
                          </div>
                          <div className="score">
                            <strong>{angle.fitScore}</strong>
                            <ScoreBar value={angle.fitScore} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {view === "trends" ? (
                <div className="sectionStack">
                  <section className="plainSection">
                    <h3>{campaign.pack.trendIntelligence.agentName}</h3>
                    <p>{campaign.pack.trendIntelligence.caveat}</p>
                    <div className="formatRail">
                      {campaign.pack.trendIntelligence.recommendedFormats.map((format) => (
                        <span key={format}>{format}</span>
                      ))}
                    </div>
                  </section>
                  {campaign.pack.trendIntelligence.signals.map((signal) => (
                    <article key={`${signal.platform}-${signal.format}`} className="trendSignalCard">
                      <div className="trendSignalHead">
                        <div>
                          <p>{signal.platform} | {signal.sourceLabel}</p>
                          <h3>{signal.format}</h3>
                        </div>
                        <div className="score compact">
                          <strong>{signal.confidence}</strong>
                          <ScoreBar value={signal.confidence} />
                        </div>
                      </div>
                      <p>{signal.trendSignal}</p>
                      <div className="productionAssetPills trendFitPills">
                        <span>Organic fit {Math.round(signal.organicFit || signal.confidence)}</span>
                        <span>Paid fit {Math.round(signal.paidFit || signal.confidence)}</span>
                        <span>Transfer {Math.round(signal.transferability || signal.confidence)}</span>
                        <span>Safety {Math.round(signal.businessSafety || 75)}</span>
                        <span>Risk {Math.round(signal.complianceRisk || 0)}</span>
                      </div>
                      <dl className="publishDetails">
                        <div>
                          <dt>Why now</dt>
                          <dd>{signal.whyNow}</dd>
                        </div>
                        <div>
                          <dt>Remix formula</dt>
                          <dd>{signal.formulaSummary || signal.remixFormula}</dd>
                        </div>
                        <div>
                          <dt>Hook pattern</dt>
                          <dd>{signal.hookPatterns?.[0] || signal.remixFormula}</dd>
                        </div>
                        <div>
                          <dt>Shot pattern</dt>
                          <dd>{signal.shotPatterns?.slice(0, 2).join(" / ") || signal.recommendedAssetType}</dd>
                        </div>
                        <div>
                          <dt>Organic play</dt>
                          <dd>{signal.organicPlay}</dd>
                        </div>
                        <div>
                          <dt>Paid variant</dt>
                          <dd>{signal.paidVariant}</dd>
                        </div>
                        <div>
                          <dt>CTA pattern</dt>
                          <dd>{signal.ctaPattern || "One clear low-friction action."}</dd>
                        </div>
                      </dl>
                      <div className="queueChecklist">
                        <span>Recommended asset: {signal.recommendedAssetType}</span>
                        <span>Cost level: {signal.costLevel}</span>
                        <span>Funnel: {signal.funnelStage}</span>
                        <span>Decay risk: {Math.round(signal.decayRisk || 0)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {view === "videos" ? (
                <div className="sectionStack">
                  <section className="assetBundlePanel">
                    <div>
                      <p className="eyebrow">Generated Asset Pack</p>
                      <h3>
                        {isPlanningActive(campaign)
                          ? "Campaign workspace created. AI planning is preparing the full pack now."
                          : hasActiveRender(campaign)
                          ? "Scripts, captions, thumbnails, and schedules are ready while MP4 previews render."
                          : "Videos, scripts, captions, thumbnails, and approvals are ready to inspect."}
                      </h3>
                      <p>
                        This customer-facing bundle uses the selected {campaign.intake.videoSettings.durationSeconds}s{" "}
                        {formatStatus(campaign.intake.videoSettings.qualityMode)} video settings, with voiceover text,
                        shot sequence, caption, hashtags, CTA, and publishing risk checks attached to every concept.
                      </p>
                    </div>
                    <div className="assetBundleGrid">
                      <span>
                        <Play size={15} />
                        {campaign.pack.videoAssets.length || campaign.pack.videoConcepts.length} MP4 previews
                      </span>
                      <span>
                        <FileText size={15} />
                        Full scripts
                      </span>
                      <span>
                        <MessageCircle size={15} />
                        Captions and hashtags
                      </span>
                      <span>
                        <ShieldCheck size={15} />
                        Approval checks
                      </span>
                    </div>
                    <div className={`renderQueuePanel ${renderStatus.state}`}>
                      <div>
                        <strong>{renderStatus.label}</strong>
                        <p>{renderStatus.detail}</p>
                      </div>
                      {isPlanningFailed(campaign) ? (
                        <button disabled={manualRenderLoading} onClick={runPlanningNow} type="button">
                          {manualRenderLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                          Retry planning
                        </button>
                      ) : hasFailedRender(campaign) ? (
                        <button disabled={manualRenderLoading} onClick={runRenderNow} type="button">
                          {manualRenderLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                          Retry renders
                        </button>
                      ) : null}
                    </div>
                  </section>
                  <section className="aiMediaPanel" aria-label="AI media generation controls">
                    <div className="aiMediaHeader">
                      <div>
                        <p className="eyebrow">AI Media Pipeline</p>
                        <h3>Generate and inspect real AI video assets</h3>
                        <p>
                          Build the shot plan, create a full-frame reference image, generate vertical clips, or assemble
                          a final review video. Exact text, proof, pricing, captions, and logos stay in post-production.
                        </p>
                      </div>
                      <div className="aiMediaActions">
                        <button
                          className="secondaryButton"
                          disabled={Boolean(mediaJobLoading)}
                          onClick={() => runMediaJob("dry-run", false)}
                          type="button"
                        >
                          {mediaJobLoading === "dry-run" ? <Loader2 className="spin" size={16} /> : <ClipboardList size={16} />}
                          Plan shots
                        </button>
                        <button
                          className="secondaryButton"
                          disabled={Boolean(mediaJobLoading)}
                          onClick={() => runMediaJob("reference-frame", true)}
                          type="button"
                        >
                          {mediaJobLoading === "reference-frame" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                          Reference frame
                        </button>
                        <button
                          className="primaryButton compactPrimary"
                          disabled={Boolean(mediaJobLoading)}
                          onClick={() => runMediaJob("video-generation", true)}
                          type="button"
                        >
                          {mediaJobLoading === "video-generation" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                          Generate clip
                        </button>
                        <button
                          className="primaryButton compactPrimary"
                          disabled={Boolean(mediaJobLoading)}
                          onClick={() => runMediaJob("final-assembly", true)}
                          type="button"
                        >
                          {mediaJobLoading === "final-assembly" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                          Assemble final
                        </button>
                      </div>
                    </div>
                    {mediaJobStatus ? <p className="aiMediaStatus">{mediaJobStatus}</p> : null}
                    {mediaJobResult ? (
                      <div className="aiMediaResult">
                        <div className="productionAssetPills">
                          <span>{formatStatus(mediaJobResult.status)}</span>
                          <span>{mediaJobResult.counts?.shots ?? 0} shots planned</span>
                          <span>{mediaJobResult.counts?.executableShots ?? 0} executable</span>
                          <span>{mediaJobResult.counts?.blockedShots ?? 0} blocked</span>
                          <span>{mediaJobResult.counts?.qaReports ?? 0} QA checks</span>
                          <span>{mediaJobResult.counts?.regenerationRequests ?? 0} fixes flagged</span>
                          <span>{mediaJobResult.counts?.generatedAssets ?? 0} assets generated</span>
                        </div>
                        {mediaJobResult.plan?.budget ? (
                          <div className="aiMediaBudgetPanel">
                            <div className="productionAssetPills">
                              <span>{formatStatus(mediaJobResult.plan.budget.status)}</span>
                              <span>Estimate {formatCents(mediaJobResult.plan.budget.estimatedCostCents)}</span>
                              <span>
                                Budget{" "}
                                {mediaJobResult.plan.budget.configuredBudgetCents > 0
                                  ? formatCents(mediaJobResult.plan.budget.configuredBudgetCents)
                                  : "not set"}
                              </span>
                              <span>
                                Premium clips {mediaJobResult.plan.budget.premiumClipsPlanned}/
                                {mediaJobResult.plan.budget.maxPremiumClips}
                              </span>
                            </div>
                            {mediaJobResult.plan.budget.blockers.length ? (
                              <ul className="aiMediaBlockers">
                                {mediaJobResult.plan.budget.blockers.map((blocker) => (
                                  <li key={blocker}>{blocker}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="aiMediaEmpty">
                                Budget and pre-generation QA gates are clear for the selected media stage.
                              </p>
                            )}
                          </div>
                        ) : null}
                        {(mediaJobResult.generatedAssets ?? []).length ? (
                          <div className="aiMediaAssetGrid">
                            {(mediaJobResult.generatedAssets ?? []).map((asset) => {
                              const url = mediaAssetUrl(asset);
                              return (
                                <article key={`${asset.type}-${asset.shotId}`} className="aiMediaAssetCard">
                                  <div className="aiMediaPreview">
                                    {(asset.type === "video-clip" || asset.type === "final-video") && url ? (
                                      <video controls muted playsInline preload="metadata">
                                        <source src={url} type="video/mp4" />
                                      </video>
                                    ) : url ? (
                                      <Image src={url} alt={`${formatStatus(asset.type)} preview`} width={180} height={320} unoptimized />
                                    ) : (
                                      <div className="aiMediaPlaceholder">
                                        <ShieldCheck size={22} />
                                        <span>{formatStatus(asset.result.status)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <strong>{formatStatus(asset.type)}</strong>
                                    <p>{asset.shotId.replaceAll("_", " ")}</p>
                                    <div className="productionAssetPills">
                                      <span>{formatStatus(asset.result.status)}</span>
                                      <span>{asset.result.asset?.provider ?? "no asset"}</span>
                                      {asset.result.qa ? <span>{formatStatus(asset.result.qa.verdict)}</span> : null}
                                      {asset.result.qa ? <span>{asset.result.qa.resolution}</span> : null}
                                    </div>
                                    {asset.result.qa?.warnings.length ? (
                                      <p className="aiMediaError">{asset.result.qa.warnings.join(" ")}</p>
                                    ) : null}
                                    {asset.result.error ? <p className="aiMediaError">{asset.result.error}</p> : null}
                                    {url ? (
                                      <a className="secondaryButton compactButton" href={url} target="_blank" rel="noreferrer">
                                        <Download size={15} />
                                        Open asset
                                      </a>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="aiMediaEmpty">
                            No media files generated for this run. Use the planned shot count and QA checks to decide
                            whether to request assets, revise claims, or run a reference-frame generation.
                          </p>
                        )}
                      </div>
                    ) : null}
                    {(campaign.pack.mediaJobs ?? []).length ? (
                      <div className="aiMediaHistory" aria-label="AI media job history">
                        <div className="miniSectionHeader">
                          <div>
                            <p className="eyebrow">Recent AI Media Runs</p>
                            <h3>Generated asset history</h3>
                          </div>
                          <Clock3 size={18} />
                        </div>
                        <div className="aiMediaHistoryList">
                          {(campaign.pack.mediaJobs ?? []).slice(0, 6).map((job) => (
                            <article key={job.id} className="aiMediaHistoryItem">
                              <div>
                                <strong>{formatStatus(job.status)} · {formatStatus(job.mode)}</strong>
                                <p>{formatDate(job.createdAt)}</p>
                                <small>{job.summary}</small>
                              </div>
                              <div className="productionAssetPills">
                                <span>{job.generatedAssets.length} results</span>
                                <span>{job.promotedAssetIds.length} promoted</span>
                                <span>{job.qaSummary.passed} passed</span>
                                <span>{job.qaSummary.regenerate} regenerate</span>
                                <span>{job.qaSummary.blocked} blocked</span>
                              </div>
                              {job.assemblySummary.length ? (
                                <div className="aiMediaAssemblyNotes">
                                  {job.assemblySummary.slice(0, 3).map((note) => (
                                    <small key={note}>{note}</small>
                                  ))}
                                </div>
                              ) : null}
                              {job.generatedAssets.length ? (
                                <div className="aiMediaHistoryAssets">
                                  {job.generatedAssets.map((asset) => (
                                    <a
                                      key={`${job.id}-${asset.type}-${asset.shotId}`}
                                      href={asset.assetUrl || undefined}
                                      aria-disabled={!asset.assetUrl}
                                      target={asset.assetUrl ? "_blank" : undefined}
                                      rel={asset.assetUrl ? "noreferrer" : undefined}
                                    >
                                      <span>{formatStatus(asset.type)}</span>
                                      <strong>{formatStatus(asset.status)}</strong>
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                  <section className="readinessSummary" aria-label="Default output readiness summary">
                    <div>
                      <strong>
                        {isPlanningActive(campaign)
                          ? "Planning queue active"
                          : hasActiveRender(campaign)
                            ? "Render queue active"
                            : "Ready for review now"}
                      </strong>
                      <p>{renderStatus.detail}</p>
                    </div>
                    <div>
                      <strong>Scheduling is prepared</strong>
                      <p>Posting windows and platform requirements are generated in the Publish and Calendar tabs.</p>
                    </div>
                    <div>
                      <strong>Notifications are set</strong>
                      <p>{campaign.intake.automationSetup.notificationChannels.join(", ")} alerts match the selected review workflow.</p>
                    </div>
                  </section>
                  {campaign.pack.videoConcepts.map((concept, index) => {
                    const asset = getCampaignVideoAsset(campaign, concept.title, index);
                    return (
                      <article key={`${concept.title}-${concept.platform}`} className="conceptBlock">
                        <div className="conceptPreview">
                          <video controls muted playsInline preload="metadata" poster={asset.posterUrl}>
                            <source src={asset.videoUrl} type="video/mp4" />
                          </video>
                          <div className="conceptPreviewMeta">
                            <span>Rendered preview MP4</span>
                            <strong>{asset.title}</strong>
                            <p>
                              {asset.provenance}
                            </p>
                            <div className="productionAssetPills">
                              <span>{formatStatus(asset.status)}</span>
                              <span>{formatStatus(asset.renderMode)}</span>
                              <span>{asset.storageProvider}</span>
                              <span>{asset.aspectRatio} preview</span>
                              <span>{asset.resolution}</span>
                              <span>{asset.durationSeconds}s render</span>
                              <span>{formatStatus(asset.qualityMode)}</span>
                              <span>Caption ready</span>
                            </div>
                            <dl className="assetProvenance">
                              <div>
                                <dt>Render style</dt>
                                <dd>{asset.renderStyle}</dd>
                              </div>
                              <div>
                                <dt>Quality brief</dt>
                                <dd>{asset.qualityInstructions}</dd>
                              </div>
                              {asset.renderError ? (
                                <div>
                                  <dt>Render issue</dt>
                                  <dd>{asset.renderError}</dd>
                                </div>
                              ) : null}
                              <div>
                                <dt>Boundary</dt>
                                <dd>{asset.usageBoundary}</dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                        <div className="conceptHead">
                          <div>
                            <p>{concept.platform}</p>
                            <h3>{concept.title}</h3>
                          </div>
                          <div className="score compact">
                            <strong>{concept.qualityScore}</strong>
                            <ScoreBar value={concept.qualityScore} />
                          </div>
                        </div>
                        <dl className="conceptDetails">
                          <div>
                            <dt>Objective</dt>
                            <dd>{concept.objective}</dd>
                          </div>
                          <div>
                            <dt>Hook</dt>
                            <dd>{concept.hook}</dd>
                          </div>
                          <div>
                            <dt>Voiceover / script</dt>
                            <dd>{concept.script}</dd>
                          </div>
                          <div>
                            <dt>CTA</dt>
                            <dd>{concept.cta}</dd>
                          </div>
                        </dl>
                        <ol className="scriptTimeline">
                          {concept.shotList.map((shot, shotIndex) => (
                            <li key={shot}>
                              <strong>{["0-3s", "3-7s", "7-12s", "CTA"][shotIndex] ?? "Cut"}</strong>
                              <span>{shot}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="assetPipelineGrid">
                          <div>
                            <strong>Source inputs</strong>
                            {asset.sourceInputs.map((input) => (
                              <span key={input}>{input}</span>
                            ))}
                          </div>
                          <div>
                            <strong>Pipeline steps</strong>
                            {asset.pipelineSteps.map((step) => (
                              <span key={step}>{step}</span>
                            ))}
                          </div>
                        </div>
                        <p className="captionLine">{concept.caption}</p>
                        <div className="hashtagLine">
                          {concept.hashtags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                        {concept.approvalRisks.length ? (
                          <div className="approvalRiskList">
                            <strong>Approval checks</strong>
                            {concept.approvalRisks.map((risk) => (
                              <span key={risk}>{risk}</span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {view === "publish" ? (
                <div className="sectionStack">
                  <section className="oauthNotice">
                    <ShieldCheck size={18} />
                    <div>
                      <strong>Account access is optional until publishing.</strong>
                      <p>
                        VIDSLOOM can prepare videos, captions, schedules, and reminders immediately. Direct posting
                        requires the customer to connect each social account and approve the requested permissions.
                      </p>
                    </div>
                  </section>
                  <section className="readinessSummary" aria-label="Publishing readiness summary">
                    <div>
                      <strong>Ready before account access</strong>
                      <p>Videos, scripts, captions, hashtags, CTAs, and schedule windows can be reviewed immediately.</p>
                    </div>
                    <div>
                      <strong>Needs permission before auto-posting</strong>
                      <p>Each platform must be connected through its account permission flow before direct posting.</p>
                    </div>
                    <div>
                      <strong>Notifications configured</strong>
                      <p>{campaign.intake.automationSetup.notificationChannels.join(", ")} alerts use the customer&apos;s preferred review rhythm.</p>
                    </div>
                  </section>
                  {campaign.pack.publishingQueue.map((task) => {
                    const key = publishingTaskKey(task);
                    const reviewState = reviewStates[key];
                    const attempt = latestPostingAttempt(key);
                    const directBusy = postingLoading === `${key}-direct-api`;
                    const manualBusy = postingLoading === `${key}-manual-assisted`;
                    return (
                      <article key={key} className="publishTask">
                        <div className="publishTaskHead">
                          <div>
                            <p>{task.platform} | {task.day} | {task.publishWindow}</p>
                            <h3>{task.conceptTitle}</h3>
                          </div>
                          <span className={`statusPill status-${task.status}`}>{task.status.replaceAll("-", " ")}</span>
                        </div>
                        <p className="captionLine">{task.caption}</p>
                        <div className="hashtagLine">
                          {task.hashtags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                        <dl className="publishDetails">
                          <div>
                            <dt>Automation</dt>
                            <dd>{task.automationMode.replaceAll("-", " ")}</dd>
                          </div>
                          <div>
                            <dt>Platform access</dt>
                            <dd>{task.platformRequirement}</dd>
                          </div>
                          <div>
                            <dt>Cost control</dt>
                            <dd>{task.costControlNote}</dd>
                          </div>
                        </dl>
                        <div className="queueChecklist">
                          {[...task.assetChecklist, ...task.approvalChecklist].map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                        <div className="postingActionPanel" aria-label={`Posting actions for ${task.conceptTitle}`}>
                          <div>
                            <strong>Posting execution</strong>
                            <p>
                              Prepare a hands-on upload kit now, or attempt direct publish only after the customer&apos;s
                              platform OAuth connection exists.
                            </p>
                          </div>
                          <div className="postingActionButtons">
                            <button
                              disabled={Boolean(postingLoading)}
                              onClick={() => runPublishingAction(key, "manual-assisted")}
                              type="button"
                            >
                              {manualBusy ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
                              Manual posting kit
                            </button>
                            <button
                              disabled={Boolean(postingLoading)}
                              onClick={() => runPublishingAction(key, "direct-api")}
                              type="button"
                            >
                              {directBusy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                              Direct publish
                            </button>
                          </div>
                          {attempt ? (
                            <div className="postingAttemptResult">
                              <span className={`statusPill status-${attempt.status}`}>{attempt.status.replaceAll("-", " ")}</span>
                              <p>{attempt.error || `${attempt.method.replaceAll("-", " ")} attempt saved.`}</p>
                              {attempt.assetUrl ? <a href={attempt.assetUrl} target="_blank" rel="noreferrer">Open MP4</a> : null}
                              {attempt.externalUrl ? <a href={attempt.externalUrl} target="_blank" rel="noreferrer">Open post</a> : null}
                              <ol>
                                {attempt.instructions.slice(0, 5).map((instruction) => (
                                  <li key={instruction}>{instruction}</li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                        </div>
                        <div className="reviewActions" aria-label={`Review controls for ${task.conceptTitle}`}>
                          <button
                            type="button"
                            className={reviewState === "approved" ? "active" : ""}
                            onClick={() => setReviewStates((current) => ({ ...current, [key]: "approved" }))}
                          >
                            <CheckCircle2 size={16} />
                            Approve
                          </button>
                          <button
                            type="button"
                            className={reviewState === "changes-requested" ? "active danger" : ""}
                            onClick={() => setReviewStates((current) => ({ ...current, [key]: "changes-requested" }))}
                          >
                            <RefreshCw size={16} />
                            Request changes
                          </button>
                          <span className="reviewStateNote">
                            {reviewState === "approved"
                              ? "Approved for scheduling."
                              : reviewState === "changes-requested"
                                ? "Marked for revision before publishing."
                                : "Waiting for owner review."}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                  {postingStatus ? <p className="formStatus">{postingStatus}</p> : null}
                </div>
              ) : null}

              {view === "calendar" ? (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Platform</th>
                        <th>Concept</th>
                        <th>Window</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.pack.calendar.map((item) => (
                        <tr key={`${item.day}-${item.conceptTitle}`}>
                          <td data-label="Day">{item.day}</td>
                          <td data-label="Platform">{item.platform}</td>
                          <td data-label="Concept">{item.conceptTitle}</td>
                          <td data-label="Window">{item.publishWindow}</td>
                          <td data-label="Reason">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {view === "evidence" ? (
                <div className="sectionStack">
                  <section className="plainSection">
                    <h3>Launch, Proof, And ROI Checklist</h3>
                    <p>
                      Use this tab to prove the campaign did real work: published links, screenshots, views, enquiries,
                      bookings, sales notes, and the next test to run. This is the evidence customers and agencies need
                      before renewing or scaling.
                    </p>
                    <div className="checkGrid">
                      {[
                        ...campaign.evidenceSummary.productEvidenceGenerated,
                        ...campaign.evidenceSummary.revenueEvidenceNeeded,
                        ...campaign.evidenceSummary.customerEvidenceNeeded
                      ].map((item) => (
                        <p key={item}>
                          <CheckCircle2 size={16} />
                          {item}
                        </p>
                      ))}
                    </div>
                  </section>
                  {activeEvidenceReview ? (
                    <section className="plainSection">
                      <div className="proofReportHeader">
                        <div>
                          <h3>Campaign Proof Report</h3>
                          <p>
                            {activeEvidenceReview.aggregate.publishedRows} live posts captured from{" "}
                            {activeEvidenceReview.publishingRows.length} scheduled rows.
                          </p>
                        </div>
                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() => copyEvidenceReport(activeEvidenceReview)}
                        >
                          <ClipboardList size={14} />
                          {copiedEvidenceId === activeEvidenceReview.id ? "Copied" : "Copy report"}
                        </button>
                      </div>
                      <div className="proofMetricGrid">
                        <span>
                          <strong>{formatCompactNumber(activeEvidenceReview.aggregate.views)}</strong>
                          Views
                        </span>
                        <span>
                          <strong>{formatCompactNumber(activeEvidenceReview.aggregate.engagement)}</strong>
                          Engagement
                        </span>
                        <span>
                          <strong>{formatNumber(activeEvidenceReview.aggregate.directMessages)}</strong>
                          DMs
                        </span>
                        <span>
                          <strong>{formatNumber(activeEvidenceReview.aggregate.bookings)}</strong>
                          Bookings
                        </span>
                        <span>
                          <strong>{formatCompactNumber(activeEvidenceReview.aggregate.directViews)}</strong>
                          Direct views
                        </span>
                        <span>
                          <strong>{formatCompactNumber(activeEvidenceReview.aggregate.directEngagement)}</strong>
                          Direct engagement
                        </span>
                      </div>
                      <div className="proofPostList">
                        {activeEvidenceReview.publishingRows.filter((row) => row.hasProofCapture || row.livePostUrl).length ? (
                          activeEvidenceReview.publishingRows
                            .filter((row) => row.hasProofCapture || row.livePostUrl)
                            .slice(0, 4)
                            .map((row) => (
                              <article key={row.taskKey} className="proofPostCard">
                                <div>
                                  <strong>{row.conceptTitle}</strong>
                                  <small>
                                    {row.platform} | {formatStatus(row.status)}
                                  </small>
                                </div>
                                <div className="proofPostStats">
                                  <span>{formatNumber(row.metrics.views)} views</span>
                                  <span>{formatNumber(row.metrics.engagement)} engagement</span>
                                  <span>{formatOptionalDate(row.capturedAt)}</span>
                                </div>
                                {row.livePostUrl ? (
                                  <a href={row.livePostUrl} target="_blank" rel="noreferrer">
                                    Open live post
                                  </a>
                                ) : null}
                                {row.directPublish ? (
                                  <p className="proofPostAutomation">
                                    Direct publish: {formatStatus(row.directPublish.status)}
                                    {row.directPublish.privacyStatus ? ` (${row.directPublish.privacyStatus})` : ""}
                                    {` | ${formatCompactNumber(row.directMetrics.views)} direct views`}
                                    {row.directPublish.updatedAt ? ` | ${formatOptionalDate(row.directPublish.updatedAt)}` : ""}
                                  </p>
                                ) : null}
                              </article>
                            ))
                        ) : (
                          <p className="muted">No live post metrics have been captured for this campaign yet.</p>
                        )}
                      </div>
                    </section>
                  ) : null}
                  <section className="plainSection">
                    <h3>Automation Steps</h3>
                    <div className="agentList">
                      {campaign.agentRuns.map((run) => (
                        <article key={`${run.agentName}-${run.startedAt}`}>
                          <Activity size={16} />
                          <div>
                            <strong>{run.agentName}</strong>
                            <span>{run.status}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          ) : (
            <div className="emptyState">
              <Sparkles size={34} />
              <h3>Generate the first campaign pack</h3>
              <p>Use the intake panel to produce a reviewable campaign, schedule, and approval-ready publishing queue.</p>
            </div>
          )}
        </section>

        <aside className="recentPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Saved Work</p>
              <h2>Recent Packs</h2>
            </div>
            <button className="iconButton" type="button" onClick={loadRecent} title="Refresh runs">
              {loadingRecent ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
          </div>
          <div className="recentList">
            {recent.length ? (
              recent.map((item) => (
                <button
                  key={campaignKey(item)}
                  type="button"
                  onClick={() => {
                    setCampaign(item);
                    setReviewStates({});
                    setView("videos");
                  }}
                >
                  <BarChart3 size={16} />
                  <span>
                    <strong>{item.intake.businessName}</strong>
                    <small>{formatDate(item.createdAt)} | {item.generationStatus === "ai-generated" ? "AI production" : "AI-assisted"}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">No runs captured yet.</p>
            )}
          </div>
          <div className="opsStrip">
            <ClipboardList size={17} />
            <span>Generated packs are saved so the campaign queue can be reviewed and improved over time.</span>
          </div>
          <div className="opsAlertOps">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Production Ops</p>
                <h2>Alert Center</h2>
              </div>
              <button className="iconButton" type="button" onClick={() => loadOpsAlerts()} title="Refresh alerts">
                {opsLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <div className="opsAlertStats">
              <span className={opsReport?.counts.critical ? "opsCritical" : ""}>
                <Bell size={15} />
                {opsReport?.counts.critical ?? 0} critical
              </span>
              <span className={opsReport?.counts.warning ? "opsWarning" : ""}>
                <ShieldCheck size={15} />
                {opsReport?.counts.warning ?? 0} warning
              </span>
              <span>
                <CheckCircle2 size={15} />
                {opsReport?.counts.suppressed ?? 0} suppressed
              </span>
            </div>
            <label className="opsSuppressedToggle">
              <input
                type="checkbox"
                checked={opsIncludeSuppressed}
                onChange={(event) => {
                  setOpsIncludeSuppressed(event.target.checked);
                  void loadOpsAlerts(event.target.checked);
                }}
              />
              Show acknowledged alerts
            </label>
            <textarea
              className="opsNoteField"
              aria-label="Alert acknowledgement note"
              value={opsNote}
              onChange={(event) => setOpsNote(event.target.value)}
            />
            <div className="opsAlertActions">
              <button className="secondaryButton" type="button" onClick={runCriticalOpsCheck} disabled={Boolean(opsAction)}>
                {opsAction === "critical-check" ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}
                Critical check
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => acknowledgeOpsAlerts(activeWarningIds, 72, "bulk-warnings")}
                disabled={Boolean(opsAction) || !activeWarningIds.length}
              >
                {opsAction === "bulk-warnings" ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />}
                Suppress warnings
              </button>
            </div>
            {opsStatus ? <p className="opsAlertStatus">{opsStatus}</p> : null}
            <div className="opsAlertList">
              {visibleOpsAlerts.length ? (
                visibleOpsAlerts.slice(0, 8).map((alert) => (
                  <article key={alert.id} className={`opsAlertCard severity-${alert.severity}${alert.suppressed ? " suppressed" : ""}`}>
                    <div className="opsAlertCardHead">
                      <div>
                        <strong>{alert.title}</strong>
                        <small>
                          {formatStatus(alert.area)} | {formatDate(alert.createdAt)}
                        </small>
                      </div>
                      <span>{alert.suppressed ? "Acknowledged" : formatStatus(alert.severity)}</span>
                    </div>
                    <p>{alert.detail}</p>
                    <small className="opsAlertActionText">{alert.action}</small>
                    {alert.suppressed ? (
                      <small className="opsSuppressedMeta">
                        Until {formatOptionalDate(alert.suppressedUntil ?? "")}
                        {alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ""}
                      </small>
                    ) : (
                      <button
                        className="secondaryButton compactButton"
                        type="button"
                        onClick={() => acknowledgeOpsAlerts([alert.id], alert.severity === "critical" ? 24 : 72, alert.id)}
                        disabled={Boolean(opsAction)}
                      >
                        {opsAction === alert.id ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                        Acknowledge
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <p className="muted">No active operational alerts.</p>
              )}
            </div>
          </div>
          <div className="pilotProofOps">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Pilot Proof</p>
                <h2>Customer Reviews</h2>
              </div>
              <button className="iconButton" type="button" onClick={loadEvidence} title="Refresh proof">
                {evidenceLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <div className="leadPipelineStats">
              <span>
                <CheckCircle2 size={15} />
                {evidence?.summary.approvedReviewCount ?? 0} approved
              </span>
              <span>
                <ShieldCheck size={15} />
                {evidence?.summary.proofPermissionCount ?? 0} proof OK
              </span>
              <span>
                <Play size={15} />
                {evidence?.summary.livePostCount ?? 0} live
              </span>
              <span>
                <Send size={15} />
                {evidence?.summary.directPublishedCount ?? 0} auto-posted
              </span>
              <span>
                <BarChart3 size={15} />
                {formatCompactNumber(evidence?.summary.totalViews ?? 0)} views
              </span>
              <span>
                <TrendingUp size={15} />
                {formatCompactNumber(evidence?.summary.totalEngagement ?? 0)} actions
              </span>
              <span>
                <BarChart3 size={15} />
                {formatCompactNumber(evidence?.summary.totalDirectViews ?? 0)} direct views
              </span>
              <span>
                <MessageCircle size={15} />
                {formatNumber((evidence?.summary.totalDirectMessages ?? 0) + (evidence?.summary.totalBookings ?? 0))} leads
              </span>
            </div>
            <p className="leadPipelineStatus">
              Sales value captured: {formatSalesBreakdown(evidence?.summary.salesByCurrency ?? [])}
            </p>
            <div className="pilotProofList">
              {evidence?.campaignReviews.length ? (
                evidence.campaignReviews.slice(0, 5).map((review) => (
                  <article key={review.id} className="pilotProofCard">
                    <div className="pilotProofCardHead">
                      <span>
                        <strong>{review.businessName}</strong>
                        <small>{formatStatus(review.overallStatus)} | {formatDate(review.updatedAt)}</small>
                      </span>
                      <button className="secondaryButton compactButton" type="button" onClick={() => copyEvidenceReport(review)}>
                        <ClipboardList size={13} />
                        {copiedEvidenceId === review.id ? "Copied" : "Report"}
                      </button>
                    </div>
                    <div className="proofMetricGrid compact">
                      <span>
                        <strong>{formatCompactNumber(review.aggregate.views)}</strong>
                        Views
                      </span>
                      <span>
                        <strong>{formatCompactNumber(review.aggregate.engagement)}</strong>
                        Actions
                      </span>
                      <span>
                        <strong>{review.aggregate.publishedRows}</strong>
                        Live posts
                      </span>
                      <span>
                        <strong>{review.aggregate.proofCapturedRows}</strong>
                        Proof rows
                      </span>
                      <span>
                        <strong>{formatCompactNumber(review.aggregate.directViews)}</strong>
                        Direct views
                      </span>
                      <span>
                        <strong>{formatCompactNumber(review.aggregate.directEngagement)}</strong>
                        Direct actions
                      </span>
                    </div>
                    <div className="proofPillRow">
                      <span>{review.approvedVideos} videos approved</span>
                      <span>{review.readyTasks} schedule rows ready</span>
                      {review.changeRequests ? <span>{review.changeRequests} edits requested</span> : null}
                      {review.proofPermission ? <span>Case-study permission</span> : null}
                    </div>
                    {review.aggregate.salesByCurrency.length ? (
                      <p className="proofMoneyLine">Sales value: {formatSalesBreakdown(review.aggregate.salesByCurrency)}</p>
                    ) : null}
                    {review.hasProofNotes ? <p>{review.proofNotes}</p> : null}
                    <div className="proofPostList compact">
                      {review.publishingRows.filter((row) => row.hasProofCapture || row.livePostUrl).length ? (
                        review.publishingRows
                          .filter((row) => row.hasProofCapture || row.livePostUrl)
                          .slice(0, 3)
                          .map((row) => (
                            <article key={row.taskKey} className="proofPostCard compact">
                              <div>
                                <strong>{row.conceptTitle}</strong>
                                <small>{row.platform}</small>
                              </div>
                              <div className="proofPostStats">
                                <span>{formatCompactNumber(row.metrics.views)} views</span>
                                <span>{formatCompactNumber(row.metrics.engagement)} actions</span>
                              </div>
                              {row.livePostUrl ? (
                                <a href={row.livePostUrl} target="_blank" rel="noreferrer">
                                  Live proof
                                </a>
                              ) : null}
                              {row.directPublish ? (
                                <p className="proofPostAutomation compactAutomation">
                                  Auto-posted: {formatStatus(row.directPublish.status)}
                                  {row.directPublish.privacyStatus ? ` (${row.directPublish.privacyStatus})` : ""}
                                  {` | ${formatCompactNumber(row.directMetrics.views)} direct views`}
                                </p>
                              ) : null}
                            </article>
                          ))
                      ) : (
                        <p className="muted">Metrics pending from customer proof capture.</p>
                      )}
                    </div>
                    <details className="proofReportDetails">
                      <summary>Client report text</summary>
                      <pre className="proofReportText">{buildProofReport(review)}</pre>
                    </details>
                  </article>
                ))
              ) : (
                <p className="muted">No customer review records yet.</p>
              )}
            </div>
          </div>
          <div className="leadPipelineOps">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Sales Pipeline</p>
                <h2>Lead Follow-Up</h2>
              </div>
              <button className="iconButton" type="button" onClick={loadLeads} title="Refresh leads">
                {leadsLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <div className="leadPipelineStats">
              <span>
                <Sparkles size={15} />
                {leadSummary?.hot ?? 0} hot
              </span>
              <span>
                <Clock3 size={15} />
                {leadSummary?.due ?? 0} due
              </span>
              <span>
                <BarChart3 size={15} />
                {leadSummary?.total ?? leads.length} total
              </span>
            </div>
            {leadStatus ? <p className="leadPipelineStatus">{leadStatus}</p> : null}
            <div className="leadPipelineList">
              {leads.length ? (
                leads.slice(0, 6).map((lead) => (
                  <article key={lead.id} className={`leadPipelineCard priority-${lead.sales.priority}`}>
                    <div className="leadPipelineHead">
                      <div>
                        <strong>{lead.businessName}</strong>
                        <small>
                          {lead.contactName} | {lead.industry}
                        </small>
                      </div>
                      <span className={lead.due ? "leadDuePill due" : "leadDuePill"}>
                        {lead.sales.score}/100
                      </span>
                    </div>
                    <div className="leadPipelineMeta">
                      <span>{lead.sales.priority}</span>
                      <span>{lead.monthlyBudget.replaceAll("-", " ")}</span>
                      <span>{lead.urgency.replaceAll("-", " ")}</span>
                    </div>
                    <p className="leadGoal">{lead.goal}</p>
                    <div className="leadScoreReasons">
                      {lead.sales.scoreReasons.slice(0, 3).map((reason) => (
                        <span key={reason}>{reason}</span>
                      ))}
                    </div>
                    <div className="leadContactActions">
                      {lead.contactLinks.email ? (
                        <a href={lead.contactLinks.email}>
                          <Mail size={14} />
                          Email
                        </a>
                      ) : null}
                      {lead.contactLinks.whatsapp ? (
                        <a href={lead.contactLinks.whatsapp} target="_blank" rel="noreferrer">
                          <MessageCircle size={14} />
                          WhatsApp
                        </a>
                      ) : null}
                      {lead.contactLinks.sms ? (
                        <a href={lead.contactLinks.sms}>
                          <PhoneCall size={14} />
                          SMS
                        </a>
                      ) : null}
                    </div>
                    <label className="leadPipelineField">
                      <span>Status</span>
                      <select
                        value={lead.sales.status}
                        onChange={(event) =>
                          updateLead(lead.id, {
                            status: event.target.value,
                            eventType: "status"
                          })
                        }
                        disabled={leadUpdatingId === lead.id}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="proposal">Proposal</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                        <option value="nurture">Nurture</option>
                      </select>
                    </label>
                    <label className="leadPipelineField">
                      <span>Next follow-up</span>
                      <input
                        type="datetime-local"
                        value={leadFollowUpDrafts[lead.id] ?? ""}
                        onChange={(event) =>
                          setLeadFollowUpDrafts((current) => ({
                            ...current,
                            [lead.id]: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="leadPipelineField">
                      <span>Task</span>
                      <textarea
                        value={leadTaskDrafts[lead.id] ?? ""}
                        onChange={(event) =>
                          setLeadTaskDrafts((current) => ({
                            ...current,
                            [lead.id]: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="leadPipelineField">
                      <span>Notes</span>
                      <textarea
                        value={leadNoteDrafts[lead.id] ?? ""}
                        onChange={(event) =>
                          setLeadNoteDrafts((current) => ({
                            ...current,
                            [lead.id]: event.target.value
                          }))
                        }
                      />
                    </label>
                    <div className="leadPipelineActions">
                      <button
                        className="secondaryButton"
                        type="button"
                        disabled={leadUpdatingId === lead.id}
                        onClick={() =>
                          updateLead(lead.id, {
                            lastContactedAt: new Date().toISOString(),
                            status: lead.sales.status === "new" ? "contacted" : lead.sales.status,
                            eventType: "contact",
                            eventSummary: "Follow-up contact attempt logged."
                          })
                        }
                      >
                        {leadUpdatingId === lead.id ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
                        Contacted
                      </button>
                      <button
                        className="secondaryButton"
                        type="button"
                        disabled={leadUpdatingId === lead.id}
                        onClick={() =>
                          updateLead(lead.id, {
                            nextFollowUpAt: fromDateTimeLocal(leadFollowUpDrafts[lead.id] ?? ""),
                            followUpTask: leadTaskDrafts[lead.id] ?? "",
                            eventType: "follow-up"
                          })
                        }
                      >
                        Save task
                      </button>
                      <button
                        className="primaryButton"
                        type="button"
                        disabled={leadUpdatingId === lead.id}
                        onClick={() =>
                          updateLead(lead.id, {
                            notes: leadNoteDrafts[lead.id] ?? "",
                            eventType: "note"
                          })
                        }
                      >
                        Save note
                      </button>
                    </div>
                    <div className="leadPipelineEvents">
                      {lead.sales.events.slice(0, 2).map((event) => (
                        <span key={event.id}>
                          {event.summary}
                          <small>{formatDate(event.createdAt)}</small>
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No leads captured yet.</p>
              )}
            </div>
          </div>
          <div className="newsletterOps">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Warm Market</p>
                <h2>Newsletter</h2>
              </div>
              <button className="iconButton" type="button" onClick={loadNewsletter} title="Refresh opt-ins">
                {newsletterLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <div className="newsletterStats">
              <span>
                <Mail size={15} />
                {newsletter?.count ?? 0} opted in
              </span>
              <span>
                <Bell size={15} />
                {newsletter?.operations?.automation.activeEnrollments ?? 0} active
              </span>
              <a href="/api/newsletter?format=csv">
                <Download size={15} />
                CSV
              </a>
            </div>
            <label className="newsletterField">
              <span>Segment</span>
              <select value={newsletterSegmentId} onChange={(event) => setNewsletterSegmentId(event.target.value)}>
                {(newsletter?.operations?.segments ?? []).map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name} ({segment.count})
                  </option>
                ))}
              </select>
            </label>
            <input
              aria-label="Newsletter subject"
              value={newsletterSubject}
              onChange={(event) => setNewsletterSubject(event.target.value)}
            />
            <textarea
              aria-label="Newsletter body"
              value={newsletterBody}
              onChange={(event) => setNewsletterBody(event.target.value)}
            />
            <div className="newsletterActions">
              <button className="secondaryButton" type="button" onClick={() => sendNewsletter("test")} disabled={Boolean(newsletterSending)}>
                {newsletterSending === "test" ? <Loader2 className="spin" size={15} /> : <Send size={15} />}
                Test
              </button>
              <button className="secondaryButton" type="button" onClick={runNewsletterAutomations} disabled={Boolean(newsletterSending)}>
                {newsletterSending === "broadcast" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                Run due
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => sendNewsletter("broadcast")}
                disabled={Boolean(newsletterSending) || !newsletter?.count}
              >
                {newsletterSending === "broadcast" ? <Loader2 className="spin" size={15} /> : <Bell size={15} />}
                Broadcast
              </button>
            </div>
            {newsletterStatus ? <p className="newsletterStatus">{newsletterStatus}</p> : null}
            <div className="newsletterAutomation">
              {(newsletter?.operations?.sequences ?? []).map((sequence) => (
                <article key={sequence.id}>
                  <strong>{sequence.name}</strong>
                  <small>
                    {sequence.trigger.replaceAll("-", " ")} | {sequence.steps.length} steps
                  </small>
                </article>
              ))}
            </div>
            <div className="newsletterBroadcasts">
              {(newsletter?.operations?.broadcasts ?? []).map((broadcast) => (
                <article key={broadcast.id}>
                  <strong>{broadcast.subject}</strong>
                  <small>
                    {broadcast.status} | {broadcast.stats.sent}/{broadcast.stats.attempted} sent
                  </small>
                </article>
              ))}
            </div>
            <div className="newsletterRecent">
              {(newsletter?.contacts ?? []).map((contact) => (
                <span key={contact.id}>
                  {contact.email}
                  <small>{contact.businessName}</small>
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function getCampaignVideoAsset(campaign: PublicCampaign, conceptTitle: string, index: number): GeneratedVideoAsset {
  const existing = campaign.pack.videoAssets.find((asset) => asset.conceptTitle === conceptTitle) ?? campaign.pack.videoAssets[index];
  if (existing) return existing;

  const fallback = videoPreviewAssets[index % videoPreviewAssets.length];
  const concept = campaign.pack.videoConcepts.find((item) => item.title === conceptTitle);
  return {
    id: `fallback_asset_${index + 1}`,
    conceptTitle,
    platform: campaign.intake.platforms[index % campaign.intake.platforms.length],
    title: fallback.label,
    status: "rendered-preview",
    videoUrl: fallback.src,
    posterUrl: fallback.poster,
    sourceImageUrl: "",
    storageProvider: "public-sample",
    storageKey: "",
    posterStorageKey: "",
    renderMode: "sample-fallback",
    renderJobId: "",
    renderError: "",
    renderQueuedAt: "",
    renderStartedAt: "",
    renderCompletedAt: "",
    aspectRatio: "9:16",
    resolution: "720x1280",
    durationSeconds: campaign.intake.videoSettings.durationSeconds,
    qualityMode: campaign.intake.videoSettings.qualityMode,
    qualityInstructions: campaign.intake.videoSettings.qualityInstructions,
    renderStyle: "VIDSLOOM sample render with generated hook, caption, and CTA overlay",
    generatedBy: "VIDSLOOM video renderer",
    provenance: "Generated preview asset mapped from the campaign concept for review.",
    sourceInputs: [
      `Offer: ${campaign.intake.offer}`,
      `Audience: ${campaign.intake.audience}`,
      `Proof: ${campaign.intake.proofPoints || "Proof points pending customer confirmation."}`
    ],
    pipelineSteps: [
      "Campaign concept selected",
      "Script and caption prepared",
      "Vertical preview rendered",
      "Approval checks attached"
    ],
    outputIncludes: ["MP4 preview", "Poster frame", "Script", "Caption", "CTA"],
    usageBoundary:
      "This is a VIDSLOOM-generated preview asset for review. Final customer publishing should use approved customer assets, claims, and permissions.",
    aiMediaQa: defaultAiMediaQa(),
    qualityGate: concept?.qualityGate ?? {
      status: "needs-review",
      score: 0,
      minPublishScore: 78,
      checks: [],
      publishBlockers: [],
      nextActions: ["Review proof, claims, storyboard, and final MP4 before publishing."]
    },
    createdAt: campaign.createdAt
  };
}

function defaultAiMediaQa(): GeneratedVideoAsset["aiMediaQa"] {
  return {
    verdict: "not-run",
    firstThreeSecondImpact: 0,
    motionCoherence: 0,
    artifactRisk: 0,
    textOrLogoLeak: false,
    failureReasons: [],
    qaSource: "not-run"
  };
}

function formatStatus(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
