import "server-only";

import {
  customerAssetKindLabels,
  summarizeCustomerAssetReadiness
} from "@/lib/customer-assets";
import type {
  CampaignIntake,
  CampaignPack,
  CampaignProofGraph,
  ConceptQualityGate,
  CustomerAsset,
  GenerationRouting,
  ProofClaimType,
  ProofItem,
  StoryboardShot,
  VideoConcept,
  VideoQualityMode
} from "@/lib/schemas";

type ApplyCampaignGuardrailsParams = {
  intake: CampaignIntake;
  pack: CampaignPack;
  customerAssets?: CustomerAsset[];
  mode: "gemini" | "fallback";
  fallbackReason?: string;
};

const MIN_PUBLISH_SCORE = 78;
const PROOF_KINDS = new Set<CustomerAsset["kind"]>(["testimonial-proof", "review-screenshot"]);
const VISUAL_KINDS = new Set<CustomerAsset["kind"]>([
  "product-photo",
  "service-photo",
  "raw-video",
  "website-screenshot",
  "menu-pricing"
]);

const blockedClaimPatterns: Array<{ pattern: RegExp; label: string; type: ProofClaimType }> = [
  {
    pattern: /\b(guarantee(?:d|s)?|guaranteed results|guaranteed revenue|guaranteed sales|go viral|viral reach|ridiculous reach)\b/i,
    label: "Guaranteed reach, revenue, virality, or sales claims are not allowed without explicit proof and review.",
    type: "performance"
  },
  {
    pattern: /\b(cure|treats?|diagnose|reverses?|medical result|clinical result)\b/i,
    label: "Medical, treatment, diagnostic, or clinical outcome claims need regulated review before publishing.",
    type: "regulated"
  },
  {
    pattern: /\b(100%\s*(safe|effective|risk[- ]?free)|no risk|zero risk)\b/i,
    label: "Absolute safety, effectiveness, or risk-free claims are blocked unless legal review approves them.",
    type: "regulated"
  },
  {
    pattern: /\b(\d+x|double|triple|increase revenue|increase sales|more bookings|more leads)\b/i,
    label: "Quantified performance claims need customer-supplied proof before publishing.",
    type: "performance"
  }
];

const softProofPatterns: Array<{ pattern: RegExp; label: string; type: ProofClaimType }> = [
  {
    pattern: /\b(results?|case stud(?:y|ies)|testimonial|review|rated|stars?|before[- ]?after|transformation)\b/i,
    label: "Proof-led wording needs a customer-approved proof item.",
    type: "testimonial"
  },
  {
    pattern: /\b(best|top|#1|leading|premium|world[- ]?class)\b/i,
    label: "Superlative positioning should be softened or supported with proof.",
    type: "business-fact"
  }
];

export function applyCampaignGuardrails({
  intake,
  pack,
  customerAssets = [],
  mode,
  fallbackReason = ""
}: ApplyCampaignGuardrailsParams): CampaignPack {
  const proofGraph = buildProofGraph({ intake, customerAssets });
  const generationRouting = buildGenerationRouting({
    qualityMode: intake.videoSettings.qualityMode,
    mode,
    fallbackReason
  });
  const videoConcepts = pack.videoConcepts.map((concept) =>
    enrichConceptWithGuardrails({ concept, intake, proofGraph, customerAssets })
  );
  const conceptGateByTitle = new Map(videoConcepts.map((concept) => [concept.title, concept.qualityGate]));

  return {
    ...pack,
    proofGraph,
    generationRouting,
    brandReadiness: appendUnique(pack.brandReadiness, proofGraph.missingProof.slice(0, 3).map((item) => `Proof gap: ${item}`)),
    videoConcepts,
    publishingQueue: pack.publishingQueue.map((task) => {
      const gate = conceptGateByTitle.get(task.conceptTitle);
      if (!gate) return task;
      if (gate.status === "blocked") {
        return {
          ...task,
          status: "blocked" as const,
          approvalChecklist: appendUnique(task.approvalChecklist, gate.publishBlockers.slice(0, 4)),
          costControlNote: `${task.costControlNote} Publishing is blocked until unsupported or unsafe claims are fixed.`
        };
      }
      if (gate.status === "needs-review" && task.status === "ready-to-schedule") {
        return {
          ...task,
          status: "needs-approval" as const,
          approvalChecklist: appendUnique(task.approvalChecklist, gate.nextActions.slice(0, 4))
        };
      }
      return {
        ...task,
        approvalChecklist: appendUnique(task.approvalChecklist, gate.nextActions.slice(0, 2))
      };
    }),
    risks: appendUnique(pack.risks, [
      "No generated video should publish until the proof graph, claim review, and QA gate pass.",
      generationRouting.degradedMode
        ? "This campaign used a review-safe fallback route; regenerate premium media before final publishing."
        : ""
    ]),
    nextActions: appendUnique(pack.nextActions, [
      "Approve or replace every unsupported claim before scheduling.",
      "Review storyboard shots against real customer assets before rendering final media.",
      "Run final QA after MP4 rendering and before direct posting."
    ])
  };
}

export function buildProofGraph({
  intake,
  customerAssets = []
}: {
  intake: CampaignIntake;
  customerAssets?: CustomerAsset[];
}): CampaignProofGraph {
  const activeAssets = customerAssets.filter((asset) => asset.status === "active");
  const readiness = summarizeCustomerAssetReadiness(activeAssets);
  const usableAssets = activeAssets.filter((asset) => asset.usageConsent && asset.usageRights !== "needs-review");
  const proofAssets = usableAssets.filter((asset) => PROOF_KINDS.has(asset.kind));
  const visualAssets = usableAssets.filter((asset) => VISUAL_KINDS.has(asset.kind));
  const complianceAssets = usableAssets.filter((asset) => asset.kind === "compliance-note");
  const items: ProofItem[] = [];

  items.push({
    id: "proof_offer",
    sourceType: "customer-intake",
    claimType: "offer",
    summary: `Customer-stated offer for ${intake.businessName}`,
    evidenceText: intake.offer,
    assetIds: [],
    status: "verified-from-customer",
    action: "Use for offer clarity, but do not add performance outcomes."
  });

  if (intake.website) {
    items.push({
      id: "proof_website",
      sourceType: "customer-intake",
      claimType: "business-fact",
      summary: "Customer-provided website or social presence",
      evidenceText: intake.website,
      assetIds: [],
      status: "needs-customer-confirmation",
      action: "Use as context; customer should confirm public claims before publishing."
    });
  }

  splitProofLines(intake.proofPoints ?? "").forEach((line, index) => {
    items.push({
      id: `proof_customer_${index + 1}`,
      sourceType: "customer-proof-note",
      claimType: classifyClaimType(line),
      summary: truncate(line, 220),
      evidenceText: line,
      assetIds: proofAssets.map((asset) => asset.id).slice(0, 4),
      status: proofAssets.length ? "verified-from-customer" : "needs-customer-confirmation",
      action: proofAssets.length
        ? "Use only as written or softened; keep screenshots/permissions attached."
        : "Ask customer for screenshot, review, source link, or written approval before publishing."
    });
  });

  usableAssets.forEach((asset) => {
    items.push({
      id: `proof_asset_${asset.id}`,
      sourceType: "customer-asset",
      claimType: asset.kind === "menu-pricing" ? "pricing" : PROOF_KINDS.has(asset.kind) ? "testimonial" : "visual",
      summary: `${customerAssetKindLabels[asset.kind]}: ${asset.label}`,
      evidenceText: asset.notes || asset.sourceUrl || asset.originalFileName || asset.storageKey,
      assetIds: [asset.id],
      status: asset.usageRights === "public-reference-only" ? "reference-only" : "verified-from-customer",
      action:
        asset.usageRights === "public-reference-only"
          ? "Use for style direction only, not as a final publishing asset."
          : "Allowed for customer-specific drafts and approved publishing assets."
    });
  });

  if (complianceAssets.length) {
    items.push({
      id: "proof_compliance_limits",
      sourceType: "customer-asset",
      claimType: "regulated",
      summary: "Customer-supplied compliance or claim limits",
      evidenceText: complianceAssets.map((asset) => `${asset.label}: ${asset.notes}`).join("\n"),
      assetIds: complianceAssets.map((asset) => asset.id),
      status: "verified-from-customer",
      action: "Use these notes to block or soften regulated claims."
    });
  }

  const missingProof = [
    proofAssets.length ? "" : "At least one testimonial, review screenshot, result screenshot, or proof note.",
    visualAssets.length ? "" : "At least three customer-owned product, service, venue, process, or raw video visuals.",
    activeAssets.some((asset) => asset.kind === "logo" && asset.usageConsent) ? "" : "A clear logo or brand mark.",
    complianceAssets.length ? "" : "Claim limits or compliance notes for regulated industries."
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    readinessScore: readiness.score,
    readinessStatus: readiness.status,
    policy:
      "Only customer-supplied or customer-approved proof can support claims. Do not invent testimonials, metrics, awards, outcomes, medical claims, financial claims, or guaranteed performance.",
    items,
    missingProof,
    blockedClaims: []
  };
}

function enrichConceptWithGuardrails({
  concept,
  intake,
  proofGraph,
  customerAssets
}: {
  concept: VideoConcept;
  intake: CampaignIntake;
  proofGraph: CampaignProofGraph;
  customerAssets: CustomerAsset[];
}): VideoConcept {
  const claimReview = reviewConceptClaims(concept, proofGraph);
  const storyboard = buildStoryboard({ concept, intake, customerAssets, claimReview });
  const qualityGate = buildConceptQualityGate({ concept, intake, proofGraph, claimReview, storyboard });

  return {
    ...concept,
    claimReview,
    storyboard,
    qualityGate,
    approvalRisks: appendUnique(concept.approvalRisks, [
      ...claimReview.requiredCustomerConfirmations,
      ...claimReview.blockedClaims,
      ...qualityGate.publishBlockers
    ]).slice(0, 12),
    qualityScore: Math.round(concept.qualityScore * 0.55 + qualityGate.score * 0.45)
  };
}

function reviewConceptClaims(concept: VideoConcept, proofGraph: CampaignProofGraph): VideoConcept["claimReview"] {
  const text = [concept.title, concept.objective, concept.hook, concept.script, concept.caption, concept.cta].join(" ");
  const supportedClaims: string[] = [];
  const unsupportedClaims: string[] = [];
  const blockedClaims: string[] = [];
  const requiredCustomerConfirmations: string[] = [];
  const hasVerifiedProof = proofGraph.items.some((item) => item.status === "verified-from-customer" && item.claimType !== "visual");
  const hasProofAsset = proofGraph.items.some(
    (item) => item.status === "verified-from-customer" && ["testimonial", "performance", "pricing"].includes(item.claimType)
  );

  for (const item of proofGraph.items) {
    if (item.status === "verified-from-customer" && item.summary) supportedClaims.push(item.summary);
  }

  for (const candidate of blockedClaimPatterns) {
    if (candidate.pattern.test(text)) {
      const supported = candidate.type === "performance" && hasProofAsset;
      if (supported) {
        requiredCustomerConfirmations.push(candidate.label);
      } else {
        blockedClaims.push(candidate.label);
      }
    }
  }

  for (const candidate of softProofPatterns) {
    if (candidate.pattern.test(text) && !hasVerifiedProof) {
      unsupportedClaims.push(candidate.label);
    }
  }

  if (!hasVerifiedProof) {
    unsupportedClaims.push("No customer-approved proof item is attached to this concept yet.");
  }

  const status = blockedClaims.length ? "blocked" : unsupportedClaims.length || requiredCustomerConfirmations.length ? "needs-proof" : "pass";

  return {
    status,
    supportedClaims: appendUnique([], supportedClaims).slice(0, 10),
    unsupportedClaims: appendUnique([], unsupportedClaims).slice(0, 10),
    blockedClaims: appendUnique([], blockedClaims).slice(0, 10),
    requiredCustomerConfirmations: appendUnique([], requiredCustomerConfirmations).slice(0, 10)
  };
}

function buildStoryboard({
  concept,
  intake,
  customerAssets,
  claimReview
}: {
  concept: VideoConcept;
  intake: CampaignIntake;
  customerAssets: CustomerAsset[];
  claimReview: VideoConcept["claimReview"];
}): StoryboardShot[] {
  const duration = intake.videoSettings.durationSeconds;
  const shotCount = duration <= 10 ? 3 : duration <= 20 ? 4 : duration <= 30 ? 5 : duration <= 45 ? 6 : 7;
  const usableAssets = customerAssets.filter((asset) => asset.status === "active" && asset.usageConsent && asset.usageRights !== "needs-review");
  const visualAssets = usableAssets.filter((asset) => VISUAL_KINDS.has(asset.kind));
  const proofAssets = usableAssets.filter((asset) => PROOF_KINDS.has(asset.kind));
  const shotLength = duration / shotCount;
  const purposes: StoryboardShot["purpose"][] = ["hook", "problem", "offer", "proof", "demo", "cta", "transition"];
  const shotText = [
    concept.hook,
    concept.objective,
    intake.offer,
    intake.proofPoints || "Proof will be confirmed before publishing.",
    concept.shotList.join(" / "),
    concept.cta,
    concept.caption
  ];

  return Array.from({ length: shotCount }, (_, index) => {
    const purpose = purposes[index] ?? "transition";
    const startSecond = roundSecond(index * shotLength);
    const endSecond = roundSecond(index === shotCount - 1 ? duration : (index + 1) * shotLength);
    const assetPool = purpose === "proof" ? proofAssets : visualAssets;
    const asset = assetPool[index % Math.max(1, assetPool.length)];
    const usesAsset = Boolean(asset);
    const needsProof = purpose === "proof" && claimReview.status !== "pass";

    return {
      shotNumber: index + 1,
      startSecond,
      endSecond,
      purpose,
      visualSource: usesAsset ? "customer-asset" : needsProof ? "needs-asset" : purpose === "transition" ? "generated-support" : "text-overlay",
      assetRefs: asset ? [asset.id] : [],
      onScreenText: truncate(shotText[index] ?? concept.hook, 170),
      voiceover: truncate(sentenceAt(concept.script, index), 260),
      motionDirection: usesAsset
        ? "Crop-safe vertical motion using the approved customer asset; keep captions large and readable."
        : "Use animated text and abstract support visuals only; do not fabricate customer proof.",
      productionNote:
        purpose === "proof"
          ? "Proof shot must use a verified customer proof item or be rewritten as a soft claim."
          : "Keep the shot mobile-first, high contrast, fast moving, and aligned to the selected quality instructions.",
      approvalRequired: true
    };
  });
}

function buildConceptQualityGate({
  concept,
  intake,
  proofGraph,
  claimReview,
  storyboard
}: {
  concept: VideoConcept;
  intake: CampaignIntake;
  proofGraph: CampaignProofGraph;
  claimReview: VideoConcept["claimReview"];
  storyboard: StoryboardShot[];
}): ConceptQualityGate {
  const checks = [
    check("First 3s hook", hookScore(concept.hook), 78, "Rewrite the opening to name the buyer pain or desired result immediately."),
    check("Offer clarity", containsMeaningfulOverlap(concept.script, intake.offer) ? 88 : 62, 75, "Make the actual offer visible in the script."),
    check("Business specificity", specificityScore(concept, intake), 75, "Use industry, audience, product, service, or location specifics."),
    check("Proof credibility", proofScore(proofGraph, claimReview), 76, "Attach real proof assets or soften proof-heavy wording."),
    check("Visual specificity", storyboard.some((shot) => shot.visualSource === "customer-asset") ? 86 : 52, 72, "Attach customer-owned visuals for the key shots."),
    check("Brand fit", brandFitScore(intake), 70, "Add brand colors, logo, tone, and do/don't guidance."),
    check("Caption readability", captionScore(concept.caption), 72, "Shorten captions and keep one CTA."),
    check("CTA clarity", ctaScore(concept.cta), 72, "Use one measurable action: book, DM, buy, claim, or learn."),
    check("Platform fit", intake.platforms.includes(concept.platform) ? 90 : 55, 75, "Match the concept to a selected customer platform."),
    check("Mobile preview", mobileScore(intake), 75, "Use vertical-safe scenes, readable captions, and the selected duration."),
    check("Audio/accessibility", intake.creativeSettings.subtitlesRequired ? 90 : 60, 75, "Keep subtitles enabled for silent autoplay."),
    check("Safety/compliance", claimReview.status === "blocked" ? 20 : claimReview.status === "needs-proof" ? 66 : 92, 78, "Resolve unsupported, regulated, or absolute claims.")
  ];
  const score = Math.round(checks.reduce((total, item) => total + item.score, 0) / checks.length);
  const publishBlockers = [
    ...claimReview.blockedClaims,
    ...checks.filter((item) => !item.passed && item.score < 55).map((item) => `${item.category}: ${item.issue}`)
  ];
  const nextActions = [
    ...claimReview.requiredCustomerConfirmations,
    ...claimReview.unsupportedClaims,
    ...checks.filter((item) => !item.passed && item.action).map((item) => item.action)
  ];
  const status = publishBlockers.length ? "blocked" : score >= MIN_PUBLISH_SCORE && claimReview.status === "pass" ? "pass" : "needs-review";

  return {
    status,
    score,
    minPublishScore: MIN_PUBLISH_SCORE,
    checks,
    publishBlockers: appendUnique([], publishBlockers).slice(0, 10),
    nextActions: appendUnique([], nextActions).slice(0, 10)
  };
}

function buildGenerationRouting({
  qualityMode,
  mode,
  fallbackReason
}: {
  qualityMode: VideoQualityMode;
  mode: "gemini" | "fallback";
  fallbackReason: string;
}): GenerationRouting {
  const degradedMode = mode === "fallback" || Boolean(fallbackReason);
  return {
    planningModel: "private-ai-planning-route",
    mediaModel: qualityMode === "highest-quality" ? "private-premium-video-route" : "private-standard-video-route",
    renderEngine: "ffmpeg-assembly",
    qualityTier: qualityMode,
    degradedMode,
    fallbackReason: fallbackReason ? truncate(fallbackReason, 340) : "",
    customerVisibleStatus: degradedMode
      ? "Review-safe AI planning route used. Premium media should be regenerated before final publishing."
      : "AI planning route completed with review-safe rendering and approval gates.",
    internalNotes: [
      "Public UI must say AI only; do not expose provider, model, cloud, or infrastructure names.",
      "Silent downgrade is not allowed for final customer deliverables; show degradedMode and require regeneration or approval."
    ]
  };
}

function check(category: string, score: number, passAt: number, action: string) {
  const passed = score >= passAt;
  return {
    category,
    score: Math.max(0, Math.min(100, Math.round(score))),
    passed,
    issue: passed ? "" : `${category} scored below the publish threshold.`,
    action: passed ? "" : action
  };
}

function hookScore(hook: string) {
  const lengthScore = hook.length >= 24 && hook.length <= 125 ? 82 : hook.length < 16 ? 55 : 70;
  const specificity = /\b(you|your|customer|business|owner|clinic|restaurant|shop|service|offer|lead|booking|sale)\b/i.test(hook)
    ? 12
    : 0;
  const curiosity = /[?]|\b(mistake|reason|before|after|why|how|hidden|stop|start|avoid)\b/i.test(hook) ? 8 : 0;
  return Math.min(100, lengthScore + specificity + curiosity);
}

function specificityScore(concept: VideoConcept, intake: CampaignIntake) {
  const text = `${concept.title} ${concept.objective} ${concept.script} ${concept.caption}`.toLowerCase();
  const terms = [intake.businessName, intake.industry, ...intake.audience.split(/\W+/), ...intake.offer.split(/\W+/)]
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length >= 5)
    .slice(0, 24);
  const matches = terms.filter((term) => text.includes(term)).length;
  return Math.min(96, 58 + matches * 7);
}

function proofScore(proofGraph: CampaignProofGraph, claimReview: VideoConcept["claimReview"]) {
  if (claimReview.status === "blocked") return 25;
  const verified = proofGraph.items.filter((item) => item.status === "verified-from-customer" && item.claimType !== "visual").length;
  if (verified >= 3 && claimReview.status === "pass") return 92;
  if (verified >= 1) return claimReview.status === "pass" ? 84 : 70;
  return 52;
}

function brandFitScore(intake: CampaignIntake) {
  let score = 58;
  if (intake.brandVoice) score += 10;
  if (intake.brandKit.logoUrl) score += 8;
  if (intake.brandKit.primaryColor || intake.brandKit.secondaryColor) score += 8;
  if (intake.brandKit.brandDo || intake.brandKit.brandDont) score += 10;
  if (intake.brandKit.fontStyle) score += 4;
  return Math.min(96, score);
}

function captionScore(caption: string) {
  let score = caption.length <= 220 ? 82 : caption.length <= 320 ? 70 : 58;
  if (/[.!?]$/.test(caption.trim())) score += 4;
  if (caption.split(/\s+/).length <= 34) score += 6;
  return Math.min(96, score);
}

function ctaScore(cta: string) {
  let score = cta.length >= 8 && cta.length <= 90 ? 78 : 62;
  if (/\b(book|dm|message|buy|claim|start|get|request|call|audit|learn|download)\b/i.test(cta)) score += 14;
  return Math.min(96, score);
}

function mobileScore(intake: CampaignIntake) {
  let score = 70;
  if ([10, 15, 20, 30, 45, 60].includes(intake.videoSettings.durationSeconds)) score += 8;
  if (/caption|readable|mobile|vertical|9:16|first-three|first three/i.test(intake.videoSettings.qualityInstructions)) {
    score += 12;
  }
  if (intake.videoSettings.qualityMode === "highest-quality") score += 4;
  return Math.min(96, score);
}

function splitProofLines(input: string) {
  return input
    .split(/\n|;|•|- /)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .slice(0, 12);
}

function classifyClaimType(input: string): ProofClaimType {
  if (/\b(price|pricing|package|fee|discount|promo|menu)\b/i.test(input)) return "pricing";
  if (/\b(review|testimonial|customer said|rated|stars?)\b/i.test(input)) return "testimonial";
  if (/\b(revenue|sales|leads|bookings|roi|conversion|growth|views|followers|increase|saved)\b/i.test(input)) return "performance";
  if (/\b(cure|clinic|medical|health|finance|investment|legal)\b/i.test(input)) return "regulated";
  return "business-fact";
}

function containsMeaningfulOverlap(text: string, reference: string) {
  const haystack = text.toLowerCase();
  const terms = reference
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length >= 5)
    .slice(0, 20);
  return terms.some((term) => haystack.includes(term));
}

function sentenceAt(input: string, index: number) {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return sentences[index % Math.max(1, sentences.length)] || input;
}

function roundSecond(value: number) {
  return Math.round(value * 10) / 10;
}

function appendUnique<T extends string>(base: T[], additions: string[]) {
  return Array.from(new Set([...base, ...additions.filter(Boolean)])) as T[];
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}
