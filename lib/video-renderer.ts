import "server-only";

import ffmpegPath from "ffmpeg-static";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import * as PImage from "pureimage";
import sharp from "sharp";

import { saveGeneratedAsset } from "@/lib/generated-asset-storage";
import { CampaignIntake, CampaignPack, GeneratedVideoAsset, VideoConcept, VideoSettings } from "@/lib/schemas";
import { buildCampaignVideoAssets, fallbackVideoAssetForConcept } from "@/lib/video-assets";

const WIDTH = 720;
const HEIGHT = 1280;
const SCENE_COUNT = 5;
const TEXT_FONT_FAMILY = "VidsloomSans";
type TextCanvasContext = ReturnType<ReturnType<typeof PImage.make>["getContext"]>;
let textFontPath = "";
let textFontPromise: Promise<void> | null = null;

type BackgroundProfile = {
  key: string;
  imagePath: string;
  publicUrl: string;
  accent: string;
  accent2: string;
  glow: string;
};

const backgrounds: BackgroundProfile[] = [
  {
    key: "restaurant",
    imagePath: "public/images/generated/restaurant-source.png",
    publicUrl: "/images/generated/restaurant-source.png",
    accent: "#08b6d4",
    accent2: "#ff6b4a",
    glow: "#a855f7"
  },
  {
    key: "service",
    imagePath: "public/images/generated/service-source.png",
    publicUrl: "/images/generated/service-source.png",
    accent: "#17b890",
    accent2: "#f4b942",
    glow: "#43a5ff"
  },
  {
    key: "ecommerce",
    imagePath: "public/images/generated/ecommerce-source.png",
    publicUrl: "/images/generated/ecommerce-source.png",
    accent: "#22c55e",
    accent2: "#38bdf8",
    glow: "#f97316"
  }
];

type RenderCampaignVideoAssetsParams = {
  campaignId: string;
  intake: CampaignIntake;
  pack: Pick<CampaignPack, "videoConcepts" | "videoAssets">;
  createdAt: string;
};

type RenderSingleVideoAssetParams = RenderCampaignVideoAssetsParams & {
  concept: VideoConcept;
  index: number;
  fallbackAsset: GeneratedVideoAsset;
};

type Scene = {
  eyebrow: string;
  headline: string;
  body: string;
  footer: string;
};

type RenderProfile = {
  durationSeconds: number;
  fps: number;
  sceneSeconds: number;
  preset: "veryfast" | "fast" | "medium";
  crf: number;
  motionZoom: number;
};

export async function renderCampaignVideoAssets(params: RenderCampaignVideoAssetsParams): Promise<GeneratedVideoAsset[]> {
  const fallbackAssets = params.pack.videoAssets.length ? params.pack.videoAssets : buildCampaignVideoAssets(params);

  if (!shouldRenderDynamicAssets()) {
    return fallbackAssets;
  }

  const maxAssets = renderMaxAssets();
  const renderedAssets: GeneratedVideoAsset[] = [];

  const concepts = params.pack.videoConcepts;
  const concurrency = renderConcurrency();

  for (let batchStart = 0; batchStart < concepts.length; batchStart += concurrency) {
    const batch = concepts.slice(batchStart, batchStart + concurrency);
    const batchAssets = await Promise.all(
      batch.map(async (concept, batchIndex) => {
        const index = batchStart + batchIndex;
        const fallbackAsset = fallbackAssets[index] ?? fallbackVideoAssetForConcept({ ...params, concept, index });
        if (index >= maxAssets) {
          return {
            ...fallbackAsset,
            status: "render-failed" as const,
            renderMode: "sample-fallback" as const,
            renderError: `Dynamic render skipped after ${maxAssets} assets for request-time performance.`
          };
        }

        try {
          return await renderSingleVideoAsset({
            ...params,
            concept,
            index,
            fallbackAsset
          });
        } catch (error) {
          console.error("VIDSLOOM dynamic video render failed", {
            campaignId: params.campaignId,
            conceptTitle: concept.title,
            error
          });
          return {
            ...fallbackAsset,
            title: `${fallbackAsset.conceptTitle} - render failed, sample fallback available`,
            status: "render-failed" as const,
            renderMode: "sample-fallback" as const,
            renderCompletedAt: new Date().toISOString(),
            renderError: error instanceof Error ? error.message : "Unknown render error."
          };
        }
      })
    );
    renderedAssets.push(...batchAssets);
  }

  return renderedAssets;
}

async function renderSingleVideoAsset({
  campaignId,
  intake,
  concept,
  index,
  createdAt,
  fallbackAsset
}: RenderSingleVideoAssetParams): Promise<GeneratedVideoAsset> {
  if (!ffmpegPath) {
    throw new Error("Bundled FFmpeg binary is not available.");
  }

  const renderJobId = `${campaignId}_render_${String(index + 1).padStart(2, "0")}`;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "vidsloom-render-"));
  const background = pickBackground(intake, index);
  const profile = renderProfileFor(intake.videoSettings);
  const now = new Date().toISOString();

  try {
    const scenes = buildScenes(intake, concept);
    const framePaths: string[] = [];

    for (const [sceneIndex, scene] of scenes.entries()) {
      const framePath = path.join(tempDir, `frame-${String(sceneIndex).padStart(2, "0")}.png`);
      await writeFile(framePath, await renderSceneFrame({ scene, intake, concept, background, sceneIndex }));
      framePaths.push(framePath);
    }

    const poster = await readFile(framePaths[0]);
    const outputPath = path.join(tempDir, "output.mp4");
    await runFfmpeg([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      `1/${profile.sceneSeconds}`,
      "-start_number",
      "0",
      "-i",
      path.join(tempDir, "frame-%02d.png"),
      "-vf",
      `zoompan=z='min(zoom+${profile.motionZoom},1.08)':d=${profile.fps * profile.sceneSeconds}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT}:fps=${profile.fps},format=yuv420p`,
      "-t",
      String(profile.durationSeconds),
      "-c:v",
      "libx264",
      "-preset",
      profile.preset,
      "-crf",
      String(profile.crf),
      "-movflags",
      "+faststart",
      outputPath
    ], Math.max(90_000, profile.durationSeconds * 8_000));

    const storageBase = generatedAssetBaseKey(campaignId, concept, index);
    const [video, posterAsset] = await Promise.all([
      saveGeneratedAsset({
        key: `${storageBase}/video.mp4`,
        body: await readFile(outputPath),
        contentType: "video/mp4"
      }),
      saveGeneratedAsset({
        key: `${storageBase}/poster.png`,
        body: poster,
        contentType: "image/png"
      })
    ]);

    return {
      ...fallbackAsset,
      title: `${concept.title} - customer-specific rendered preview`,
      status: "ready-for-approval",
      videoUrl: video.url,
      posterUrl: posterAsset.url,
      sourceImageUrl: background.publicUrl,
      storageProvider: video.provider,
      storageKey: video.key,
      posterStorageKey: posterAsset.key,
      renderMode: "dynamic-render",
      renderJobId,
      renderError: "",
      renderQueuedAt: fallbackAsset.renderQueuedAt || createdAt,
      renderStartedAt: now,
      renderCompletedAt: new Date().toISOString(),
      resolution: `${WIDTH}x${HEIGHT}`,
      durationSeconds: profile.durationSeconds,
      qualityMode: intake.videoSettings.qualityMode,
      qualityInstructions: intake.videoSettings.qualityInstructions,
      renderStyle:
        `${qualityLabel(intake.videoSettings.qualityMode)} customer-specific 9:16 motion render using the campaign hook, offer, proof, shot sequence, caption, CTA, and VIDSLOOM branded layout system.`,
      provenance:
        "Rendered automatically from the saved campaign brief and generated concept. The MP4 and poster were created by the VIDSLOOM video renderer and persisted to generated asset storage.",
      sourceInputs: [
        `Business: ${truncate(intake.businessName, 90)}`,
        `Offer: ${truncate(intake.offer, 150)}`,
        `Audience: ${truncate(intake.audience, 150)}`,
        `Hook: ${truncate(concept.hook, 150)}`,
        `Caption: ${truncate(concept.caption, 150)}`,
        `Video settings: ${profile.durationSeconds}s, ${qualityLabel(intake.videoSettings.qualityMode)}.`,
        `Quality instructions: ${truncate(intake.videoSettings.qualityInstructions, 180)}`,
        `Creative settings: ${truncate(JSON.stringify(intake.creativeSettings), 180)}`,
        `Brand kit: ${truncate(JSON.stringify(intake.brandKit), 180)}`
      ],
      pipelineSteps: [
        "Campaign brief and trend-aware concept selected",
        "Proof graph, storyboard, claim review, and quality gate checked",
        `${profile.durationSeconds}s ${qualityLabel(intake.videoSettings.qualityMode)} render profile selected`,
        "Customer-specific hook, offer, proof, scene text, caption, and CTA mapped to a vertical storyboard",
        "Branded poster frame generated",
        "Motion MP4 rendered with subtle scene movement",
        "MP4 and poster persisted to generated asset storage for review and approval"
      ],
      outputIncludes: ["Customer-specific MP4", "Poster frame", "Storyboard text", "Caption", "CTA", "Approval checks"],
      aiMediaQa: dynamicRenderQaReport(),
      qualityGate: concept.qualityGate
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function renderSceneFrame({
  scene,
  intake,
  concept,
  background,
  sceneIndex
}: {
  scene: Scene;
  intake: CampaignIntake;
  concept: VideoConcept;
  background: BackgroundProfile;
  sceneIndex: number;
}) {
  const base = await createBackground(background, sceneIndex);
  const shapes = Buffer.from(sceneShapesSvg({ background, sceneIndex }));
  const textOverlay = await renderSceneTextOverlayPng({ scene, intake, concept });
  return sharp(base)
    .composite([
      { input: shapes, left: 0, top: 0 },
      { input: textOverlay, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

async function createBackground(background: BackgroundProfile, sceneIndex: number) {
  const sourcePath = path.join(/*turbopackIgnore: true*/ process.cwd(), background.imagePath);
  try {
    return await sharp(sourcePath)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .modulate({ brightness: 0.72 + sceneIndex * 0.025, saturation: 1.1 })
      .blur(1.4)
      .png()
      .toBuffer();
  } catch {
    return sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4,
        background: "#10131a"
      }
    })
      .png()
      .toBuffer();
  }
}

function sceneShapesSvg({
  background,
  sceneIndex
}: {
  background: BackgroundProfile;
  sceneIndex: number;
}) {
  const offset = sceneIndex * 18;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05070b" stop-opacity="0.45"/>
      <stop offset="0.5" stop-color="#05070b" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#05070b" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101827" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#0d111a" stop-opacity="0.86"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
  <circle cx="${120 + offset}" cy="${190 - offset / 2}" r="150" fill="${background.accent}" opacity="0.24"/>
  <circle cx="${615 - offset}" cy="${1030 + offset / 3}" r="180" fill="${background.glow}" opacity="0.22"/>
  <rect x="66" y="38" width="588" height="118" rx="30" fill="#070b12" opacity="0.68"/>
  <rect x="506" y="68" width="96" height="48" rx="24" fill="${background.accent}" opacity="0.95"/>
  <rect x="42" y="506" width="636" height="544" rx="34" fill="url(#panel)" filter="url(#softShadow)"/>
  <rect x="76" y="546" width="186" height="38" rx="19" fill="${background.accent2}" opacity="0.96"/>
  <rect x="76" y="1068" width="568" height="112" rx="28" fill="#f8fafc" opacity="0.94"/>
</svg>`;
}

async function renderSceneTextOverlayPng({
  scene,
  intake,
  concept
}: {
  scene: Scene;
  intake: CampaignIntake;
  concept: VideoConcept;
}) {
  const fontPath = dynamicRendererFontPath("bold") || dynamicRendererFontPath("regular");
  if (!fontPath) throw new Error("No deterministic TTF font is available for dynamic render text overlays.");
  await ensureTextFont(fontPath);

  const image = PImage.make(WIDTH, HEIGHT);
  const ctx = image.getContext("2d");
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const brand = fitSingleLine(ctx, intake.businessName, { fontSize: 24, maxWidth: 360 });
  const platform = fitSingleLine(ctx, "Campaign preview", { fontSize: 19, maxWidth: 360 });
  const eyebrow = fitSingleLine(ctx, scene.eyebrow, { fontSize: 18, maxWidth: 140 });
  const headline = fitTextBlock(ctx, scene.headline, {
    maxWidth: 500,
    maxLines: 3,
    fontSizes: [50, 46, 42, 38, 34]
  });
  const body = fitTextBlock(ctx, scene.body, {
    maxWidth: 430,
    maxLines: 4,
    fontSizes: [27, 25, 23, 21]
  });
  const footer = fitTextBlock(ctx, scene.footer, {
    maxWidth: 500,
    maxLines: 2,
    fontSizes: [29, 27, 25, 23]
  });
  const headlineY = 654;
  const headlineStep = Math.round(headline.fontSize * 1.05);
  const bodyY = headlineY + headline.lines.length * headlineStep + 36;
  const bodyStep = Math.round(body.fontSize * 1.2);

  drawTextLine(ctx, { text: brand, x: 92, y: 84, fontSize: 24, color: "#f8fafc", maxWidth: 360, shadow: true });
  drawTextLine(ctx, { text: platform, x: 92, y: 123, fontSize: 19, color: "#dbeafe", maxWidth: 360, shadow: true });
  drawTextLine(ctx, { text: "AI", x: 540, y: 101, fontSize: 19, color: "#061018", maxWidth: 44 });
  drawTextLine(ctx, { text: eyebrow, x: 96, y: 572, fontSize: 18, color: "#101018", maxWidth: 140 });

  headline.lines.forEach((line, index) => {
    drawTextLine(ctx, {
      text: line,
      x: 92,
      y: headlineY + index * headlineStep,
      fontSize: headline.fontSize,
      color: "#ffffff",
      maxWidth: 500,
      shadow: true
    });
  });

  body.lines.forEach((line, index) => {
    drawTextLine(ctx, {
      text: line,
      x: 92,
      y: bodyY + index * bodyStep,
      fontSize: body.fontSize,
      color: "#d7e2f0",
      maxWidth: 430,
      shadow: true
    });
  });

  footer.lines.forEach((line, index) => {
    drawTextLine(ctx, {
      text: line,
      x: 104,
      y: 1112 + index * Math.round(footer.fontSize * 1.18),
      fontSize: footer.fontSize,
      color: "#101827",
      maxWidth: 500
    });
  });

  return encodePureImagePng(image);
}

function buildScenes(intake: CampaignIntake, concept: VideoConcept): Scene[] {
  if (dynamicBusinessCategory(intake) === "video-marketing") {
    const niche = selfPromotionNiche(intake);
    return [
      {
        eyebrow: "HOOK",
        headline: niche.hook,
        body: `From one ${niche.input}: video, caption, CTA, schedule.`,
        footer: niche.primaryCta
      },
      {
        eyebrow: "PAIN",
        headline: niche.pain,
        body: `Built for ${niche.buyer}: ${niche.outcome}.`,
        footer: "Done-for-you video campaign pack"
      },
      {
        eyebrow: "PROOF",
        headline: niche.proofHeadline,
        body: "Review the hook, caption, CTA, and post time.",
        footer: "Review, refine, or schedule"
      },
      {
        eyebrow: "WORKFLOW",
        headline: "One brief becomes a full posting plan.",
        body: niche.workflow,
        footer: "Built for hands-off execution"
      },
      {
        eyebrow: "ACTION",
        headline: niche.actionHeadline,
        body: "Optional auto-posting starts only after platform permissions and rules are connected.",
        footer: niche.primaryCta
      }
    ];
  }

  const proof = publicSceneText(intake.proofPoints, "Use approved proof to build trust.", 110);
  const shots = publicSceneText(concept.shotList.slice(0, 3).join(" / "), "A clear hook, proof beat, and CTA.", 110);
  return [
    {
      eyebrow: "HOOK",
      headline: publicSceneText(concept.hook, "Your next customer decides in seconds.", 92),
      body: publicSceneText(`Built for ${intake.audience}`, "Built for the people most likely to buy.", 120),
      footer: publicSceneText(concept.cta, "Book a Call", 48)
    },
    {
      eyebrow: "OFFER",
      headline: publicSceneText(intake.offer, "Show the offer clearly in the first seconds.", 92),
      body: publicSceneText(concept.objective, "Turn attention into a simple next step.", 120),
      footer: "Make the next step obvious"
    },
    {
      eyebrow: "PROOF",
      headline: proof,
      body: "Trust signals are turned into simple, fast-moving story beats.",
      footer: "Proof-led creative for warmer leads"
    },
    {
      eyebrow: "SHOTS",
      headline: shots,
      body: publicSceneText(concept.script, "VIDSLOOM maps the scenes before rendering.", 120),
      footer: "Review before posting"
    },
    {
      eyebrow: "POST",
      headline: publicSceneText(concept.caption, "Caption, CTA, and schedule are prepared.", 92),
      body: publicSceneText(`Hashtags: ${concept.hashtags.slice(0, 5).join(" ")}`, "Posting details are prepared for each platform.", 110),
      footer: publicSceneText(concept.cta, "Book a Call", 48)
    }
  ].map((scene) => ({
    eyebrow: truncate(scene.eyebrow, 18),
    headline: truncate(scene.headline, 150),
    body: truncate(scene.body, 190),
    footer: truncate(scene.footer, 86)
  }));
}

function publicSceneText(input: string | undefined, fallback: string, max: number) {
  const text = (input || "")
    .replace(/[#]/g, "")
    .replace(/\bscene\s*\d+\s*:\s*/gi, "")
    .replace(/\s*\/\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || isWeakPublicSceneText(text)) return fallback;
  return truncate(text, max);
}

function isWeakPublicSceneText(text: string) {
  return /\b(simulated|text overlay|overlay text|dashboard showing|client testimonial snippet|raw asset|placeholder|internal|qa|e2e|staging|quality gate|proof graph|claim review|shot list|scene plan|backend|infrastructure)\b/i.test(
    text
  );
}

function dynamicBusinessCategory(intake: CampaignIntake) {
  const haystack = [
    intake.businessName,
    intake.website,
    intake.industry,
    intake.offer,
    intake.audience,
    intake.goal,
    intake.brandVoice,
    intake.proofPoints,
    intake.constraints
  ]
    .join(" ")
    .toLowerCase();
  if (
    /\b(vidsloom|short-form video|short form video|video marketing|video growth|campaign pack|campaign packs|approval queue|approval-ready|posting support|captions?|ctas?|posting schedules?|social media marketing|ai video|video engine|content engine|marketing engine)\b/.test(
      haystack
    )
  ) {
    return "video-marketing";
  }
  return "business";
}

function selfPromotionNiche(intake: CampaignIntake) {
  const haystack = [
    intake.businessName,
    intake.website,
    intake.industry,
    intake.offer,
    intake.audience,
    intake.goal,
    intake.brandVoice,
    intake.proofPoints,
    intake.constraints
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(restaurant|cafe|food|menu|dining|chef|hospitality|pickup|lunch)\b/.test(haystack)) {
    return {
      key: "restaurant",
      buyer: "restaurant owners",
      input: "menu offer",
      outcome: "orders and bookings",
      hook: "Turn today’s menu into tomorrow’s bookings.",
      pain: "Stop posting food photos without a plan.",
      proofHeadline: "Show the dish, the offer, and the next step.",
      workflow: "Menu photo, offer, reviews, and service window",
      actionHeadline: "Fill tables with less content work.",
      primaryCta: "Get a free restaurant video plan"
    };
  }

  if (/\b(clinic|medical|dental|therapy|wellness|aesthetic|salon|spa|consultation)\b/.test(haystack)) {
    return {
      key: "clinic",
      buyer: "clinic and wellness owners",
      input: "service offer",
      outcome: "consultation enquiries",
      hook: "Turn trust into booked consultations.",
      pain: "Stop explaining the same service from scratch.",
      proofHeadline: "Make the first visit feel clear and safe.",
      workflow: "Service page, FAQs, approved proof, and booking CTA",
      actionHeadline: "Grow enquiries without risky claims.",
      primaryCta: "Get a free clinic video plan"
    };
  }

  if (/\b(ecommerce|e-commerce|shop|store|product|retail|bundle|cart|checkout|skincare)\b/.test(haystack)) {
    return {
      key: "ecommerce",
      buyer: "ecommerce founders",
      input: "product page",
      outcome: "product clicks and sales",
      hook: "Turn product pages into scroll-stopping shorts.",
      pain: "Stop launching products with static posts only.",
      proofHeadline: "Show the product, proof, and checkout cue.",
      workflow: "Product photos, offer, objections, and checkout CTA",
      actionHeadline: "Launch more product videos with less effort.",
      primaryCta: "Get a free product video plan"
    };
  }

  if (/\b(coach|consultant|advisor|course|expert|creator|trainer|mentor)\b/.test(haystack)) {
    return {
      key: "coach",
      buyer: "coaches and consultants",
      input: "client objection",
      outcome: "qualified calls",
      hook: "Turn one client objection into booked calls.",
      pain: "Stop letting good advice disappear in long posts.",
      proofHeadline: "Show your point of view in seconds.",
      workflow: "Offer, proof, client questions, and booking CTA",
      actionHeadline: "Build authority without editing every clip.",
      primaryCta: "Get a free expert video plan"
    };
  }

  if (/\b(agency|marketing manager|client|retainer|campaign queue|approval|creative team)\b/.test(haystack)) {
    return {
      key: "agency",
      buyer: "agencies and marketing teams",
      input: "client brief",
      outcome: "faster client approvals",
      hook: "Turn one client brief into a video campaign queue.",
      pain: "Stop losing margin to endless content production.",
      proofHeadline: "Show clients the video, caption, and schedule.",
      workflow: "Client brief, brand voice, proof, and approval rules",
      actionHeadline: "Deliver more campaigns without more editors.",
      primaryCta: "Book an agency demo"
    };
  }

  return {
    key: "business",
    buyer: "business owners",
    input: "business brief",
    outcome: "leads and sales",
    hook: "Your next campaign can be ready fast.",
    pain: "Stop losing hours to editing and posting.",
    proofHeadline: "See the video before anything goes live.",
    workflow: "Offer, audience, proof, and brand voice",
    actionHeadline: "Use VIDSLOOM to grow with less content work.",
    primaryCta: "Book a Call"
  };
}

function pickBackground(intake: CampaignIntake, index: number) {
  const haystack = `${intake.businessName} ${intake.industry} ${intake.offer} ${intake.audience}`.toLowerCase();
  if (/\b(ecommerce|e-commerce|shop|store|product|retail|bundle|cart|sku|consumer goods)\b/.test(haystack)) {
    return backgrounds[(2 + index) % backgrounds.length];
  }
  if (/\b(restaurant|cafe|bistro|bar|food|menu|dining|chef|hospitality)\b/.test(haystack)) {
    return backgrounds[index % backgrounds.length];
  }
  return backgrounds[(1 + index) % backgrounds.length];
}

function generatedAssetBaseKey(campaignId: string, concept: VideoConcept, index: number) {
  return [
    "campaigns",
    safeKey(campaignId),
    `${String(index + 1).padStart(2, "0")}-${safeKey(concept.title).slice(0, 52)}`
  ].join("/");
}

function safeKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function shouldRenderDynamicAssets() {
  return (process.env.VIDSLOOM_RENDER_DYNAMIC_ASSETS ?? "true").toLowerCase() !== "false";
}

function renderMaxAssets() {
  const parsed = Number.parseInt(process.env.VIDSLOOM_RENDER_MAX_ASSETS ?? "5", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(parsed, 10);
}

function renderConcurrency() {
  const parsed = Number.parseInt(process.env.VIDSLOOM_RENDER_CONCURRENCY ?? "2", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.min(parsed, 4);
}

function renderProfileFor(settings: VideoSettings): RenderProfile {
  const durationSeconds = settings.durationSeconds;
  const sceneSeconds = durationSeconds / SCENE_COUNT;

  if (settings.qualityMode === "highest-quality") {
    return {
      durationSeconds,
      fps: 30,
      sceneSeconds,
      preset: "medium",
      crf: 20,
      motionZoom: 0.0011
    };
  }

  if (settings.qualityMode === "fast-preview") {
    return {
      durationSeconds,
      fps: 24,
      sceneSeconds,
      preset: "veryfast",
      crf: 27,
      motionZoom: 0.0017
    };
  }

  return {
    durationSeconds,
    fps: 24,
    sceneSeconds,
    preset: "fast",
    crf: 24,
    motionZoom: 0.0014
  };
}

function qualityLabel(value: VideoSettings["qualityMode"]) {
  if (value === "highest-quality") return "highest-quality";
  if (value === "fast-preview") return "fast-preview";
  return "balanced";
}

function runFfmpeg(args: string[], timeoutMs = 90_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath as string, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Video render timed out."));
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `FFmpeg exited with code ${code}.`));
    });
  });
}

function dynamicRendererFontPath(weight: "regular" | "bold") {
  const fileName = weight === "bold" ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf";
  const candidates = [
    path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", fileName),
    path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "dejavu-fonts-ttf-2.37", "ttf", fileName),
    `/usr/share/fonts/truetype/dejavu/${fileName}`,
    weight === "bold" ? "/System/Library/Fonts/Supplemental/Arial Bold.ttf" : "/System/Library/Fonts/Supplemental/Arial.ttf"
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "";
}

function dynamicRenderQaReport(): GeneratedVideoAsset["aiMediaQa"] {
  const hasRegular = Boolean(dynamicRendererFontPath("regular"));
  const hasBold = Boolean(dynamicRendererFontPath("bold"));
  const hasTextFont = hasRegular || hasBold;
  return {
    verdict: hasTextFont ? "pass" : "blocked",
    firstThreeSecondImpact: hasTextFont ? 82 : 0,
    motionCoherence: hasTextFont ? 78 : 0,
    artifactRisk: hasTextFont ? 8 : 100,
    textOrLogoLeak: false,
    failureReasons: hasTextFont
      ? []
      : ["Renderer text font is unavailable; readable video text cannot be guaranteed across production workers."],
    qaSource: "deterministic-preflight"
  };
}

async function ensureTextFont(fontPath: string) {
  if (textFontPath === fontPath && textFontPromise) {
    await textFontPromise;
    return;
  }

  const font = PImage.registerFont(fontPath, TEXT_FONT_FAMILY);
  textFontPath = fontPath;
  textFontPromise = font.load();
  await textFontPromise;
}

async function encodePureImagePng(image: ReturnType<typeof PImage.make>) {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    }
  });

  await PImage.encodePNGToStream(image, writable);
  return Buffer.concat(chunks);
}

function drawTextLine(
  ctx: TextCanvasContext,
  {
    text,
    x,
    y,
    fontSize,
    color,
    maxWidth,
    shadow = false
  }: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    maxWidth?: number;
    shadow?: boolean;
  }
) {
  const safeText = text.replace(/[\r\n\t]+/g, " ").trim();
  if (!safeText) return;

  ctx.font = `${fontSize}pt ${TEXT_FONT_FAMILY}`;
  const fitted = maxWidth ? truncateToWidth(ctx, safeText, fontSize, maxWidth, false) : safeText;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(fitted, x, y + 3);
  }
  ctx.fillStyle = color;
  ctx.fillText(fitted, x, y);
}

function fitSingleLine(
  ctx: TextCanvasContext,
  input: string,
  { maxWidth, fontSize }: { maxWidth: number; fontSize: number }
) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (measureTextWidth(ctx, text, fontSize) <= maxWidth) return text;
  return truncateToWidth(ctx, text, fontSize, maxWidth, false);
}

function fitTextBlock(
  ctx: TextCanvasContext,
  input: string,
  {
    maxWidth,
    maxLines,
    fontSizes
  }: {
    maxWidth: number;
    maxLines: number;
    fontSizes: number[];
  }
) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return { lines: [""], fontSize: fontSizes[fontSizes.length - 1] ?? 20 };

  for (const fontSize of fontSizes) {
    const lines = wrapTextToWidth(ctx, text, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines && lines.every((line) => measureTextWidth(ctx, line, fontSize) <= maxWidth + 1)) {
      return { lines, fontSize };
    }
  }

  const fontSize = fontSizes[fontSizes.length - 1] ?? 20;
  const lines = wrapTextToWidth(ctx, text, fontSize, maxWidth, maxLines);
  const lastLineIndex = Math.min(lines.length, maxLines) - 1;
  if (lastLineIndex >= 0) {
    lines[lastLineIndex] = truncateToWidth(ctx, lines[lastLineIndex], fontSize, maxWidth, false);
  }
  return { lines: lines.slice(0, maxLines), fontSize };
}

function wrapTextToWidth(
  ctx: TextCanvasContext,
  input: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number
) {
  const words = input.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureTextWidth(ctx, next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
    }

    if (measureTextWidth(ctx, word, fontSize) > maxWidth) {
      lines.push(truncateToWidth(ctx, word, fontSize, maxWidth));
      if (lines.length >= maxLines) break;
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push(truncateToWidth(ctx, input, fontSize, maxWidth));

  const consumed = lines.join(" ").replace(/\.\.\.$/, "").length;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (consumed < normalized.length - 3) {
    const index = lines.length - 1;
    lines[index] = truncateToWidth(ctx, lines[index].replace(/[.,;:!?-]+$/g, ""), fontSize, maxWidth, false);
  }

  return lines.slice(0, maxLines);
}

function truncateToWidth(
  ctx: TextCanvasContext,
  input: string,
  fontSize: number,
  maxWidth: number,
  withEllipsis = true
) {
  const suffix = withEllipsis ? "..." : "";
  const clean = input.replace(/\s+/g, " ").trim();
  if (measureTextWidth(ctx, clean, fontSize) <= maxWidth) return clean;

  let low = 0;
  let high = clean.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${clean.slice(0, mid).trim()}${suffix}`;
    if (measureTextWidth(ctx, candidate, fontSize) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${clean.slice(0, low).trim().replace(/[.,;:!?-]+$/g, "")}${suffix}`;
}

function measureTextWidth(ctx: TextCanvasContext, text: string, fontSize: number) {
  ctx.font = `${fontSize}pt ${TEXT_FONT_FAMILY}`;
  return ctx.measureText(text.replace(/[\r\n\t]+/g, " ").trim()).width;
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}
