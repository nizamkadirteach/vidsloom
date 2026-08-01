import type { Campaign, CustomerAsset } from "@/lib/schemas";
import { createId } from "@/lib/id";
import { analyzeCustomerAssets } from "@/lib/media-generation/asset-intelligence";
import { buildMediaBudgetPlan } from "@/lib/media-generation/cost-controls";
import { buildProductionBrief, buildShotPlans, compilePromptPackets } from "@/lib/media-generation/prompt-compiler";
import { buildRegenerationRequests, runDeterministicMediaQa } from "@/lib/media-generation/media-qa";
import {
  MediaJobSchema,
  MediaProductionPlanSchema,
  RenderCompositionSchema,
  type MediaJob,
  type MediaProductionPlan,
  type MediaShotPlan
} from "@/lib/media-generation/schemas";

export function buildMediaProductionPlan({
  campaign,
  customerAssets = [],
  mode = "dry-run",
  maxShots
}: {
  campaign: Campaign;
  customerAssets?: CustomerAsset[];
  mode?: MediaProductionPlan["mode"];
  maxShots?: number;
}): MediaProductionPlan {
  const createdAt = new Date().toISOString();
  const productionBrief = buildProductionBrief({ campaign, customerAssets });
  const assetAnalyses = analyzeCustomerAssets(customerAssets);
  const selectedConcepts = campaign.pack.videoConcepts.slice(0, maxConceptsForMode(mode));
  const shotPlans = selectedConcepts.flatMap((concept) =>
    buildShotPlans({ campaign, concept, customerAssets, assetAnalyses })
  );
  const promptPackets = compilePromptPackets({ brief: productionBrief, shotPlans });
  const qaReports = shotPlans.map((shot) => {
    const promptPacket = promptPackets.find((packet) => packet.shotId === shot.id);
    if (!promptPacket) throw new Error(`No prompt packet compiled for shot ${shot.id}.`);
    return runDeterministicMediaQa({ shot, promptPacket });
  });
  const budget = buildMediaBudgetPlan({ shotPlans, qaReports, mode, maxShots });
  const regenerationRequests = buildRegenerationRequests({ shotPlans, qaReports });
  const renderCompositions = selectedConcepts.map((concept) => {
    const conceptShots = shotPlans.filter((shot) => shot.conceptTitle === concept.title);
    return RenderCompositionSchema.parse({
      id: createId("composition"),
      campaignId: campaign.id,
      conceptTitle: concept.title,
      aspectRatio: "9:16",
      durationSeconds: campaign.intake.videoSettings.durationSeconds,
      sourceShotIds: conceptShots.map((shot) => shot.id),
      sourceProofIds: [...new Set(conceptShots.flatMap((shot) => shot.requiredProofIds))],
      assemblyStrategy: assemblyStrategyFor(conceptShots),
      safeZoneSpec: buildSafeZoneSpec(conceptShots),
      overlaySpec: buildOverlaySpec(conceptShots),
      subtitleSpec: buildSubtitleSpec(conceptShots),
      audioSpec: buildAudioSpec(campaign),
      thumbnailSpec: buildThumbnailSpec(conceptShots),
      loudnessTarget: campaign.intake.creativeSettings.voiceoverStyle === "none"
        ? "-14 LUFS integrated, music and effects controlled"
        : "-14 LUFS integrated, voiceover remains clearly above music",
      ctaSpec: buildCtaSpec(conceptShots),
      exportVariants: [concept.platform]
    });
  });
  const jobs = buildMediaJobs({ campaign, shotPlans, createdAt, mode });
  const blocked = qaReports.some((report) => report.status === "blocked");
  const needsAssets = qaReports.some((report) => report.status === "needs-customer-assets");

  return MediaProductionPlanSchema.parse({
    id: createId("media_plan"),
    campaignId: campaign.id,
    customerId: campaign.customerId,
    createdAt,
    mode,
    productionBrief,
    assetAnalyses,
    shotPlans,
    promptPackets,
    qaReports,
    regenerationRequests,
    renderCompositions,
    jobs,
    budget,
    publicSummary: {
      status: blocked ? "blocked" : needsAssets ? "needs-assets" : "ready-for-preview",
      message: blocked
        ? "One or more shots are blocked by proof or claim-safety rules."
        : needsAssets
          ? "The campaign can be planned, but stronger customer assets are needed for final generation."
          : "The campaign is ready for reference-frame or preview generation.",
      nextActions: publicNextActions({ needsAssets, blocked, mode })
    }
  });
}

function buildMediaJobs({
  campaign,
  shotPlans,
  createdAt,
  mode
}: {
  campaign: Campaign;
  shotPlans: MediaShotPlan[];
  createdAt: string;
  mode: MediaProductionPlan["mode"];
}): MediaJob[] {
  const baseJobs = [
    MediaJobSchema.parse({
      id: createId("media_job"),
      customerId: campaign.customerId,
      campaignId: campaign.id,
      jobType: "asset-analysis",
      status: "completed",
      costTier: "preview",
      publicStatus: "Customer assets analyzed for production readiness.",
      createdAt,
      startedAt: createdAt,
      completedAt: createdAt,
      nextAction: "Use asset analysis to select references per shot."
    }),
    MediaJobSchema.parse({
      id: createId("media_job"),
      customerId: campaign.customerId,
      campaignId: campaign.id,
      jobType: "prompt-compile",
      status: "completed",
      costTier: "preview",
      publicStatus: "Shot-level production prompts compiled.",
      createdAt,
      startedAt: createdAt,
      completedAt: createdAt,
      nextAction: "Queue reference frames or previews when enabled."
    })
  ];

  const shotJobs = shotPlans.flatMap((shot) => [
    MediaJobSchema.parse({
      id: createId("media_job"),
      customerId: campaign.customerId,
      campaignId: campaign.id,
      conceptTitle: shot.conceptTitle,
      shotId: shot.id,
      jobType: "reference-frame",
      status: mode === "dry-run" ? "planned" : "queued",
      costTier: shot.costTier,
      publicStatus: `Reference frame planned for ${shot.role} shot.`,
      createdAt,
      nextAction: "Generate or approve the reference frame before video generation."
    }),
    MediaJobSchema.parse({
      id: createId("media_job"),
      customerId: campaign.customerId,
      campaignId: campaign.id,
      conceptTitle: shot.conceptTitle,
      shotId: shot.id,
      jobType: "video-clip",
      status: mode === "video-generation" || mode === "final-assembly" ? "queued" : "planned",
      costTier: shot.costTier,
      publicStatus: `Shot-level video clip ${mode === "dry-run" ? "planned" : "queued"} for ${shot.role}.`,
      createdAt,
      nextAction: "Generate only after reference frame, proof, and budget checks pass."
    })
  ]);

  return [...baseJobs, ...shotJobs].slice(0, 200);
}

function buildOverlaySpec(shots: MediaShotPlan[]) {
  return shots
    .flatMap((shot) => [
      shot.overlayText ? `Shot ${shot.shotNumber}: overlay text "${shot.overlayText}" inside vertical safe zone.` : "",
      shot.requiredProofIds.length
        ? `Shot ${shot.shotNumber}: animate approved proof overlay ids ${shot.requiredProofIds.join(", ")}.`
        : "",
      `Shot ${shot.shotNumber}: exact captions, logos, pricing, and proof must be composited in post-production only.`,
      shot.role === "cta" ? `Shot ${shot.shotNumber}: show CTA end card with deterministic text and logo overlay.` : ""
    ])
    .filter(Boolean)
    .slice(0, 40);
}

function assemblyStrategyFor(shots: MediaShotPlan[]): "ai-clips-plus-deterministic-overlays" | "still-motion-plus-overlays" | "programmatic-proof-card" | "manual-review" {
  if (shots.some((shot) => shot.sourceType === "needs-customer-asset")) return "manual-review";
  if (shots.every((shot) => shot.sourceType === "programmatic-card" || shot.sourceType === "proof-overlay")) {
    return "programmatic-proof-card";
  }
  if (shots.every((shot) => shot.fallbackRoute === "still-motion")) return "still-motion-plus-overlays";
  return "ai-clips-plus-deterministic-overlays";
}

function buildSafeZoneSpec(shots: MediaShotPlan[]) {
  const zones = new Set(shots.flatMap((shot) => shot.expectedCleanOverlayZones));
  return [
    "Canvas is 9:16 vertical; keep critical copy in the central safe area.",
    zones.has("upper-middle") ? "Reserve upper-middle space for hook text or proof headline." : "",
    zones.has("center") ? "Reserve center space for bold subtitles and proof support." : "",
    zones.has("lower-third") ? "Reserve lower-third space without colliding with platform captions or CTA UI." : "",
    "Avoid right rail for platform engagement buttons.",
    "Avoid bottom UI region for captions, music labels, and native platform controls."
  ]
    .filter(Boolean)
    .slice(0, 16);
}

function buildSubtitleSpec(shots: MediaShotPlan[]) {
  return shots
    .filter((shot) => shot.voiceoverLine)
    .map((shot) => truncate(`Shot ${shot.shotNumber} (${shot.startSecond}-${shot.endSecond}s): ${shot.voiceoverLine}`, 230))
    .slice(0, 40);
}

function buildAudioSpec(campaign: Campaign) {
  const voiceover = campaign.intake.creativeSettings.voiceoverStyle;
  const mood = campaign.intake.creativeSettings.musicMood;
  return [
    voiceover === "none" ? "No voiceover requested; subtitles and visual rhythm carry the message." : `Voiceover style: ${voiceover}.`,
    mood === "none" ? "No music bed requested." : `Music mood: ${mood}; normalize final loudness and preserve speech clarity.`
  ];
}

function buildThumbnailSpec(shots: MediaShotPlan[]) {
  const hook = shots.find((shot) => shot.role === "hook") ?? shots[0];
  const proof = shots.find((shot) => shot.role === "proof");
  return [
    hook ? `Use shot ${hook.shotNumber} as primary thumbnail candidate because it carries the hook.` : "",
    proof ? `Use shot ${proof.shotNumber} as proof-led thumbnail alternate if customer proof is approved.` : "",
    "Thumbnail headline must be deterministic overlay text, four words or fewer where possible.",
    "No fake UI, fake metrics, fake awards, or generated text inside the thumbnail image."
  ].filter(Boolean);
}

function buildCtaSpec(shots: MediaShotPlan[]) {
  const cta = shots.find((shot) => shot.role === "cta");
  return [
    cta?.overlayText ? `Primary CTA overlay: ${cta.overlayText}` : "Use one clear CTA from the approved concept.",
    "CTA must match the selected customer action: book, DM, buy, claim, learn, or request.",
    "Auto-post only after customer approval and connected social account permissions."
  ];
}

function publicNextActions({
  needsAssets,
  blocked,
  mode
}: {
  needsAssets: boolean;
  blocked: boolean;
  mode: MediaProductionPlan["mode"];
}) {
  if (blocked) {
    return [
      "Remove unsupported proof or prohibited claims.",
      "Attach approved customer proof before regenerating.",
      "Keep the concept in review-only state until QA passes."
    ];
  }

  if (needsAssets) {
    return [
      "Request real customer photos, videos, screenshots, or proof assets.",
      "Use still-motion or programmatic cards for shots that require exact text.",
      "Generate previews only after proof and usage consent are confirmed."
    ];
  }

  if (mode === "dry-run") {
    return [
      "Review the shot plan and prompt packets internally.",
      "Enable reference-frame generation in staging.",
      "Keep final publishing blocked until generated media passes QA."
    ];
  }

  return ["Proceed to the next enabled media stage.", "Run QA after every generated asset.", "Publish only after customer approval."];
}

function maxConceptsForMode(mode: MediaProductionPlan["mode"]) {
  if (mode === "dry-run") return 2;
  return 1;
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}
