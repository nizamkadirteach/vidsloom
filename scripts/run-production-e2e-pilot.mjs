import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { Firestore } from "@google-cloud/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.VIDSLOOM_E2E_BASE_URL || "https://vidsloom.com";
const projectId = process.env.PROJECT_ID || "business-heroes-infinity";
const environment = process.env.VIDSLOOM_E2E_ENV || "production";
const collectionPrefix = `vidsloom_${environment}`;
const customerId = process.env.VIDSLOOM_E2E_CUSTOMER_ID || "customer_internal_pilot_019a2ba004";
const resumeCampaignId = process.env.VIDSLOOM_E2E_CAMPAIGN_ID || "";
const qaUsername = process.env.VIDSLOOM_QA_USERNAME || "vidsloom_qa_20260614012838";
const qaPassword = process.env.VIDSLOOM_QA_PASSWORD || readSecret("vidsloom_qa_password");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outputDir = join(root, ".vidsloom-qa", "production-e2e", runId);
const localReferenceAssets = {
  workspace: join(root, "assets", "google-verification", "02-workspace.png"),
  logo: join(root, "assets", "brand", "VIDSLOOM_Logo.png")
};

const db = new Firestore({ projectId, ignoreUndefinedProperties: true });
const summary = {
  runId,
  baseUrl,
  projectId,
  environment,
  customerId,
  steps: [],
  artifacts: {}
};

await mkdir(outputDir, { recursive: true });

try {
  const customer = await ensurePilotCustomer();
  step("pilot-customer", {
    businessName: customer.businessName,
    email: customer.email,
    status: customer.status,
    plan: customer.plan,
    hasPortalToken: Boolean(customer.portalAccessToken)
  });

  const qaCookie = await loginQa();
  step("qa-login", { ok: true });

  let campaignId = resumeCampaignId;
  if (!campaignId) {
    const cleanup = await archivePreviousPilotAssets(customer.id);
    step("pilot-asset-cleanup", cleanup);

    const onboarding = await postJson("/api/customer/onboarding", buildOnboardingPayload(customer), {});
    step("customer-onboarding", {
      ok: onboarding.ok,
      status: onboarding.onboarding?.status,
      platforms: onboarding.onboarding?.platforms,
      publishingMode: onboarding.onboarding?.publishingMode,
      autoPostingIntent: onboarding.onboarding?.autoPostingIntent,
      notifications: summarizeNotifications(onboarding.notifications)
    });

    const assets = [];
    for (const asset of buildAssetPayloads(customer)) {
      const created = asset.filePath
        ? await postMultipartAsset("/api/customer/assets", asset, {})
        : await postJson("/api/customer/assets", asset, {});
      assets.push({
        id: created.asset?.id,
        kind: created.asset?.kind,
        label: created.asset?.label,
        qualityScore: created.asset?.qualityScore,
        readinessTags: created.asset?.readinessTags
      });
    }
    step("customer-assets", { count: assets.length, assets });

    const generated = await postJson("/api/customer/campaign", portalPayload(customer), {});
    campaignId = generated.campaignId;
    if (!campaignId) throw new Error("Customer campaign generation did not return a campaignId.");
    step("customer-campaign-created", {
      campaignId,
      planningStatus: generated.campaign?.planningStatus,
      planningQueue: summarizeQueue(generated.planningQueue)
    });
  } else {
    step("customer-campaign-created", {
      campaignId,
      resumed: true
    });
  }

  let plannedCampaign = await getCampaign(campaignId, qaCookie);
  if (plannedCampaign.planningStatus !== "pack-ready") {
    const planned = await postJson(
      "/api/planning/jobs",
      { campaignId, force: true },
      { cookie: qaCookie, timeoutMs: 12 * 60_000 }
    );
    step("planning-job", {
      status: planned.status,
      generationStatus: planned.campaign?.generationStatus,
      planningStatus: planned.campaign?.planningStatus,
      conceptCount: planned.campaign?.pack?.videoConcepts?.length,
      queue: summarizeQueue(planned.renderQueue)
    });
    plannedCampaign = planned.campaign ?? (await pollForPackReady({ campaignId, qaCookie, timeoutMs: 5 * 60_000 }));
  } else {
    step("planning-job", {
      status: "already-planned",
      generationStatus: plannedCampaign.generationStatus,
      planningStatus: plannedCampaign.planningStatus,
      conceptCount: plannedCampaign.pack?.videoConcepts?.length
    });
  }

  if (plannedCampaign?.planningStatus !== "pack-ready") {
    plannedCampaign = await pollForPackReady({ campaignId, qaCookie, timeoutMs: 5 * 60_000 });
  }
  if (plannedCampaign?.planningStatus !== "pack-ready") {
    throw new Error(`Campaign did not reach pack-ready. Current status: ${plannedCampaign?.planningStatus || "unknown"}.`);
  }

  const dryRun = await postJson(
    "/api/media/jobs",
    { campaignId, mode: "final-assembly", execute: false, maxShots: 3 },
    { cookie: qaCookie, timeoutMs: 120_000 }
  );
  step("media-dry-run", {
    status: dryRun.status,
    counts: dryRun.counts,
    budget: dryRun.plan?.budget,
    blockers: dryRun.executionBlockers
  });

  const queued = await postJson(
    "/api/media/jobs",
    { campaignId, mode: "final-assembly", execute: true, enqueue: true, maxShots: 3 },
    { cookie: qaCookie, timeoutMs: 120_000 }
  );
  step("media-queued", {
    ok: queued.ok,
    status: queued.status,
    queue: summarizeQueue(queued.queue)
  });

  let campaign = await pollForFinalVideo({ campaignId, qaCookie, timeoutMs: 12 * 60_000 });
  let finalAsset = findFinalGeneratedAsset(campaign);
  if (!finalAsset) {
    step("media-queue-timeout", { fallback: "running synchronous final assembly" });
    await postJson(
      "/api/media/jobs",
      { campaignId, mode: "final-assembly", execute: true, maxShots: 3 },
      { cookie: qaCookie, timeoutMs: 20 * 60_000 }
    );
    campaign = await pollForFinalVideo({ campaignId, qaCookie, timeoutMs: 3 * 60_000 });
    finalAsset = findFinalGeneratedAsset(campaign);
  }
  if (!finalAsset) throw new Error("No AI-generated final review video was promoted to the campaign.");
  step("media-final-asset", summarizeVideoAsset(finalAsset));

  const downloadedVideo = await downloadAsset(finalAsset.videoUrl, join(outputDir, "final-review-video.mp4"));
  const downloadedPoster = finalAsset.posterUrl
    ? await downloadAsset(finalAsset.posterUrl, join(outputDir, "final-review-poster.png"))
    : "";
  summary.artifacts.finalVideo = downloadedVideo;
  summary.artifacts.finalPoster = downloadedPoster;
  step("media-download", {
    video: downloadedVideo,
    poster: downloadedPoster
  });

  const reviewPayload = buildReviewPayload({ customer, campaign, finalAsset });
  const review = await postJson("/api/customer/review", reviewPayload, { timeoutMs: 120_000 });
  const publishRow = review.review?.publishingReviews?.find((row) => row.taskKey === reviewPayload.publishingReviews[0].taskKey);
  step("customer-review", {
    ok: review.ok,
    overallStatus: review.review?.overallStatus,
    videoReviewCount: review.review?.videoReviews?.length,
    publishingReview: publishRow
      ? {
          taskKey: publishRow.taskKey,
          status: publishRow.status,
          scheduledFor: publishRow.scheduledFor,
          autoPublishApproved: publishRow.autoPublishApproved,
          publishingJobQueued: Boolean(publishRow.publishingJobId)
        }
      : null,
    publishingAutomation: (review.publishingAutomation ?? []).map((item) => ({
      taskKey: item.taskKey,
      queued: item.queued,
      hasTaskName: Boolean(item.taskName),
      scheduleTime: item.scheduleTime,
      reason: item.reason
    }))
  });

  const publish = await postJson(
    "/api/publishing/jobs",
    {
      campaignId,
      customerId: customer.id,
      taskKey: reviewPayload.publishingReviews[0].taskKey,
      force: true
    },
    { cookie: qaCookie, timeoutMs: 10 * 60_000 }
  );
  step("publishing-job", summarizePublishingResult(publish));

  const attempts = await getJson(`/api/campaigns/${encodeURIComponent(campaignId)}/publish`, { cookie: qaCookie });
  step("publishing-attempts", {
    count: attempts.attempts?.length ?? 0,
    attempts: (attempts.attempts ?? []).slice(0, 5).map(summarizeAttempt)
  });

  const proof = await postJson(
    "/api/publishing/jobs",
    {
      campaignId,
      customerId: customer.id,
      taskKey: reviewPayload.publishingReviews[0].taskKey,
      followUpType: "proof-24h"
    },
    { cookie: qaCookie, timeoutMs: 180_000 }
  );
  step("proof-follow-up", {
    status: proof.status,
    updatedRows: proof.review?.publishingReviews?.length,
    row: proof.review?.publishingReviews?.find((row) => row.taskKey === reviewPayload.publishingReviews[0].taskKey)
      ? summarizePerformance(
          proof.review.publishingReviews.find((row) => row.taskKey === reviewPayload.publishingReviews[0].taskKey)
            .performance
        )
      : null
  });

  const evidence = await getJson("/api/evidence", { cookie: qaCookie, timeoutMs: 120_000 });
  const evidenceCampaign = evidence.campaignReviews?.find((item) => item.campaignId === campaignId);
  step("evidence-report", {
    summary: evidence.summary,
    campaign: evidenceCampaign
      ? {
          campaignId: evidenceCampaign.campaignId,
          businessName: evidenceCampaign.businessName,
          overallStatus: evidenceCampaign.overallStatus,
          approvedVideos: evidenceCampaign.approvedVideos,
          readyTasks: evidenceCampaign.readyTasks,
          aggregate: evidenceCampaign.aggregate,
          firstRow: evidenceCampaign.publishingRows?.[0]
            ? {
                platform: evidenceCampaign.publishingRows[0].platform,
                status: evidenceCampaign.publishingRows[0].status,
                directPublish: evidenceCampaign.publishingRows[0].directPublish,
                manualFallback: evidenceCampaign.publishingRows[0].manualFallback,
                hasProofCapture: evidenceCampaign.publishingRows[0].hasProofCapture
              }
            : null
        }
      : null
  });

  await saveSummary();
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
  await saveSummary();
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
}

async function ensurePilotCustomer() {
  const ref = db.collection(`${collectionPrefix}_billing_customers`).doc(customerId);
  const doc = await ref.get();
  const now = new Date().toISOString();
  const existing = doc.exists ? doc.data() : null;
  const portalAccessToken = existing?.portalAccessToken || `portal_${cryptoRandom(32)}`;
  const businessName = process.env.VIDSLOOM_E2E_BUSINESS_NAME || "VIDSLOOM";
  const contactName = process.env.VIDSLOOM_E2E_CONTACT_NAME || "VIDSLOOM QA Lead";
  const customer = {
    id: customerId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    email: process.env.VIDSLOOM_E2E_EMAIL || existing?.email || "admin@learnadaptresearch.org",
    contactName,
    businessName,
    phone: process.env.VIDSLOOM_E2E_PHONE || existing?.phone || "+65 92978409",
    plan: existing?.plan || "managed",
    status: "manual-review",
    source: existing?.source || "manual",
    leadId: existing?.leadId || "",
    stripeCustomerId: existing?.stripeCustomerId || "",
    stripeCheckoutSessionId: existing?.stripeCheckoutSessionId || "",
    stripeSubscriptionId: existing?.stripeSubscriptionId || "",
    stripePriceId: existing?.stripePriceId || "",
    amountTotal: existing?.amountTotal || 0,
    currency: existing?.currency || "sgd",
    mode: "subscription",
    onboardingStatus: "ready-for-production",
    portalAccessToken,
    portalLastAccessAt: existing?.portalLastAccessAt || "",
    events: [
      {
        id: `bill_event_${cryptoRandom(9)}`,
        createdAt: now,
        type: "note",
        summary: `Production E2E pilot started ${runId}.`,
        stripeEventId: ""
      },
      ...(existing?.events ?? [])
    ].slice(0, 80)
  };
  await ref.set(customer);
  return customer;
}

function buildOnboardingPayload(customer) {
  return {
    ...portalPayload(customer),
    websiteSocial: "https://vidsloom.com",
    industry: "AI short-form video marketing for service businesses",
    locations: "Singapore and remote customers",
    offer:
      "A hands-off AI short-form video growth pilot that turns a business offer, customer proof, and approval rules into video campaigns, captions, schedules, and posting support.",
    targetAudience:
      "Busy small-business owners, clinic operators, restaurant owners, ecommerce founders, coaches, consultants, and agency teams that need consistent short-form video output without hiring editors.",
    primaryGoal:
      "Generate approval-ready videos and at least one scheduled or directly posted YouTube Shorts campaign asset from the customer portal workflow.",
    brandVoice: "Premium, direct, practical, energetic, conversion-focused, and careful with claims.",
    proofPoints:
      "VIDSLOOM produces campaign packs, generated vertical MP4s, deterministic captions and CTA overlays, approval queues, publishing notifications, and proof follow-ups. No guaranteed revenue or virality claims.",
    assetLinks:
      "Uploaded VIDSLOOM workspace screenshot reference\nUploaded VIDSLOOM brand logo reference\nhttps://vidsloom.com/samples/vidsloom-demo-loop.mp4",
    currentContent:
      "Production landing page includes generated restaurant, service, ecommerce, and workflow sample videos.",
    competitors:
      "Video editors, social media schedulers, AI video generators, done-for-you agency retainers.",
    constraints:
      "Public-facing copy must stay vendor-neutral. Do not mention model names, cloud providers, infrastructure, internal QA, or guaranteed outcomes. Keep all exact claims in deterministic overlays.",
    platforms: ["YouTube Shorts", "Instagram Reels"],
    postingCadence: "3 posts/week",
    brandKit: {
      logoUrl: "https://vidsloom.com/favicon.svg",
      primaryColor: "#31c7d4",
      secondaryColor: "#f02d7d",
      fontStyle: "Bold clean sans-serif with mobile-first subtitles",
      brandDo: "Show concrete business value, fast first-three-second hooks, approval control, and practical publishing steps.",
      brandDont: "Do not show fake metrics, provider names, unreadable text, strange symbols, or guaranteed viral claims."
    },
    creativeSettings: {
      hookStyle: "proof-first",
      captionStyle: "bold-subtitles",
      ctaType: "book-call",
      visualStyle: "premium-clean",
      musicMood: "upbeat",
      voiceoverStyle: "narrator",
      subtitlesRequired: true
    },
    videoSettings: {
      durationSeconds: 15,
      qualityMode: "highest-quality",
      qualityInstructions:
        "Use a strong first-three-second hook, premium 9:16 mobile framing, visible product/service context, realistic motion, readable captions, claim-safe proof overlays, clean safe zones, and one clear CTA. Keep exact text, logos, prices, captions, reviews, metrics, and proof in deterministic post-production; never generate them inside AI footage."
    },
    approvalContact: customer.email,
    approvalChannels: ["Email", "WhatsApp", "SMS"],
    notificationContact: `${customer.email} / ${customer.phone || "+65 92978409"}`,
    postingTimezone: "Asia/Singapore",
    quietHours: "9:00 PM-8:00 AM Singapore time",
    budgetSensitivity: "balanced",
    assetSource: "vidsloom-assisted",
    publishingMode: "approval-first",
    approvalPolicy: "approve-every-post",
    autoPostingIntent: true,
    connectedAccounts: [
      {
        platform: "YouTube Shorts",
        handle: "@vidsloom",
        status: "connected",
        autoPublish: true
      },
      {
        platform: "Instagram Reels",
        handle: "",
        status: "not-connected",
        autoPublish: false
      }
    ],
    consentToUseAssets: true,
    understandsOauth: true,
    consentToStart: true
  };
}

function buildAssetPayloads(customer) {
  return [
    {
      ...portalPayload(customer),
      kind: "service-photo",
      label: `E2E VIDSLOOM workspace screenshot ${runId}`,
      notes: "VIDSLOOM-owned product workflow screenshot for AI video marketing workflow reference. Use only as visual guidance; exact UI text must stay deterministic and not be generated inside AI footage.",
      filePath: localReferenceAssets.workspace,
      fileName: `vidsloom-workspace-${runId}.png`,
      mimeType: "image/png",
      usageRights: "owned-or-licensed",
      usageConsent: true
    },
    {
      ...portalPayload(customer),
      kind: "logo",
      label: `E2E VIDSLOOM logo ${runId}`,
      notes: "VIDSLOOM-owned logo reference for deterministic post-production branding only. Do not use as a video-generation source.",
      filePath: localReferenceAssets.logo,
      fileName: `vidsloom-logo-${runId}.png`,
      mimeType: "image/png",
      usageRights: "owned-or-licensed",
      usageConsent: true
    },
    {
      ...portalPayload(customer),
      kind: "social-reference",
      label: `E2E public workflow sample ${runId}`,
      notes: "VIDSLOOM-owned workflow sample reference for campaign pacing, approval queue, and posting flow. Do not copy exact text or restaurant/customer-sector imagery.",
      sourceUrl: "https://vidsloom.com/samples/vidsloom-demo-loop.mp4",
      usageRights: "owned-or-licensed",
      usageConsent: true
    }
  ];
}

async function archivePreviousPilotAssets(customerId) {
  const snapshot = await db.collection(`${collectionPrefix}_customer_assets`).where("customerId", "==", customerId).limit(500).get();
  const now = new Date().toISOString();
  const batch = db.batch();
  let archived = 0;
  const archivedAssetIds = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status !== "active") continue;
    if (!/^E2E\s+/i.test(data.label || "")) continue;
    batch.update(doc.ref, { status: "archived", updatedAt: now });
    archived += 1;
    archivedAssetIds.push(doc.id);
  }

  if (archived) await batch.commit();
  return {
    archived,
    archivedAssetIds: archivedAssetIds.slice(0, 20)
  };
}

function buildReviewPayload({ customer, campaign, finalAsset }) {
  const concept = campaign.pack.videoConcepts.find((item) => item.title === finalAsset.conceptTitle)
    ?? campaign.pack.videoConcepts.find((item) => item.qualityGate?.status === "pass")
    ?? campaign.pack.videoConcepts[0];
  if (!concept) throw new Error("Campaign has no video concepts to review.");

  const task = campaign.pack.publishingQueue.find(
    (item) => item.conceptTitle === concept.title && item.platform === "YouTube Shorts"
  ) ?? campaign.pack.publishingQueue.find((item) => item.conceptTitle === concept.title) ?? campaign.pack.publishingQueue[0];
  if (!task) throw new Error("Campaign has no publishing tasks to review.");

  const now = new Date().toISOString();
  const taskKey = publishingTaskKey(task);
  return {
    ...portalPayload(customer),
    campaignId: campaign.id,
    videoReviews: [
      {
        conceptTitle: concept.title,
        status: "approved",
        note: "Production E2E approval: generated final review video is suitable for private posting workflow test.",
        updatedAt: now
      }
    ],
    publishingReviews: [
      {
        taskKey,
        conceptTitle: task.conceptTitle,
        platform: task.platform,
        day: task.day,
        status: "scheduled",
        note: "Production E2E approval: auto-posting approved for the connected YouTube Shorts account. Use private visibility unless explicitly changed.",
        scheduledFor: new Date(Date.now() - 10_000).toISOString(),
        autoPublishApproved: true,
        updatedAt: now
      }
    ],
    customerNotes:
      "Internal production E2E run for VIDSLOOM hands-off campaign generation, approval, posting, and proof workflow.",
    proofNotes:
      "Proof may be used internally to validate that VIDSLOOM can generate a real campaign pack, produce an AI-generated vertical MP4, approve it, attempt direct publishing, prepare fallback kits, and capture proof.",
    proofPermission: true
  };
}

async function loginQa() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: qaUsername, password: qaPassword, next: "/app" })
  });
  if (!response.ok) throw new Error(`QA login failed: ${response.status} ${await response.text()}`);
  const cookie = response.headers.get("set-cookie") ?? "";
  const match = cookie.match(/vidsloom_session=[^;]+/);
  if (!match) throw new Error("QA login did not return a session cookie.");
  return match[0];
}

async function pollForFinalVideo({ campaignId, qaCookie, timeoutMs }) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const data = await getJson(`/api/campaigns/${encodeURIComponent(campaignId)}`, { cookie: qaCookie });
    last = data.campaign;
    const finalAsset = findFinalGeneratedAsset(last);
    if (finalAsset) return last;
    await sleep(20_000);
  }
  return last;
}

async function pollForPackReady({ campaignId, qaCookie, timeoutMs }) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await getCampaign(campaignId, qaCookie);
    if (last?.planningStatus === "pack-ready") return last;
    if (last?.planningStatus === "planning-failed") return last;
    await sleep(20_000);
  }
  return last;
}

async function getCampaign(campaignId, qaCookie) {
  const data = await getJson(`/api/campaigns/${encodeURIComponent(campaignId)}`, { cookie: qaCookie });
  return data.campaign;
}

function findFinalGeneratedAsset(campaign) {
  return campaign?.pack?.videoAssets?.find(
    (asset) =>
      asset.renderMode === "ai-generated" &&
      asset.status === "ready-for-approval" &&
      /final review video/i.test(asset.title)
  );
}

async function downloadAsset(url, outputPath) {
  const absolute = absoluteUrl(url);
  const response = await fetch(absolute);
  if (!response.ok || !response.body) throw new Error(`Download failed for ${absolute}: ${response.status}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline(response.body, createWriteStream(outputPath));
  return outputPath;
}

async function getJson(path, { cookie = "", timeoutMs = 60_000 } = {}) {
  const response = await fetchWithTimeout(absoluteUrl(path), {
    method: "GET",
    headers: cookie ? { Cookie: cookie } : {},
    timeoutMs
  });
  return parseJsonResponse(response, path);
}

async function postJson(path, body, { cookie = "", timeoutMs = 60_000 } = {}) {
  const response = await fetchWithTimeout(absoluteUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body),
    timeoutMs
  });
  return parseJsonResponse(response, path);
}

async function postMultipartAsset(path, asset, { cookie = "", timeoutMs = 60_000 } = {}) {
  const formData = new FormData();
  formData.set("customerId", asset.customerId);
  formData.set("accessToken", asset.accessToken);
  formData.set("kind", asset.kind);
  formData.set("label", asset.label);
  formData.set("notes", asset.notes);
  formData.set("usageRights", asset.usageRights);
  formData.set("usageConsent", asset.usageConsent ? "true" : "false");
  const body = await readFile(asset.filePath);
  formData.set("file", new Blob([body], { type: asset.mimeType || "application/octet-stream" }), asset.fileName);

  const response = await fetchWithTimeout(absoluteUrl(path), {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: formData,
    timeoutMs
  });
  return parseJsonResponse(response, path);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && "cause" in error && error.cause ? `; cause: ${String(error.cause)}` : "";
    const timeoutNote = message === "This operation was aborted" ? ` after ${options.timeoutMs ?? 60_000}ms` : "";
    throw new Error(`Fetch failed for ${url}${timeoutNote}: ${message}${cause}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response, path) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(json).slice(0, 1200)}`);
  }
  return json;
}

function step(name, data) {
  const entry = { name, at: new Date().toISOString(), ...data };
  summary.steps.push(entry);
  console.log(JSON.stringify(entry));
}

async function saveSummary() {
  const summaryPath = join(outputDir, "summary.json");
  summary.artifacts.summary = summaryPath;
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
}

function portalPayload(customer) {
  return {
    customerId: customer.id,
    accessToken: customer.portalAccessToken
  };
}

function publishingTaskKey(task) {
  return `${task.platform}-${task.conceptTitle}-${task.day}-${task.publishWindow}`;
}

function summarizeQueue(queue) {
  if (!queue) return null;
  return {
    queued: queue.queued,
    mode: queue.mode,
    hasTaskName: Boolean(queue.taskName),
    scheduleTime: queue.scheduleTime,
    reason: queue.reason
  };
}

function summarizeNotifications(notifications) {
  if (!notifications) return null;
  return Object.fromEntries(
    Object.entries(notifications).map(([key, value]) => [
      key,
      value && typeof value === "object"
        ? {
            ok: value.ok,
            skipped: value.skipped,
            status: value.status,
            reason: value.reason ? "configured response included a skip reason" : undefined
          }
        : value
    ])
  );
}

function summarizeVideoAsset(asset) {
  return {
    id: asset.id,
    conceptTitle: asset.conceptTitle,
    platform: asset.platform,
    title: asset.title,
    status: asset.status,
    renderMode: asset.renderMode,
    durationSeconds: asset.durationSeconds,
    resolution: asset.resolution,
    videoUrl: asset.videoUrl,
    posterUrl: asset.posterUrl,
    qa: asset.aiMediaQa
      ? {
          verdict: asset.aiMediaQa.verdict,
          firstThreeSecondImpact: asset.aiMediaQa.firstThreeSecondImpact,
          motionCoherence: asset.aiMediaQa.motionCoherence,
          artifactRisk: asset.aiMediaQa.artifactRisk,
          textOrLogoLeak: asset.aiMediaQa.textOrLogoLeak,
          failureReasons: asset.aiMediaQa.failureReasons
        }
      : null
  };
}

function summarizePublishingResult(result) {
  return {
    status: result.status,
    reason: result.reason,
    attempt: result.attempt ? summarizeAttempt(result.attempt) : null,
    manualFallback: result.manualFallback ? summarizeAttempt(result.manualFallback) : null,
    reviewStatus: result.review?.overallStatus
  };
}

function summarizeAttempt(attempt) {
  return {
    id: attempt.id,
    platform: attempt.platform,
    method: attempt.method,
    status: attempt.status,
    requestedBy: attempt.requestedBy,
    hasAssetUrl: Boolean(attempt.assetUrl),
    hasExternalUrl: Boolean(attempt.externalUrl),
    externalUrl: attempt.externalUrl,
    providerResponse: attempt.providerResponse,
    error: attempt.error ? attempt.error.slice(0, 500) : "",
    updatedAt: attempt.updatedAt
  };
}

function summarizePerformance(performance) {
  if (!performance) return null;
  return {
    livePostUrl: performance.livePostUrl,
    directPostUrl: performance.directPostUrl,
    directPostStatus: performance.directPostStatus,
    directPostPrivacyStatus: performance.directPostPrivacyStatus,
    directPostUploadStatus: performance.directPostUploadStatus,
    directPostMetricsAt: performance.directPostMetricsAt,
    directViews: performance.directViews,
    directLikes: performance.directLikes,
    directComments: performance.directComments,
    directNotes: performance.directNotes,
    followUp24hSentAt: performance.followUp24hSentAt,
    capturedAt: performance.capturedAt
  };
}

function absoluteUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, baseUrl).toString();
}

function readSecret(name) {
  try {
    return execFileSync(
      "gcloud",
      ["secrets", "versions", "access", "latest", `--secret=${name}`, `--project=${projectId}`],
      { encoding: "utf8" }
    ).trim();
  } catch {
    return "";
  }
}

function cryptoRandom(bytes) {
  return globalThis.crypto.getRandomValues(new Uint8Array(bytes)).reduce((text, value) => {
    return `${text}${value.toString(16).padStart(2, "0")}`;
  }, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
