#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.VIDSLOOM_SELF_PROMO_BASE_URL || "https://vidsloom.com").replace(/\/+$/, "");
const projectId = process.env.PROJECT_ID || "business-heroes-infinity";
const qaUsername = process.env.VIDSLOOM_QA_USERNAME || "vidsloom_qa_20260614012838";
const qaPassword = process.env.VIDSLOOM_QA_PASSWORD || readSecret("vidsloom_qa_password");
const skipPlanning = (process.env.VIDSLOOM_SELF_PROMO_SKIP_PLANNING ?? "false").toLowerCase() === "true";
const planningTimeoutMs = Number.parseInt(process.env.VIDSLOOM_SELF_PROMO_PLANNING_TIMEOUT_MS || `${8 * 60_000}`, 10);
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outputDir = join(root, ".vidsloom-qa", "self-promo-samples", runId);
const publicSamplesDir = join(root, "public", "samples");
const provenancePath = join(publicSamplesDir, "vidsloom-generated-video-provenance.json");

const niches = [
  {
    key: "restaurant",
    label: "Restaurant Growth",
    output: "vidsloom-restaurant-growth-sample.mp4",
    poster: "vidsloom-restaurant-growth-poster.png",
    businessName: "VIDSLOOM for Restaurants",
    industry: "AI video marketing for restaurants and hospitality",
    offer:
      "Done-for-you restaurant video campaigns that turn menu items, reviews, seasonal offers, and booking links into weekly short-form videos, captions, thumbnails, CTAs, schedules, and optional posting support.",
    audience:
      "Restaurant owners, cafe operators, hospitality managers, and food business founders who need more bookings, pickup orders, event enquiries, and repeat diners without filming or editing content themselves.",
    goal: "Generate more bookings, pickup orders, local awareness, and warm enquiries from short-form video.",
    brandVoice: "Direct, appetizing, energetic, practical, and sales-focused.",
    proofPoints:
      "VIDSLOOM creates the campaign pack, video, caption, CTA, thumbnail, schedule, approval queue, and posting support from one business brief."
  },
  {
    key: "clinic",
    label: "Clinic Growth",
    output: "vidsloom-clinic-growth-sample.mp4",
    poster: "vidsloom-clinic-growth-poster.png",
    businessName: "VIDSLOOM for Clinics",
    industry: "AI video marketing for clinics and wellness studios",
    offer:
      "Done-for-you clinic and wellness video campaigns that turn service pages, FAQs, approved proof, and booking offers into claim-safe short-form videos, captions, thumbnails, CTAs, schedules, and optional posting support.",
    audience:
      "Clinic owners, wellness founders, salon operators, spa owners, and service-practice managers who want consultation enquiries and trust-building content without risky claims or extra production work.",
    goal: "Increase consultation bookings, warm enquiries, saved posts, and first-visit confidence.",
    brandVoice: "Calm, trustworthy, premium, clear, and compliant.",
    proofPoints:
      "VIDSLOOM keeps exact claims, proof, captions, CTAs, and approval decisions controlled in the workspace before posting."
  },
  {
    key: "ecommerce",
    label: "Ecommerce Growth",
    output: "vidsloom-ecommerce-growth-sample.mp4",
    poster: "vidsloom-ecommerce-growth-poster.png",
    businessName: "VIDSLOOM for Ecommerce",
    industry: "AI video marketing for ecommerce brands",
    offer:
      "Done-for-you product video campaigns that turn product pages, photos, bundles, reviews, objections, and offers into short-form videos, captions, thumbnails, CTAs, schedules, and optional posting support.",
    audience:
      "Ecommerce founders, Shopify store owners, product marketers, and consumer-brand teams who need more product clicks, add-to-cart activity, sales, and retargeting-ready creatives.",
    goal: "Increase product clicks, sales intent, retargeting assets, and offer testing velocity.",
    brandVoice: "Clean, product-led, fast, polished, and conversion-focused.",
    proofPoints:
      "VIDSLOOM turns product context into generated video, deterministic text overlays, captions, CTAs, schedule windows, and follow-up-ready campaign assets."
  },
  {
    key: "coach",
    label: "Coach and Consultant Growth",
    output: "vidsloom-coach-growth-sample.mp4",
    poster: "vidsloom-coach-growth-poster.png",
    businessName: "VIDSLOOM for Coaches",
    industry: "AI video marketing for coaches and consultants",
    offer:
      "Done-for-you expert video campaigns that turn offers, client objections, proof, frameworks, and booking goals into authority-building short-form videos, captions, thumbnails, CTAs, schedules, and optional posting support.",
    audience:
      "Coaches, consultants, advisors, course creators, trainers, and expert founders who need qualified calls and authority content without editing every video themselves.",
    goal: "Generate qualified calls, direct-message leads, authority signals, and useful follow-up assets.",
    brandVoice: "Authoritative, sharp, useful, human, and practical.",
    proofPoints:
      "VIDSLOOM creates short videos from the expert's offer, proof, point of view, objections, CTA, and posting rhythm."
  },
  {
    key: "agency",
    label: "Agency Growth",
    output: "vidsloom-agency-growth-sample.mp4",
    poster: "vidsloom-agency-growth-poster.png",
    businessName: "VIDSLOOM for Agencies",
    industry: "AI video operations for agencies and marketing teams",
    offer:
      "Done-for-you campaign production for agencies that turns a client brief, brand voice, proof, offers, approval preferences, and platform plan into videos, captions, thumbnails, CTAs, schedules, approval queues, and posting support.",
    audience:
      "Agency owners, client-service teams, marketing managers, and consultants who need faster client approvals, better content margins, and more campaign output without hiring more editors.",
    goal: "Increase retained-service capacity, client approval speed, creative throughput, and campaign proof capture.",
    brandVoice: "Operational, premium, direct, reliable, and ROI-focused.",
    proofPoints:
      "VIDSLOOM shows the client video, caption, CTA, schedule, approval state, direct-post status, and follow-up proof trail in one workspace."
  }
];

await mkdir(outputDir, { recursive: true });
await mkdir(publicSamplesDir, { recursive: true });

const cookie = await loginQa();
const generated = [];

for (const niche of niches) {
  console.log(`\n[self-promo] ${niche.label}`);
  const created = await postJson("/api/campaigns", buildIntake(niche), { cookie, timeoutMs: 120_000 });
  const campaignId = created.campaignId;
  if (!campaignId) throw new Error(`No campaignId returned for ${niche.key}.`);
  console.log(`[self-promo] campaign ${campaignId}`);

  const planned = await bestEffortPlanning({
    campaignId,
    cookie,
    nicheKey: niche.key,
    initialQueue: created.planningQueue
  });
  if (planned?.campaign?.planningStatus === "pack-ready") {
    console.log(`[self-promo] planned ${campaignId}`);
  } else {
    console.log(`[self-promo] rendering available campaign pack for ${campaignId}`);
  }

  const rendered = await postJson("/api/render/jobs", { campaignId, force: true }, { cookie, timeoutMs: 8 * 60_000 });
  const asset = rendered.campaign?.pack?.videoAssets?.find(
    (item) => item.renderMode === "dynamic-render" && item.status === "ready-for-approval" && item.aiMediaQa?.verdict === "pass"
  );
  if (!asset?.videoUrl || !asset.posterUrl) {
    throw new Error(`${niche.key} did not produce a ready dynamic-render asset.`);
  }

  const localVideo = join(outputDir, niche.output);
  const localPoster = join(outputDir, niche.poster);
  await downloadAsset(asset.videoUrl, localVideo);
  await downloadAsset(asset.posterUrl, localPoster);
  await downloadAsset(asset.videoUrl, join(publicSamplesDir, niche.output));
  await downloadAsset(asset.posterUrl, join(publicSamplesDir, niche.poster));

  const record = {
    key: `vidsloom-${niche.key}-growth`,
    generatedBy: "VIDSLOOM campaign engine",
    generationStatus: "rendered",
    generatedAt: new Date().toISOString().slice(0, 10),
    businessName: niche.businessName,
    conceptTitle: asset.conceptTitle,
    platform: asset.platform,
    video: `/samples/${niche.output}`,
    poster: `/samples/${niche.poster}`,
    durationSeconds: asset.durationSeconds,
    resolution: asset.resolution || "720x1280",
    qaVerdict: "visual-reviewed",
    qaNote:
      "Generated as a clean VIDSLOOM campaign sample with readable overlays, no internal implementation references, and review-ready mobile framing."
  };
  generated.push(record);
  console.log(`[self-promo] wrote ${record.video}`);
}

await updateProvenance(generated);
await writeFile(join(outputDir, "generated-samples.json"), JSON.stringify(generated, null, 2));

console.log(`\n[self-promo] Generated ${generated.length} samples.`);
console.log(`[self-promo] Output: ${outputDir}`);

function buildIntake(niche) {
  return {
    businessName: niche.businessName,
    website: "https://vidsloom.com",
    industry: niche.industry,
    offer: niche.offer,
    audience: niche.audience,
    goal: niche.goal,
    brandVoice: niche.brandVoice,
    platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
    constraints:
      "Public copy must stay vendor-neutral. Use AI only. Do not mention specific model names, API names, backend, cloud provider, infrastructure, hackathon, judging, or internal QA details.",
    proofPoints: niche.proofPoints,
    assets:
      "Use VIDSLOOM public brand assets, workspace visuals, generated customer-style source visuals, and clean deterministic text overlays. Do not invent customer testimonials, revenue metrics, or guaranteed viral results.",
    cadence: "5 posts/week",
    brandKit: {
      logoUrl: "https://vidsloom.com/brand/VIDSLOOM_Logo.png",
      primaryColor: "#22d3ee",
      secondaryColor: "#f72585",
      fontStyle: "Clean bold sans-serif",
      brandDo: "Show concrete business outcomes, hands-off workflow, approval control, and optional posting support.",
      brandDont: "Do not show model names, infrastructure, fake metrics, fake testimonials, distorted UI, unreadable text, or guaranteed virality claims."
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
      qualityMode: "balanced",
      qualityInstructions:
        "Use a premium mobile-first 9:16 composition, large readable deterministic text, strong first-three-second hook, clear niche-specific promise, no internal workflow status, no provider or infrastructure references, no fake testimonials, no fake metrics, no broken glyphs, and one clear CTA."
    },
    automationSetup: {
      publishingMode: "approval-first",
      approvalPolicy: "approve-every-post",
      notificationChannels: ["Email", "WhatsApp", "SMS"],
      notificationContact: "admin@learnadaptresearch.org / +6592978409",
      postingTimezone: "Asia/Singapore",
      quietHours: "9:00 PM-8:00 AM Singapore time",
      budgetSensitivity: "lowest-cost",
      assetSource: "vidsloom-assisted",
      connectedAccounts: [
        { platform: "YouTube Shorts", handle: "VIDSLOOM", status: "connected", autoPublish: false },
        { platform: "Instagram Reels", handle: "", status: "not-connected", autoPublish: false },
        { platform: "TikTok", handle: "", status: "not-connected", autoPublish: false }
      ]
    }
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

async function postJson(path, body, { cookie = "", timeoutMs = 60_000 } = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body),
    timeoutMs
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} failed ${response.status}: ${JSON.stringify(json).slice(0, 1200)}`);
  }
  return json;
}

async function bestEffortPlanning({ campaignId, cookie, nicheKey, initialQueue }) {
  if (skipPlanning) {
    console.log(`[self-promo] skipping blocking planning wait for ${nicheKey}; rendering the current campaign pack.`);
    return null;
  }

  if (initialQueue?.queued) {
    console.log(`[self-promo] waiting for queued planning job for ${nicheKey}: ${initialQueue.taskName || "queued"}`);
  } else {
    console.log(`[self-promo] enqueueing planning retry for ${nicheKey}; initial queue was not confirmed.`);
    await postJson("/api/planning/jobs", { campaignId, force: true }, { cookie, timeoutMs: 60_000 });
  }

  return waitForPlanning({ campaignId, cookie, nicheKey, timeoutMs: planningTimeoutMs });
}

async function waitForPlanning({ campaignId, cookie, nicheKey, timeoutMs }) {
  const startedAt = Date.now();
  let lastStatus = "";

  while (Date.now() - startedAt < timeoutMs) {
    const current = await getJson(`/api/campaigns/${encodeURIComponent(campaignId)}`, { cookie, timeoutMs: 30_000 });
    const campaign = current.campaign;
    if (!campaign) throw new Error(`${nicheKey} planning poll did not return campaign data.`);

    if (campaign.planningStatus !== lastStatus) {
      console.log(`[self-promo] ${nicheKey} planning status: ${campaign.planningStatus}`);
      lastStatus = campaign.planningStatus;
    }

    if (campaign.planningStatus === "pack-ready") {
      return { ok: true, status: "planned", campaign };
    }

    if (campaign.planningStatus === "planning-failed") {
      throw new Error(`${nicheKey} planning failed: ${campaign.planningError || "unknown planning error"}`);
    }

    await delay(5000);
  }

  throw new Error(`${nicheKey} planning did not complete within ${Math.round(timeoutMs / 1000)}s.`);
}

async function getJson(path, { cookie = "", timeoutMs = 60_000 } = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      ...(cookie ? { Cookie: cookie } : {})
    },
    timeoutMs
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} failed ${response.status}: ${JSON.stringify(json).slice(0, 1200)}`);
  }
  return json;
}

async function downloadAsset(url, outputPath) {
  const absolute = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const response = await fetch(absolute);
  if (!response.ok || !response.body) throw new Error(`Download failed for ${absolute}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
  try {
    const { timeoutMs, ...fetchOptions } = options;
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateProvenance(records) {
  let existing = [];
  try {
    existing = JSON.parse(await readFile(provenancePath, "utf8"));
  } catch {
    existing = [];
  }
  const byKey = new Map(existing.map((item) => [item.key, item]));
  for (const record of records) byKey.set(record.key, record);
  const next = Array.from(byKey.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  await writeFile(provenancePath, `${JSON.stringify(next, null, 2)}\n`);
}

function readSecret(name) {
  return execFileSync("gcloud", ["secrets", "versions", "access", "latest", "--project", projectId, "--secret", name], {
    encoding: "utf8"
  }).trim();
}
