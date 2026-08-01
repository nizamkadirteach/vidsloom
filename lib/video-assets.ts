import type { CampaignIntake, CampaignPack, GeneratedVideoAsset, VideoConcept } from "@/lib/schemas";

type SampleAsset = {
  key: string;
  label: string;
  videoUrl: string;
  posterUrl: string;
  sourceImageUrl: string;
  renderStyle: string;
};

const sampleAssets: SampleAsset[] = [
  {
    key: "restaurant",
    label: "Local offer AI-assembled preview",
    videoUrl: "/samples/restaurant-reel-sample.mp4",
    posterUrl: "/samples/restaurant-reel-poster.png",
    sourceImageUrl: "/images/generated/restaurant-source.png",
    renderStyle: "Restaurant offer final assembly with generated motion, deterministic hook, proof, caption, brand, and order CTA overlays"
  },
  {
    key: "service",
    label: "Service booking AI-assembled preview",
    videoUrl: "/samples/service-proof-sample.mp4",
    posterUrl: "/samples/service-proof-poster.png",
    sourceImageUrl: "/images/generated/service-source.png",
    renderStyle: "Service booking final assembly with generated motion, deterministic hook, proof, caption, brand, and booking CTA overlays"
  },
  {
    key: "ecommerce",
    label: "Product sales AI-assembled preview",
    videoUrl: "/samples/ecommerce-launch-sample.mp4",
    posterUrl: "/samples/ecommerce-launch-poster.png",
    sourceImageUrl: "/images/generated/ecommerce-source.png",
    renderStyle: "Product launch final assembly with generated motion, deterministic hook, proof, caption, brand, and checkout CTA overlays"
  }
];

export function buildCampaignVideoAssets({
  campaignId,
  intake,
  pack,
  createdAt = new Date().toISOString()
}: {
  campaignId: string;
  intake: CampaignIntake;
  pack: Pick<CampaignPack, "videoConcepts">;
  createdAt?: string;
}): GeneratedVideoAsset[] {
  const preferred = pickSampleAsset(intake);

  return pack.videoConcepts.map((concept, index) => {
    const sample = index === 0 ? preferred : sampleAssets[(sampleAssets.indexOf(preferred) + index) % sampleAssets.length];
    return buildVideoAsset({
      campaignId,
      concept,
      intake,
      sample,
      index,
      createdAt
    });
  });
}

export function buildQueuedCampaignVideoAssets({
  campaignId,
  intake,
  pack,
  createdAt = new Date().toISOString()
}: {
  campaignId: string;
  intake: CampaignIntake;
  pack: Pick<CampaignPack, "videoConcepts">;
  createdAt?: string;
}): GeneratedVideoAsset[] {
  return buildCampaignVideoAssets({ campaignId, intake, pack, createdAt }).map((asset, index) => ({
    ...asset,
    title: `${asset.conceptTitle} - render queued`,
    status: "render-queued",
    renderMode: "queued-render",
    renderJobId: `${campaignId}_render_${String(index + 1).padStart(2, "0")}`,
    renderError: "",
    renderQueuedAt: createdAt,
    renderStartedAt: "",
    renderCompletedAt: "",
    durationSeconds: intake.videoSettings.durationSeconds,
    qualityMode: intake.videoSettings.qualityMode,
    qualityInstructions: intake.videoSettings.qualityInstructions,
    provenance:
      "Render queued from the campaign brief, selected video settings, generated concept, script, caption, CTA, and VIDSLOOM short-form layout system.",
    pipelineSteps: [
      "Campaign concept selected",
      "Customer duration and quality settings captured",
      "Render job queued for MP4 and poster generation",
      "Approval and publishing checks attached before scheduling"
    ]
  }));
}

export function fallbackVideoAssetForConcept({
  campaignId = "campaign",
  concept,
  intake,
  index,
  createdAt,
  renderError = ""
}: {
  campaignId?: string;
  concept: VideoConcept;
  intake: CampaignIntake;
  index: number;
  createdAt: string;
  renderError?: string;
}) {
  const preferred = pickSampleAsset(intake);
  const sample = index === 0 ? preferred : sampleAssets[(sampleAssets.indexOf(preferred) + index) % sampleAssets.length];

  return buildVideoAsset({
    campaignId,
    concept,
    intake,
    sample,
    index,
    createdAt,
    renderError
  });
}

function buildVideoAsset({
  campaignId,
  concept,
  intake,
  sample,
  index,
  createdAt,
  renderError = ""
}: {
  campaignId: string;
  concept: VideoConcept;
  intake: CampaignIntake;
  sample: SampleAsset;
  index: number;
  createdAt: string;
  renderError?: string;
}): GeneratedVideoAsset {
  return {
    id: `${campaignId}_asset_${String(index + 1).padStart(2, "0")}`,
    conceptTitle: concept.title,
    platform: concept.platform,
    title: sample.label,
    status: "rendered-preview",
    videoUrl: sample.videoUrl,
    posterUrl: sample.posterUrl,
    sourceImageUrl: sample.sourceImageUrl,
    storageProvider: "public-sample",
    storageKey: "",
    posterStorageKey: "",
    renderMode: "sample-fallback",
    renderJobId: "",
    renderError,
    renderQueuedAt: "",
    renderStartedAt: "",
    renderCompletedAt: "",
    aspectRatio: "9:16",
    resolution: "720x1280",
    durationSeconds: intake.videoSettings.durationSeconds,
    qualityMode: intake.videoSettings.qualityMode,
    qualityInstructions: intake.videoSettings.qualityInstructions,
    renderStyle: sample.renderStyle,
    generatedBy: "VIDSLOOM video renderer",
    provenance:
      "Rendered from the campaign concept, script, hook, caption, CTA, selected sample visual source, and VIDSLOOM short-form layout system.",
    sourceInputs: [
      `Offer: ${truncate(intake.offer, 140)}`,
      `Audience: ${truncate(intake.audience, 140)}`,
      `Proof: ${truncate(intake.proofPoints || "Proof points pending customer confirmation.", 140)}`,
      `Assets: ${truncate(intake.assets || "VIDSLOOM-assisted sample visuals until customer assets are approved.", 140)}`,
      `Creative settings: ${truncate(JSON.stringify(intake.creativeSettings), 140)}`,
      `Brand kit: ${truncate(JSON.stringify(intake.brandKit), 140)}`
    ],
    pipelineSteps: [
      "Trend and offer fit selected",
      "Hook, script, shot sequence, caption, and CTA generated",
      "Vertical MP4 preview rendered with thumbnail frame",
      "Approval and publishing checks attached before scheduling"
    ],
    outputIncludes: ["MP4 preview", "Poster frame", "Voiceover/script", "Caption", "CTA", "Approval checks"],
    usageBoundary:
      "This is a VIDSLOOM-generated preview asset for review. Final customer publishing should use approved customer assets, claims, and permissions.",
    aiMediaQa: defaultAiMediaQa(),
    qualityGate: concept.qualityGate,
    createdAt
  };
}

function defaultAiMediaQa() {
  return {
    verdict: "not-run" as const,
    firstThreeSecondImpact: 0,
    motionCoherence: 0,
    artifactRisk: 0,
    textOrLogoLeak: false,
    failureReasons: [],
    qaSource: "not-run" as const
  };
}

function pickSampleAsset(intake: CampaignIntake) {
  const haystack = `${intake.businessName} ${intake.industry} ${intake.offer} ${intake.audience}`.toLowerCase();

  if (/\b(ecommerce|e-commerce|shop|store|product|retail|bundle|cart|sku|consumer goods)\b/.test(haystack)) {
    return sampleAssets[2];
  }

  if (/\b(restaurant|cafe|bistro|bar|food|menu|dining|chef|hospitality)\b/.test(haystack)) {
    return sampleAssets[0];
  }

  return sampleAssets[1];
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}
