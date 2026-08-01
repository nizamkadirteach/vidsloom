import { createId } from "@/lib/id";
import {
  MediaQaReportSchema,
  RegenerationRequestSchema,
  type CompiledPromptPacket,
  type MediaQaReport,
  type MediaShotPlan,
  type RegenerationRequest
} from "@/lib/media-generation/schemas";

export function runDeterministicMediaQa({
  shot,
  promptPacket
}: {
  shot: MediaShotPlan;
  promptPacket: CompiledPromptPacket;
}): MediaQaReport {
  const issues: string[] = [];
  const nextActions: string[] = [];

  if (shot.sourceType === "needs-customer-asset") {
    issues.push("This shot needs stronger customer-owned assets before final generation.");
    nextActions.push("Ask the customer for real product, service, founder, location, or proof assets.");
  }

  if (shot.role === "proof" && shot.requiredProofIds.length === 0) {
    issues.push("Proof-led shot has no approved proof item attached.");
    nextActions.push("Switch to a non-proof creative angle or request proof from the customer.");
  }

  if (promptPacket.safetyConstraints.length === 0) {
    issues.push("Prompt packet is missing safety constraints.");
    nextActions.push("Regenerate the prompt packet before media generation.");
  }

  const claimSafetyPassed = !promptPacket.invariantBlock.prohibitedClaims.some((claim) =>
    promptPacket.positivePrompt.toLowerCase().includes(claim.toLowerCase())
  );
  const fakeProofRiskPassed = shot.role !== "proof" || shot.requiredProofIds.length > 0;
  const textOrLogoLeakRisk = /text|logo|signage|label|proof|review|price|dashboard/i.test(shot.action) && shot.sourceType !== "programmatic-card";
  const hasGeneratedSupport = shot.sourceType === "generated-support";
  const genericStockFeelScore = shot.referenceAssetIds.length ? 18 : hasGeneratedSupport ? 34 : 34;
  const first3SecondImpactScore = shot.shotNumber === 1 ? 92 : shot.role === "transition" ? 68 : 78;
  const brandFitScore = shot.referenceAssetIds.length ? 86 : shot.sourceType === "generated-support" ? 62 : 74;
  const claimRiskScore = claimSafetyPassed ? (shot.role === "proof" ? 48 : 18) : 92;
  const proofRiskScore = fakeProofRiskPassed ? (shot.role === "proof" ? 35 : 12) : 94;

  const scores = {
    firstFrameImpact: shot.shotNumber === 1 ? 5 : 4,
    threeSecondRetention: shot.shotNumber === 1 ? 5 : 4,
    businessSpecificity: shot.referenceAssetIds.length ? 5 : hasGeneratedSupport ? 4 : 4,
    productServiceClarity: shot.overlayText || shot.voiceoverLine ? 4 : 3,
    proofCredibility: shot.role === "proof" ? (shot.requiredProofIds.length ? 5 : 1) : 4,
    visualQuality: shot.costTier === "premium" ? 5 : shot.costTier === "standard" ? 4 : 3,
    temporalConsistency: 4,
    mobileReadability: shot.safeZoneNotes.length ? 5 : 3,
    brandFit: shot.referenceAssetIds.length || hasGeneratedSupport ? 4 : 3,
    platformFit: 4,
    ctaClarity: shot.role === "cta" ? 5 : 4,
    costEfficiency: shot.costTier === "preview" || shot.sourceType !== "programmatic-card" ? 4 : 3
  };

  if (textOrLogoLeakRisk) {
    issues.push("Shot wording may tempt the video model to render text, labels, logos, or proof inside the footage.");
    nextActions.push("Keep text, proof, prices, labels, logos, and captions in deterministic post-production overlays.");
  }

  const lowScore = Object.values(scores).some((score) => score < 4);
  const blocked = !claimSafetyPassed || !fakeProofRiskPassed;
  const status = blocked
    ? "blocked"
    : shot.sourceType === "needs-customer-asset"
      ? "needs-customer-assets"
      : lowScore || textOrLogoLeakRisk
        ? "regen-required"
        : "publish-ready";
  const verdict =
    status === "publish-ready"
      ? "pass"
      : status === "needs-customer-assets"
        ? "needs-assets"
        : status === "blocked"
          ? "blocked"
          : textOrLogoLeakRisk && shot.sourceType === "programmatic-card"
            ? "edit-fixable"
            : "regenerate";

  if (!claimSafetyPassed) {
    issues.push("The prompt appears to include prohibited claim language.");
    nextActions.push("Remove the prohibited claim from script, overlay, voiceover, and prompt.");
  }
  if (!fakeProofRiskPassed) {
    issues.push("Fake-proof risk is not cleared.");
    nextActions.push("Attach approved customer proof or remove the proof claim.");
  }

  return MediaQaReportSchema.parse({
    id: createId("media_qa"),
    campaignId: shot.campaignId,
    conceptTitle: shot.conceptTitle,
    shotId: shot.id,
    status,
    scores,
    metadataChecks: {
      aspectRatioOk: true,
      durationOk: promptPacket.qualityProfile.clipDurationSeconds === 4 ||
        promptPacket.qualityProfile.clipDurationSeconds === 6 ||
        promptPacket.qualityProfile.clipDurationSeconds === 8,
      playable: true,
      resolutionOk: promptPacket.qualityProfile.resolution === "720p" || promptPacket.qualityProfile.resolution === "1080p",
      safeZonePlanned: shot.overlaySafeZoneRequired && shot.safeZoneNotes.length > 0,
      finalAssemblyRequired: promptPacket.qualityProfile.finalAssemblyRequired
    },
    semanticChecks: {
      textInFootageDetected: false,
      logoDistortionDetected: false,
      anatomyIssueDetected: false,
      genericStockFeelScore,
      first3SecondImpactScore,
      brandFitScore,
      claimRiskScore,
      proofRiskScore
    },
    verdict,
    failureReasons: issues,
    regenerationRecipeId: verdict === "regenerate" ? `${shot.id}_regen_recipe` : "",
    claimSafetyPassed,
    fakeProofRiskPassed,
    issues,
    nextActions,
    reviewedAt: new Date().toISOString()
  });
}

export function buildRegenerationRequests({
  shotPlans,
  qaReports
}: {
  shotPlans: MediaShotPlan[];
  qaReports: MediaQaReport[];
}): RegenerationRequest[] {
  return qaReports
    .filter((report) => report.status !== "publish-ready" && report.status !== "edit-fixable")
    .map((report) => {
      const shot = shotPlans.find((item) => item.id === report.shotId);
      const route =
        report.status === "blocked"
          ? "block"
          : report.status === "needs-customer-assets"
            ? "request-more-assets"
            : shot?.fallbackRoute === "still-motion"
              ? "switch-to-still-motion"
              : "regenerate-shot";
      return RegenerationRequestSchema.parse({
        id: createId("regen"),
        campaignId: report.campaignId,
        conceptTitle: report.conceptTitle,
        shotId: report.shotId,
        reason: report.issues[0] ?? "Media QA did not pass.",
        attempt: 1,
        maxAttempts: 3,
        unchangedBlocks: [
          "business identity",
          "approved proof list",
          "prohibited claims",
          "brand colors",
          "platform safe zones",
          "post-production overlay policy"
        ],
        retain: [
          "business category",
          "approved offer context",
          "selected creative formula",
          "9:16 composition",
          "safe-zone negative space"
        ],
        issuesToFix: report.issues.length ? report.issues : ["Improve quality until QA passes."],
        change: changeInstructionsFor(report),
        promptDelta: promptDeltaFor(report),
        updatedNegativePrompt: updatedNegativePromptFor(report),
        tierEscalation: route === "switch-to-still-motion" ? "fallback-still-motion" : "none",
        route
      });
    });
}

function changeInstructionsFor(report: MediaQaReport) {
  const changes = [
    report.semanticChecks.textInFootageDetected || report.issues.some((issue) => /text|logo|label|sign/i.test(issue))
      ? "Remove all visual conditions that could create readable text, signage, labels, logos, or proof."
      : "",
    report.scores.firstFrameImpact < 4 || report.semanticChecks.first3SecondImpactScore < 75
      ? "Increase immediate visual movement in the first half-second."
      : "",
    report.semanticChecks.genericStockFeelScore > 40
      ? "Make the scene more business-specific with clearer product, service, environment, or process cues."
      : "",
    report.semanticChecks.claimRiskScore > 70 || report.semanticChecks.proofRiskScore > 70
      ? "Remove any generated proof implications and keep claims for deterministic overlays only."
      : ""
  ].filter(Boolean);

  return changes.length ? changes : ["Simplify the shot and improve visual clarity without changing the approved message."];
}

function promptDeltaFor(report: MediaQaReport) {
  if (report.issues.some((issue) => /text|logo|label|sign/i.test(issue))) {
    return "Stronger no-text/no-logo prompt: use clean unlabeled props, blank walls, no signage, no readable surfaces, no UI, no labels.";
  }
  if (report.semanticChecks.genericStockFeelScore > 40) {
    return "Increase specificity: show one concrete product/service process cue and one realistic environment cue.";
  }
  return "Simplify camera motion, keep one primary subject, and preserve clean overlay zones.";
}

function updatedNegativePromptFor(report: MediaQaReport) {
  const base = [
    "text",
    "words",
    "letters",
    "signage",
    "labels",
    "logo",
    "logo-like marks",
    "watermark",
    "fake review",
    "fake rating",
    "fake dashboard",
    "malformed hands",
    "extra fingers",
    "distorted faces",
    "black bars",
    "letterboxing"
  ];
  const issueTerms = report.issues
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((term) => term.length > 4)
    .slice(0, 12);
  return Array.from(new Set([...base, ...issueTerms])).join(", ");
}
