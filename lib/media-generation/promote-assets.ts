import "server-only";

import { createId } from "@/lib/id";
import type { MediaGenerationJobResult } from "@/lib/media-generation/jobs";
import type { MediaProductionPlan } from "@/lib/media-generation/schemas";
import type { Campaign, GeneratedVideoAsset, MediaGenerationRun } from "@/lib/schemas";
import { fallbackVideoAssetForConcept } from "@/lib/video-assets";

type PromotionInput = {
  campaign: Campaign;
  plan: MediaProductionPlan;
  mode: MediaProductionPlan["mode"];
  status: MediaGenerationRun["status"];
  generatedAssets: MediaGenerationJobResult["generatedAssets"];
  createdAt?: string;
};

export function promoteMediaGenerationAssets({
  campaign,
  plan,
  mode,
  status,
  generatedAssets,
  createdAt = new Date().toISOString()
}: PromotionInput): Campaign {
  const eligibleVideoAssets = generatedAssets.filter(
    (item) => (item.type === "final-video" || item.type === "video-clip") && item.result.status === "generated" && item.result.asset
  );
  const finalVideoAssets = eligibleVideoAssets.filter((item) => item.type === "final-video");
  const promotedAssets = (finalVideoAssets.length ? finalVideoAssets : eligibleVideoAssets)
    .map((videoResult) =>
      buildAiGeneratedAsset({
        campaign,
        plan,
        videoResult,
        referenceResult: generatedAssets.find(
          (item) => item.shotId === videoResult.shotId && item.type === "reference-frame" && item.result.asset
        ),
        createdAt
      })
    )
    .filter((asset): asset is GeneratedVideoAsset => Boolean(asset));

  const mediaJob = buildMediaJobRecord({
    plan,
    mode,
    status,
    generatedAssets,
    promotedAssets,
    createdAt
  });

  const nextAssets = mergeVideoAssets(campaign.pack.videoAssets, promotedAssets);

  return {
    ...campaign,
    pack: {
      ...campaign.pack,
      generationRouting: promotedAssets.length
        ? {
            ...campaign.pack.generationRouting,
            renderEngine: "ai-video",
            mediaModel: "VIDSLOOM AI media route",
            customerVisibleStatus: "AI-generated video clip ready for review.",
            degradedMode: false,
            fallbackReason: "",
            internalNotes: [
              "At least one generated AI media clip has been promoted into campaign video assets.",
              ...campaign.pack.generationRouting.internalNotes
            ].slice(0, 20)
          }
        : campaign.pack.generationRouting,
      videoAssets: nextAssets,
      mediaJobs: [mediaJob, ...(campaign.pack.mediaJobs ?? [])].slice(0, 30)
    }
  };
}

function buildAiGeneratedAsset({
  campaign,
  plan,
  videoResult,
  referenceResult,
  createdAt
}: {
  campaign: Campaign;
  plan: MediaProductionPlan;
  videoResult: MediaGenerationJobResult["generatedAssets"][number];
  referenceResult?: MediaGenerationJobResult["generatedAssets"][number];
  createdAt: string;
}): GeneratedVideoAsset | null {
  const shot = plan.shotPlans.find((item) => item.id === videoResult.shotId);
  if (!shot || !videoResult.result.asset) return null;

  const conceptIndex = Math.max(
    0,
    campaign.pack.videoConcepts.findIndex((concept) => concept.title === shot.conceptTitle)
  );
  const concept = campaign.pack.videoConcepts[conceptIndex];
  if (!concept) return null;

  const existing =
    campaign.pack.videoAssets.find((asset) => asset.conceptTitle === concept.title) ??
    campaign.pack.videoAssets[conceptIndex] ??
    fallbackVideoAssetForConcept({
      campaignId: campaign.id,
      concept,
      intake: campaign.intake,
      index: conceptIndex,
      createdAt
    });
  const referenceAsset = videoResult.result.posterAsset ?? referenceResult?.result.asset;
  const durationSeconds =
    videoResult.type === "final-video"
      ? videoResult.result.qa?.durationSeconds ?? plan.productionBrief.durationSeconds
      : mediaClipDurationSeconds(shot.durationSeconds);
  const qaReport = plan.qaReports.find((report) => report.shotId === shot.id);
  const assemblyQa = videoResult.result.qa;
  const isFinalVideo = videoResult.type === "final-video";

  return {
    ...existing,
    id: existing.id || `${campaign.id}_ai_media_${String(conceptIndex + 1).padStart(2, "0")}`,
    conceptTitle: concept.title,
    platform: concept.platform,
    title: `${concept.title} - ${isFinalVideo ? "AI-assembled final review video" : "AI-generated review clip"}`,
    status: "ready-for-approval",
    videoUrl: videoResult.result.asset.url,
    posterUrl: referenceAsset?.url || existing.posterUrl,
    sourceImageUrl: referenceAsset?.url || existing.sourceImageUrl,
    storageProvider: videoResult.result.asset.provider,
    storageKey: videoResult.result.asset.key,
    posterStorageKey: referenceAsset?.key || existing.posterStorageKey,
    renderMode: "ai-generated",
    renderJobId: isFinalVideo ? `${plan.id}_final` : `${plan.id}_${shot.shotNumber}`,
    renderError: "",
    renderQueuedAt: existing.renderQueuedAt || createdAt,
    renderStartedAt: createdAt,
    renderCompletedAt: createdAt,
    aspectRatio: "9:16",
    resolution: "720x1280",
    durationSeconds,
    qualityMode: campaign.intake.videoSettings.qualityMode,
    qualityInstructions: campaign.intake.videoSettings.qualityInstructions,
    renderStyle: isFinalVideo
      ? "AI-assembled 9:16 final review video using generated motion clips plus deterministic hook, proof, caption, brand, and CTA overlays."
      : `AI-generated ${shot.role} clip using the approved campaign brief, shot plan, and reference frame.`,
    generatedBy: "VIDSLOOM AI media pipeline",
    provenance: isFinalVideo
      ? "Assembled by VIDSLOOM AI from generated shot clips and the approved campaign brief. Exact proof, text, captions, pricing, logos, and CTA were composited as deterministic post-production overlays."
      : "Generated by VIDSLOOM AI from the campaign brief, trend-aware concept, shot plan, and reference frame. Exact proof, text, captions, pricing, and logos remain deterministic post-production overlays.",
    sourceInputs: [
      `Business: ${truncate(campaign.intake.businessName, 90)}`,
      `Offer: ${truncate(campaign.intake.offer, 150)}`,
      `Audience: ${truncate(campaign.intake.audience, 150)}`,
      `Concept: ${truncate(concept.title, 120)}`,
      `Shot role: ${shot.role}`,
      `Shot action: ${truncate(shot.action, 150)}`,
      `Quality instructions: ${truncate(campaign.intake.videoSettings.qualityInstructions, 180)}`
    ],
    pipelineSteps: [
      "Campaign brief and trend-aware concept selected",
      "Per-shot AI media plan compiled",
      "Claim-safe prompt packet generated with proof and text kept out of the video model",
      "Full-frame reference image generated",
      "Vertical AI video clip generated from the reference frame",
      ...(isFinalVideo
        ? [
            "Generated shot clips assembled into one vertical review video",
            "Hook, proof, subtitle, brand, and CTA overlays composited deterministically",
            "Poster frame extracted from the assembled MP4"
          ]
        : ["MP4 and poster frame persisted to generated asset storage"]),
      isFinalVideo ? "Final review video promoted into the campaign approval queue" : "Clip promoted into the campaign review queue"
    ],
    outputIncludes: isFinalVideo
      ? ["AI-assembled MP4", "Poster frame", "Shot sequence", "Caption", "CTA", "Approval checks"]
      : ["AI-generated MP4 clip", "Reference poster frame", "Shot plan", "Caption", "CTA", "Approval checks"],
    usageBoundary:
      "Review this AI-generated clip before publishing. Final customer publishing should use approved proof, customer permissions, deterministic text overlays, and connected social accounts.",
    aiMediaQa: qaReport
      ? {
          verdict: promotedQaVerdict(qaReport.verdict, assemblyQa?.verdict),
          firstThreeSecondImpact: qaReport.semanticChecks.first3SecondImpactScore,
          motionCoherence: assemblyQa?.playable ? Math.max(80, qaReport.scores.temporalConsistency * 20) : qaReport.scores.temporalConsistency * 20,
          artifactRisk: Math.max(
            qaReport.semanticChecks.textInFootageDetected ? 90 : 10,
            qaReport.semanticChecks.logoDistortionDetected ? 90 : 10,
            qaReport.semanticChecks.anatomyIssueDetected ? 90 : 10
          ),
          textOrLogoLeak: qaReport.semanticChecks.textInFootageDetected || qaReport.semanticChecks.logoDistortionDetected,
          failureReasons: [...qaReport.failureReasons, ...(assemblyQa?.warnings ?? [])].slice(0, 12),
          qaSource: "deterministic-preflight"
        }
      : {
          verdict: "not-run",
          firstThreeSecondImpact: 0,
          motionCoherence: 0,
          artifactRisk: 0,
          textOrLogoLeak: false,
          failureReasons: [],
          qaSource: "not-run"
        },
    qualityGate: concept.qualityGate,
    createdAt
  };
}

function promotedQaVerdict(
  qaVerdict: "pass" | "edit-fixable" | "regenerate" | "needs-assets" | "blocked",
  assemblyVerdict?: "pass" | "review" | "failed"
): "pass" | "edit-fixable" | "regenerate" | "blocked" | "not-run" {
  if (assemblyVerdict === "pass") return "pass";
  if (assemblyVerdict === "review") return "edit-fixable";
  if (assemblyVerdict === "failed") return "blocked";
  if (qaVerdict === "pass") return "pass";
  if (qaVerdict === "edit-fixable") return "edit-fixable";
  if (qaVerdict === "blocked") return "blocked";
  return "regenerate";
}

function buildMediaJobRecord({
  plan,
  mode,
  status,
  generatedAssets,
  promotedAssets,
  createdAt
}: {
  plan: MediaProductionPlan;
  mode: MediaProductionPlan["mode"];
  status: MediaGenerationRun["status"];
  generatedAssets: MediaGenerationJobResult["generatedAssets"];
  promotedAssets: GeneratedVideoAsset[];
  createdAt: string;
}): MediaGenerationRun {
  return {
    id: createId("mediajob"),
    createdAt,
    mode,
    status,
    planId: plan.id,
    generatedAssets: generatedAssets.map((item) => {
      const shot = plan.shotPlans.find((candidate) => candidate.id === item.shotId);
      return {
        shotId: item.shotId,
        conceptTitle: shot?.conceptTitle ?? item.shotId,
        type: item.type,
        status: item.result.status,
        assetUrl: item.result.asset?.url ?? "",
        assetKey: item.result.asset?.key ?? "",
        provider: item.result.asset?.provider ?? "",
        error: truncate(item.result.error ?? "", 1000)
      };
    }),
    promotedAssetIds: promotedAssets.map((asset) => asset.id),
    qaSummary: qaSummaryFor(plan),
    assemblySummary: assemblySummaryFor(plan),
    summary:
      promotedAssets.length > 0
        ? `${promotedAssets.length} AI-generated clip${promotedAssets.length === 1 ? "" : "s"} promoted to campaign assets.`
        : `${generatedAssets.length} media job result${generatedAssets.length === 1 ? "" : "s"} recorded.`
  };
}

function qaSummaryFor(plan: MediaProductionPlan) {
  return {
    passed: plan.qaReports.filter((report) => report.verdict === "pass").length,
    editFixable: plan.qaReports.filter((report) => report.verdict === "edit-fixable").length,
    regenerate: plan.qaReports.filter((report) => report.verdict === "regenerate" || report.verdict === "needs-assets").length,
    blocked: plan.qaReports.filter((report) => report.verdict === "blocked").length,
    maxRegenerationAttempts: 3
  };
}

function assemblySummaryFor(plan: MediaProductionPlan) {
  const composition = plan.renderCompositions[0];
  return [
    composition ? `Assembly strategy: ${composition.assemblyStrategy.replace(/-/g, " ")}.` : "",
    "AI clips are motion ingredients, not final business-proof footage.",
    "Exact proof, prices, captions, logos, screenshots, subtitles, and CTAs stay in deterministic post-production.",
    "Publishing remains approval-gated and OAuth-gated for direct auto-posting."
  ]
    .filter(Boolean)
    .slice(0, 12);
}

function mergeVideoAssets(existingAssets: GeneratedVideoAsset[], promotedAssets: GeneratedVideoAsset[]) {
  if (!promotedAssets.length) return existingAssets;
  const promotedConcepts = new Set(promotedAssets.map((asset) => asset.conceptTitle));
  return [
    ...promotedAssets,
    ...existingAssets.filter((asset) => !promotedConcepts.has(asset.conceptTitle))
  ];
}

function mediaClipDurationSeconds(input: number) {
  const rounded = Math.round(input);
  if (rounded <= 4) return 4;
  if (rounded <= 6) return 6;
  return 8;
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}
