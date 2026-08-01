import type { CustomerAsset, CustomerAssetKind, CustomerAssetUsageRights } from "@/lib/schemas";

export const customerAssetKindLabels: Record<CustomerAssetKind, string> = {
  logo: "Logo",
  "brand-guide": "Brand guide",
  "product-photo": "Product photo",
  "service-photo": "Service photo",
  "raw-video": "Raw video",
  "testimonial-proof": "Testimonial or proof",
  "review-screenshot": "Review screenshot",
  "menu-pricing": "Menu or pricing",
  "website-screenshot": "Website screenshot",
  "social-reference": "Social reference",
  "compliance-note": "Compliance note",
  other: "Other"
};

export const customerAssetKindGuidance: Record<CustomerAssetKind, string> = {
  logo: "Best as PNG/SVG, at least 512px wide, with clear contrast.",
  "brand-guide": "Upload brand rules, examples, fonts, colors, or tone guidance.",
  "product-photo": "Use sharp product images with good lighting and simple backgrounds.",
  "service-photo": "Use real team, venue, process, or before-after service visuals.",
  "raw-video": "Use vertical or high-resolution source clips with clear subject matter.",
  "testimonial-proof": "Use approved customer quotes, results, awards, or proof assets.",
  "review-screenshot": "Use review screenshots with visible rating, source, and permission.",
  "menu-pricing": "Use current packages, menus, price sheets, or offer PDFs.",
  "website-screenshot": "Use website, booking page, shop, or funnel screenshots.",
  "social-reference": "Use competitor, creator, or brand reference URLs only as inspiration.",
  "compliance-note": "Use claim limits, regulated wording, disclaimers, or approval rules.",
  other: "Use any useful business asset that improves the video brief."
};

export type CustomerAssetQualityInput = {
  kind: CustomerAssetKind;
  source: "upload" | "url";
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  sourceUrl?: string;
  usageConsent: boolean;
  usageRights: CustomerAssetUsageRights;
};

export type CustomerAssetQualityResult = {
  qualityScore: number;
  qualityIssues: string[];
  qualityRecommendations: string[];
  readinessTags: string[];
};

export type CustomerAssetReadiness = {
  score: number;
  status: "not-ready" | "needs-assets" | "usable" | "strong";
  summary: string;
  strengths: string[];
  missing: string[];
  nextActions: string[];
};

const visualKinds: CustomerAssetKind[] = [
  "product-photo",
  "service-photo",
  "raw-video",
  "website-screenshot"
];

const proofKinds: CustomerAssetKind[] = ["testimonial-proof", "review-screenshot"];

export function scoreCustomerAssetQuality(input: CustomerAssetQualityInput): CustomerAssetQualityResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const tags: string[] = [];
  let score = 40;

  if (!input.usageConsent) {
    issues.push("Usage consent is not confirmed.");
    recommendations.push("Confirm that VIDSLOOM can use this asset in generated drafts and publishing kits.");
    score -= 25;
  } else {
    score += 15;
    tags.push("usage-cleared");
  }

  if (input.usageRights === "needs-review") {
    issues.push("Usage rights need review before publishing.");
    recommendations.push("Mark whether this asset is owned, licensed, or reference-only.");
    score -= 15;
  } else if (input.usageRights === "public-reference-only") {
    tags.push("reference-only");
    recommendations.push("Use this only for creative direction, not as a final publishing asset.");
  } else {
    tags.push("publishable");
    score += 10;
  }

  if (input.source === "url") {
    if (!input.sourceUrl) {
      issues.push("No source URL was provided.");
      score -= 20;
    } else {
      tags.push("linked-reference");
      score += 8;
    }
  }

  const mimeType = input.mimeType ?? "";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isPdf = mimeType === "application/pdf";
  const width = input.width ?? 0;
  const height = input.height ?? 0;

  if (input.kind === "raw-video") {
    if (input.source === "upload" && !isVideo) {
      issues.push("Raw video assets should be uploaded as MP4, MOV, or WebM.");
      score -= 20;
    } else if (isVideo) {
      tags.push("video-source");
      score += 18;
    }
  }

  if (["product-photo", "service-photo", "review-screenshot", "website-screenshot", "logo"].includes(input.kind)) {
    if (input.source === "upload" && !isImage) {
      issues.push("This asset type works best as an image upload.");
      score -= 18;
    } else if (isImage) {
      tags.push("visual-source");
      score += 15;
    }
  }

  if (["brand-guide", "menu-pricing", "compliance-note", "testimonial-proof"].includes(input.kind) && (isPdf || isImage)) {
    tags.push(isPdf ? "document-source" : "visual-proof");
    score += 8;
  }

  if (isImage && width && height) {
    const longest = Math.max(width, height);
    const shortest = Math.min(width, height);
    if (input.kind === "logo" && longest < 512) {
      issues.push("Logo resolution is low for crisp video overlays.");
      recommendations.push("Upload a transparent PNG or SVG logo at least 512px wide.");
      score -= 12;
    } else if (visualKinds.includes(input.kind) && longest < 1080) {
      issues.push("Visual resolution is below the recommended 1080px edge.");
      recommendations.push("Upload sharper product, venue, team, or process visuals when available.");
      score -= 10;
    } else if (shortest >= 720 || longest >= 1080) {
      tags.push("high-resolution");
      score += 10;
    }

    const aspectRatio = width / height;
    if (aspectRatio > 0.5 && aspectRatio < 0.8) {
      tags.push("vertical-ready");
      score += 8;
    } else if (visualKinds.includes(input.kind)) {
      recommendations.push("For short-form video, vertical 9:16 or crop-safe visuals will perform better.");
    }
  }

  if ((input.sizeBytes ?? 0) > 25 * 1024 * 1024) {
    recommendations.push("Large source files are accepted best through drive links or managed onboarding.");
  }

  if (proofKinds.includes(input.kind)) {
    tags.push("proof-asset");
    score += 12;
  }

  if (input.kind === "brand-guide" || input.kind === "compliance-note") {
    tags.push("brand-safety");
    score += 10;
  }

  return {
    qualityScore: clampScore(score),
    qualityIssues: dedupe(issues).slice(0, 12),
    qualityRecommendations: dedupe(recommendations).slice(0, 12),
    readinessTags: dedupe(tags).slice(0, 20)
  };
}

export function summarizeCustomerAssetReadiness(assets: CustomerAsset[]): CustomerAssetReadiness {
  const active = assets.filter((asset) => asset.status === "active");
  const usable = active.filter((asset) => asset.usageConsent && asset.usageRights !== "needs-review");
  const hasLogo = usable.some((asset) => asset.kind === "logo");
  const hasBrandGuide = usable.some((asset) => asset.kind === "brand-guide");
  const hasVisual = usable.some((asset) => visualKinds.includes(asset.kind));
  const hasProof = usable.some((asset) => proofKinds.includes(asset.kind));
  const hasOfferAsset = usable.some((asset) => asset.kind === "menu-pricing");
  const hasCompliance = usable.some((asset) => asset.kind === "compliance-note");
  const hasReference = usable.some((asset) => asset.kind === "social-reference" || asset.kind === "website-screenshot");
  const averageQuality = usable.length
    ? Math.round(usable.reduce((total, asset) => total + asset.qualityScore, 0) / usable.length)
    : 0;

  let score = Math.min(20, usable.length * 4);
  if (hasLogo) score += 12;
  if (hasBrandGuide) score += 10;
  if (hasVisual) score += 22;
  if (hasProof) score += 18;
  if (hasOfferAsset) score += 10;
  if (hasCompliance) score += 8;
  if (hasReference) score += 8;
  if (usable.length >= 5) score += 10;
  score = clampScore(Math.round(score * 0.78 + averageQuality * 0.22));

  const strengths = [
    hasLogo ? "Logo is available for branded overlays." : "",
    hasVisual ? "Product, service, or source visuals are available." : "",
    hasProof ? "Proof assets can support stronger trust-led scripts." : "",
    hasBrandGuide ? "Brand direction is available for consistent style." : "",
    hasCompliance ? "Compliance or claim limits are documented." : "",
    hasReference ? "Reference assets can guide formats and pacing." : ""
  ].filter(Boolean);

  const missing = [
    hasLogo ? "" : "Logo or brand mark",
    hasVisual ? "" : "Product, venue, team, service, or source video visuals",
    hasProof ? "" : "Testimonials, review screenshots, metrics, or proof assets",
    hasOfferAsset ? "" : "Current offer, menu, pricing, or package sheet",
    hasBrandGuide ? "" : "Brand style or creative direction",
    hasCompliance ? "" : "Claim limits, disclaimers, or topics to avoid"
  ].filter(Boolean);

  const nextActions = [
    !hasVisual ? "Upload at least three real business visuals or source clips." : "",
    !hasProof ? "Add one proof asset: review, testimonial, result screenshot, or case note." : "",
    !hasLogo ? "Upload a clear logo for overlays and thumbnails." : "",
    !hasOfferAsset ? "Add the current offer, package, menu, or pricing sheet." : "",
    active.some((asset) => !asset.usageConsent)
      ? "Confirm usage consent for every asset that can appear in generated videos."
      : ""
  ].filter(Boolean);

  const status =
    score >= 80 ? "strong" : score >= 60 ? "usable" : usable.length > 0 ? "needs-assets" : "not-ready";

  return {
    score,
    status,
    summary:
      status === "strong"
        ? "Asset library is strong enough for premium customer-specific videos."
        : status === "usable"
          ? "Asset library is usable, but more proof or visuals will improve output quality."
          : status === "needs-assets"
            ? "VIDSLOOM can start planning, but video quality will improve with more real assets."
            : "Upload or link business assets before expecting premium customer-specific videos.",
    strengths,
    missing,
    nextActions
  };
}

export function buildCustomerAssetGenerationBrief(assets: CustomerAsset[]) {
  const active = assets.filter((asset) => asset.status === "active");
  if (!active.length) return "";

  const readiness = summarizeCustomerAssetReadiness(active);
  const lines = active.slice(0, 18).map((asset, index) => {
    const dimensions = asset.width && asset.height ? `${asset.width}x${asset.height}` : "";
    const source = asset.source === "url" ? asset.sourceUrl : asset.originalFileName || asset.storageKey;
    return [
      `${index + 1}. ${customerAssetKindLabels[asset.kind]}: ${asset.label}`,
      source ? `source=${source}` : "",
      asset.mimeType ? `type=${asset.mimeType}` : "",
      dimensions ? `dimensions=${dimensions}` : "",
      asset.usageRights ? `rights=${asset.usageRights}` : "",
      asset.readinessTags.length ? `tags=${asset.readinessTags.join(", ")}` : "",
      asset.notes ? `notes=${asset.notes}` : ""
    ]
      .filter(Boolean)
      .join(" | ");
  });

  return [
    `Structured customer asset library readiness: ${readiness.score}/100 (${readiness.status}).`,
    readiness.strengths.length ? `Strengths: ${readiness.strengths.join("; ")}.` : "",
    readiness.missing.length ? `Missing or weak assets: ${readiness.missing.join("; ")}.` : "",
    "Use owned/licensed assets directly. Use public-reference-only assets only for creative direction. Do not imply unsupported outcomes.",
    ...lines
  ]
    .filter(Boolean)
    .join("\n");
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupe(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
