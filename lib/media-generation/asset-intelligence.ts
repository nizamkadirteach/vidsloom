import type { CustomerAsset } from "@/lib/schemas";
import { AssetAnalysisSchema, type AssetAnalysis, type MediaShotPlan } from "@/lib/media-generation/schemas";

const proofKinds = new Set(["testimonial-proof", "review-screenshot", "menu-pricing", "website-screenshot"]);
const productKinds = new Set(["product-photo", "menu-pricing"]);
const serviceKinds = new Set(["service-photo", "raw-video", "website-screenshot"]);

export function analyzeCustomerAssets(assets: CustomerAsset[]): AssetAnalysis[] {
  return assets.map((asset) => {
    const qualityScore = clamp(asset.qualityScore || heuristicQualityScore(asset));
    const usageRightsStatus = asset.usageConsent
      ? asset.usageRights === "public-reference-only"
        ? "reference-only"
        : asset.usageRights === "needs-review"
          ? "needs-review"
          : "approved"
      : "needs-review";
    const recommendedUses = recommendedUsesFor(asset);
    const blockedUses = blockedUsesFor(asset);

    return AssetAnalysisSchema.parse({
      assetId: asset.id,
      customerId: asset.customerId,
      assetType: asset.kind,
      detectedText: textSignals(asset),
      logoConfidence: asset.kind === "logo" ? qualityScore : 0,
      productConfidence: productKinds.has(asset.kind) ? qualityScore : 0,
      proofConfidence: proofKinds.has(asset.kind) ? qualityScore : 0,
      faceOrPersonPresence: /founder|staff|team|person|face|portrait|customer/i.test(`${asset.label} ${asset.notes}`),
      qualityScore,
      usageRightsStatus,
      recommendedUses,
      blockedUses,
      notes: [...asset.qualityIssues, ...asset.qualityRecommendations].slice(0, 12)
    });
  });
}

export function selectAssetsForShot({
  shot,
  assets,
  analyses
}: {
  shot: Pick<MediaShotPlan, "role" | "sourceType" | "subject" | "action">;
  assets: CustomerAsset[];
  analyses: AssetAnalysis[];
}) {
  const approved = analyses.filter((analysis) => analysis.usageRightsStatus === "approved");
  const ids = new Set<string>();

  if (shot.role === "proof" || shot.sourceType === "proof-overlay") {
    for (const analysis of approved.filter((item) => item.proofConfidence >= 55)) ids.add(analysis.assetId);
  }

  if (/product|pack|sku|menu|food|dish|unboxing/i.test(`${shot.subject} ${shot.action}`)) {
    for (const analysis of approved.filter((item) => item.productConfidence >= 55)) ids.add(analysis.assetId);
  }

  if (/service|process|clinic|technician|appointment|venue|room|team/i.test(`${shot.subject} ${shot.action}`)) {
    for (const asset of assets.filter((item) => serviceKinds.has(item.kind))) {
      const analysis = approved.find((item) => item.assetId === asset.id);
      if (analysis && analysis.qualityScore >= 45) ids.add(asset.id);
    }
  }

  for (const analysis of approved.sort((a, b) => b.qualityScore - a.qualityScore)) {
    if (ids.size >= 4) break;
    if (analysis.logoConfidence > 0 && shot.sourceType !== "programmatic-card") continue;
    if (proofKinds.has(analysis.assetType) && shot.role !== "proof" && shot.sourceType !== "proof-overlay") continue;
    ids.add(analysis.assetId);
  }

  return [...ids].slice(0, 4);
}

function heuristicQualityScore(asset: CustomerAsset) {
  let score = 40;
  if (asset.storageProvider === "gcs" || asset.storageProvider === "local") score += 15;
  if (asset.sourceUrl) score += 8;
  if (asset.width >= 1080 || asset.height >= 1080) score += 18;
  if (asset.durationSeconds >= 3) score += 16;
  if (asset.usageConsent) score += 12;
  if (asset.usageRights === "needs-review") score -= 18;
  if (asset.status !== "active") score -= 40;
  return score;
}

function recommendedUsesFor(asset: CustomerAsset) {
  const uses: string[] = [];
  if (asset.kind === "logo") uses.push("post-production logo overlay only");
  if (asset.kind === "product-photo") uses.push("product reference frame", "product identity anchor");
  if (asset.kind === "service-photo") uses.push("service scene reference", "still-motion plate");
  if (asset.kind === "raw-video") uses.push("proof clip", "background motion", "founder/staff reference when approved");
  if (asset.kind === "testimonial-proof" || asset.kind === "review-screenshot") uses.push("proof overlay only");
  if (asset.kind === "menu-pricing") uses.push("offer card overlay", "menu/pricing proof overlay");
  if (asset.kind === "website-screenshot") uses.push("UI/screen proof overlay", "offer page reference");
  if (asset.kind === "brand-guide") uses.push("brand color and typography rules");
  if (asset.kind === "compliance-note") uses.push("claim and legal guardrails");
  return uses.length ? uses : ["supporting production reference"];
}

function blockedUsesFor(asset: CustomerAsset) {
  const blocked: string[] = [];
  if (!asset.usageConsent) blocked.push("publishing until usage consent is confirmed");
  if (asset.kind === "logo") blocked.push("AI video generation source; use as deterministic overlay instead");
  if (asset.kind === "testimonial-proof" || asset.kind === "review-screenshot") {
    blocked.push("AI recreation or rewriting of proof content");
  }
  if (asset.usageRights === "public-reference-only") blocked.push("direct publishing as customer-owned proof");
  if (asset.usageRights === "needs-review") blocked.push("automated generation until rights are reviewed");
  return blocked;
}

function textSignals(asset: CustomerAsset) {
  const text = `${asset.label} ${asset.notes}`.replace(/\s+/g, " ").trim();
  return text ? [text.slice(0, 180)] : [];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
