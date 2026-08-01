#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputDir = join(root, ".vidsloom-qa", "staging-public-refresh", runId);
const baseUrl = process.env.VIDSLOOM_STAGING_BASE_URL || "https://vidsloom-staging-696791188703.asia-southeast1.run.app";
const username = process.env.VIDSLOOM_QA_USERNAME || "vidsloom_qa_20260614012838";
const password = process.env.VIDSLOOM_QA_PASSWORD || readSecret("vidsloom_qa_password");
const maxShots = positiveInteger(process.env.VIDSLOOM_SAMPLE_MAX_SHOTS, 3);
const pollTimeoutMs = positiveInteger(process.env.VIDSLOOM_SAMPLE_POLL_TIMEOUT_MS, 45 * 60 * 1000);
const pollEveryMs = positiveInteger(process.env.VIDSLOOM_SAMPLE_POLL_EVERY_MS, 20 * 1000);
const requestedCategory = process.argv.find((arg) => arg.startsWith("--category="))?.split("=")[1] || "all";

mkdirSync(outputDir, { recursive: true });

const commonAutomation = {
  publishingMode: "approval-first",
  approvalPolicy: "approve-every-post",
  notificationChannels: ["Email", "WhatsApp"],
  notificationContact: "+65 92978409",
  postingTimezone: "Asia/Singapore",
  quietHours: "9:00 PM-8:00 AM local time",
  budgetSensitivity: "balanced",
  assetSource: "vidsloom-assisted",
  connectedAccounts: [{ platform: "YouTube Shorts", handle: "@vidsloom", status: "connected", autoPublish: false }]
};

const sampleCampaigns = [
  {
    key: "service",
    publicVideoName: "service-proof-sample.mp4",
    payload: {
      businessName: "GlowPath Aesthetic Studio",
      industry: "aesthetic clinic and wellness consultation studio",
      offer:
        "A first-visit skin consultation for busy professionals who want calm assessment, personalised routine guidance, transparent next steps, and easy appointment booking without pressure.",
      audience:
        "Busy professionals who are curious about aesthetic or wellness services but worry about hard selling, confusing treatment options, or clinics that feel intimidating.",
      goal: "Increase consultation enquiries, appointment bookings, and WhatsApp follow-up replies from busy professionals.",
      platforms: ["Instagram Reels", "TikTok", "YouTube Shorts"],
      brandVoice: "calm, premium, reassuring, clear, never pushy",
      proofPoints:
        "Calm one-to-one first consultation before any recommendation. Simple next-step plan customers can review before deciding. WhatsApp reminders and approval-first follow-up sequence.",
      cadence: "5 posts/week",
      brandKit: {
        primaryColor: "#db2777",
        secondaryColor: "#0f172a",
        fontStyle: "clean premium sans-serif",
        brandDo: "Show calm consultation, clear next steps, and professional warmth.",
        brandDont:
          "Do not show medical procedures, hard-sell claims, fake certificates, or exaggerated skin transformations."
      },
      creativeSettings: {
        hookStyle: "proof-first",
        captionStyle: "clean-premium",
        ctaType: "book-call",
        visualStyle: "premium-clean",
        musicMood: "calm-premium",
        voiceoverStyle: "narrator",
        subtitlesRequired: true
      },
      videoSettings: {
        durationSeconds: 15,
        qualityMode: "balanced",
        qualityInstructions:
          "Create a premium vertical service-business video. Use clean consultation-room, reception, skincare-product, notebook, appointment, and friendly staff motion. Do not show medical procedures, exaggerated skin transformations, clinical claims, fake certificates, fake reviews, or unreadable text inside generated footage. Leave clean space for deterministic overlays."
      },
      automationSetup: commonAutomation
    }
  },
  {
    key: "ecommerce",
    publicVideoName: "ecommerce-launch-sample.mp4",
    payload: {
      businessName: "Northstar Glow Goods",
      industry: "ecommerce skincare product brand",
      offer:
        "A three-step skincare starter bundle with cleanser, serum, and moisturiser that makes a simple routine easy to understand and quick to buy online.",
      audience:
        "Online shoppers who want a straightforward skincare routine but feel overwhelmed by too many product pages, long ingredient claims, and unclear order steps.",
      goal: "Increase product page clicks, add-to-cart intent, bundle sales, and retargeting audiences from short-form video campaigns.",
      platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
      brandVoice: "confident, fresh, direct, helpful, product-led",
      proofPoints:
        "Three simple routine steps shown visually. Bundle offer reduces decision fatigue for first-time buyers. Fast mobile checkout and follow-up reminders for abandoned carts.",
      cadence: "Launch sprint",
      brandKit: {
        primaryColor: "#7c3aed",
        secondaryColor: "#111827",
        fontStyle: "modern direct-response sans-serif",
        brandDo: "Show product handling, three routine steps, packaging texture, and fast checkout intent.",
        brandDont:
          "Do not show fake product labels, fake discounts, fake reviews, distorted packaging text, fake phone UI, or unrealistic before/after transformations."
      },
      creativeSettings: {
        hookStyle: "before-after",
        captionStyle: "bold-subtitles",
        ctaType: "buy-now",
        visualStyle: "product-demo",
        musicMood: "upbeat",
        voiceoverStyle: "narrator",
        subtitlesRequired: true
      },
      videoSettings: {
        durationSeconds: 15,
        qualityMode: "balanced",
        qualityInstructions:
          "Create a premium vertical ecommerce product video. Use product handling, unboxing, bathroom shelf, routine sequence, packaging texture, and checkout-intent scenes. Do not render fake product labels, fake discounts, fake reviews, distorted packaging text, fake phone UI, or unrealistic before/after transformations. Leave clean space for deterministic overlays."
      },
      automationSetup: commonAutomation
    }
  }
].filter((campaign) => requestedCategory === "all" || campaign.key === requestedCategory);

if (!sampleCampaigns.length) {
  throw new Error(`No sample campaign matched --category=${requestedCategory}. Use service, ecommerce, or all.`);
}

const cookie = await login();
const summaries = [];

for (const sample of sampleCampaigns) {
  const created = await post("/api/campaigns", sample.payload);
  writeJson(`${sample.key}-campaign-create.json`, created);

  const dryRun = await post("/api/media/jobs", {
    campaignId: created.campaignId,
    mode: "final-assembly",
    execute: false,
    maxShots
  });
  writeJson(`${sample.key}-dry-run.json`, dryRun);

  if (dryRun.executionBlockers?.length || dryRun.plan?.budget?.status !== "within-budget") {
    throw new Error(`${sample.key} dry-run is not executable: ${JSON.stringify(dryRun.executionBlockers || dryRun.plan?.budget?.blockers || [])}`);
  }

  const queued = await post("/api/media/jobs", {
    campaignId: created.campaignId,
    mode: "final-assembly",
    execute: true,
    enqueue: true,
    maxShots
  });
  writeJson(`${sample.key}-queued.json`, queued);

  if (!queued.ok) {
    throw new Error(`${sample.key} media job was not queued: ${queued.queue?.reason || "unknown queue error"}`);
  }

  const promoted = await waitForPromotedFinalVideo(created.campaignId, sample.key);
  const downloads = await downloadPromotedAssets(sample.key, promoted);
  summaries.push({
    key: sample.key,
    campaignId: created.campaignId,
    dryRun: {
      status: dryRun.status,
      counts: dryRun.counts,
      budget: dryRun.plan?.budget
    },
    queue: queued.queue,
    promoted: {
      title: promoted.title,
      videoUrl: promoted.videoUrl,
      posterUrl: promoted.posterUrl,
      storageKey: promoted.storageKey,
      posterStorageKey: promoted.posterStorageKey,
      aiMediaQa: promoted.aiMediaQa
    },
    downloads
  });
}

writeJson("summary.json", { outputDir, baseUrl, maxShots, summaries });
console.log(JSON.stringify({ outputDir, baseUrl, maxShots, summaries }, null, 2));

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, next: "/app" })
  });
  const text = await response.text();
  writeFileSync(join(outputDir, "login-response.json"), text);
  if (!response.ok) throw new Error(`Login failed (${response.status}): ${text}`);

  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  const cookieHeader = setCookies.map((item) => item.split(";")[0]).join("; ");
  if (!cookieHeader.includes("vidsloom_session=")) throw new Error("Login did not return a VIDSLOOM session cookie.");
  writeFileSync(join(outputDir, "cookie-header.txt"), cookieHeader, { mode: 0o600 });
  return cookieHeader;
}

async function post(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, route);
}

async function get(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { cookie }
  });
  return readJsonResponse(response, route);
}

async function readJsonResponse(response, route) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(`${route} failed (${response.status}): ${text.slice(0, 1000)}`);
  return data;
}

async function waitForPromotedFinalVideo(campaignId, key) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastCampaign;

  while (Date.now() - startedAt < pollTimeoutMs) {
    attempt += 1;
    const data = await get(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    lastCampaign = data.campaign;
    writeJson(`${key}-campaign-poll-${String(attempt).padStart(3, "0")}.json`, data);

    const promoted = data.campaign?.pack?.videoAssets?.find(
      (asset) =>
        asset.renderMode === "ai-generated" &&
        asset.status === "ready-for-approval" &&
        asset.videoUrl &&
        /final review video/i.test(asset.title)
    );
    if (promoted) return promoted;

    await sleep(pollEveryMs);
  }

  writeJson(`${key}-campaign-timeout.json`, lastCampaign ?? {});
  throw new Error(`${key} queued media job did not promote a final AI-generated video within ${Math.round(pollTimeoutMs / 1000)} seconds.`);
}

async function downloadPromotedAssets(key, promoted) {
  const videoPath = join(outputDir, `${key}-queued-final.mp4`);
  const posterPath = join(outputDir, `${key}-queued-poster.png`);
  await downloadAsset(promoted.videoUrl, videoPath);
  if (promoted.posterUrl) await downloadAsset(promoted.posterUrl, posterPath);
  return { videoPath, posterPath: promoted.posterUrl ? posterPath : "" };
}

async function downloadAsset(url, outputPath) {
  const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const response = await fetch(absoluteUrl, { headers: { cookie } });
  if (!response.ok) throw new Error(`Unable to download ${absoluteUrl} (${response.status}).`);
  const body = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, body);
}

function writeJson(name, value) {
  writeFileSync(join(outputDir, name), JSON.stringify(value, null, 2));
}

function readSecret(name) {
  try {
    return execFileSync("gcloud", ["secrets", "versions", "access", "latest", `--secret=${name}`, "--project=business-heroes-infinity"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    throw new Error(`VIDSLOOM_QA_PASSWORD is not set and ${name} could not be read with gcloud. ${error.message}`);
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
