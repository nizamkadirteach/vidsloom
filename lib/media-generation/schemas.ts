import { z } from "zod";

import { PlatformSchema, VideoDurationSecondsSchema, VideoQualityModeSchema } from "@/lib/schemas";

export const MediaAspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const MediaSourceTypeSchema = z.enum([
  "real-asset",
  "generated-support",
  "hybrid",
  "programmatic-card",
  "proof-overlay",
  "still-motion",
  "needs-customer-asset"
]);

export const MediaCostTierSchema = z.enum(["preview", "standard", "premium"]);

export const MediaJobTypeSchema = z.enum([
  "asset-analysis",
  "prompt-compile",
  "reference-frame",
  "video-clip",
  "tts",
  "assembly",
  "qa",
  "regeneration"
]);

export const MediaJobStatusSchema = z.enum([
  "planned",
  "queued",
  "running",
  "completed",
  "edit-fixable",
  "regen-required",
  "needs-customer-assets",
  "blocked",
  "failed"
]);

export const AssetAnalysisSchema = z.object({
  assetId: z.string(),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  assetType: z.string().trim().max(80),
  detectedText: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  logoConfidence: z.number().int().min(0).max(100).default(0),
  productConfidence: z.number().int().min(0).max(100).default(0),
  proofConfidence: z.number().int().min(0).max(100).default(0),
  faceOrPersonPresence: z.boolean().default(false),
  qualityScore: z.number().int().min(0).max(100).default(0),
  usageRightsStatus: z.enum(["approved", "reference-only", "needs-review", "blocked"]).default("needs-review"),
  recommendedUses: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  blockedUses: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  notes: z.array(z.string().trim().min(1).max(220)).max(12).default([])
});

export const ProductionBriefSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  businessName: z.string().trim().min(1).max(120),
  industry: z.string().trim().min(1).max(120),
  offer: z.string().trim().min(1).max(1200),
  audience: z.string().trim().min(1).max(1200),
  goal: z.string().trim().min(1).max(600),
  brandVoice: z.string().trim().max(400).default("clear, direct, customer-first"),
  brandColors: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  platforms: z.array(PlatformSchema).min(1).max(6),
  durationSeconds: VideoDurationSecondsSchema,
  qualityMode: VideoQualityModeSchema,
  approvedProof: z.array(z.string().trim().min(1).max(240)).max(50).default([]),
  prohibitedClaims: z.array(z.string().trim().min(1).max(240)).max(50).default([]),
  complianceNotes: z.array(z.string().trim().min(1).max(240)).max(50).default([]),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  overlayPolicy: z.literal("post-production-only").default("post-production-only")
});

export const MediaShotPlanSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().min(1).max(180),
  platform: PlatformSchema,
  shotNumber: z.number().int().min(1).max(20),
  startSecond: z.number().min(0).max(180),
  endSecond: z.number().min(0).max(180),
  durationSeconds: z.number().min(1).max(12),
  role: z.enum(["hook", "problem", "offer", "proof", "demo", "cta", "transition"]),
  creativeFormula: z.string().trim().max(260).default(""),
  visualGoal: z.string().trim().max(260).default(""),
  cameraLanguage: z.string().trim().max(260).default(""),
  motionGoal: z.string().trim().max(260).default(""),
  sourceType: MediaSourceTypeSchema,
  costTier: MediaCostTierSchema,
  requiredProofIds: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  referenceAssetIds: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  subject: z.string().trim().min(1).max(240),
  action: z.string().trim().min(1).max(260),
  setting: z.string().trim().max(260).default("business-relevant vertical scene"),
  camera: z.string().trim().max(220).default("mobile-first vertical framing"),
  lighting: z.string().trim().max(180).default("bright, realistic, premium but believable"),
  pace: z.string().trim().max(160).default("fast social-native pacing"),
  emotion: z.string().trim().max(160).default("useful, confident, commercially clear"),
  overlayText: z.string().trim().max(180).default(""),
  voiceoverLine: z.string().trim().max(280).default(""),
  overlaySafeZoneRequired: z.boolean().default(true),
  expectedCleanOverlayZones: z.array(z.enum(["top", "upper-middle", "center", "lower-third", "right-rail", "bottom"])).max(6).default([
    "upper-middle",
    "center",
    "lower-third"
  ]),
  safeZoneNotes: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
  complianceNotes: z.array(z.string().trim().min(1).max(220)).max(10).default([]),
  fallbackRoute: z.enum(["still-motion", "programmatic-card", "request-assets", "manual-review"]).default("still-motion")
});

export const PromptInvariantBlockSchema = z.object({
  businessName: z.string(),
  industry: z.string(),
  offer: z.string(),
  audience: z.string(),
  brandVoice: z.string(),
  approvedProof: z.array(z.string()),
  prohibitedClaims: z.array(z.string()),
  complianceNotes: z.array(z.string()),
  referenceAssetIds: z.array(z.string()),
  platform: PlatformSchema,
  aspectRatio: MediaAspectRatioSchema,
  overlayPolicy: z.literal("post-production-only")
});

export const PromptShotBlockSchema = z.object({
  shotPurpose: z.string(),
  subject: z.string(),
  action: z.string(),
  scene: z.string(),
  productServiceSpecifics: z.string(),
  camera: z.string(),
  lighting: z.string(),
  pace: z.string(),
  emotion: z.string(),
  mustShow: z.array(z.string()),
  avoid: z.array(z.string()),
  durationSeconds: z.number().min(1).max(12),
  continuity: z.string()
});

export const CompiledPromptPacketSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().min(1).max(180),
  shotId: z.string().trim().min(1).max(120),
  promptVersion: z.string().trim().min(1).max(80),
  templateIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  invariantBlock: PromptInvariantBlockSchema,
  shotBlock: PromptShotBlockSchema,
  qualityProfile: z
    .object({
      targetDurationSeconds: VideoDurationSecondsSchema.default(15),
      clipDurationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(4),
      resolution: z.enum(["720p", "1080p"]).default("720p"),
      generationLane: z.enum(["low-cost-preview", "balanced-production", "premium-hero"]).default("balanced-production"),
      finalAssemblyRequired: z.boolean().default(true),
      maxRegenerationAttempts: z.number().int().min(1).max(5).default(3),
      bestPracticeNotes: z.array(z.string().trim().min(1).max(200)).max(10).default([])
    })
    .default({
      targetDurationSeconds: 15,
      clipDurationSeconds: 4,
      resolution: "720p",
      generationLane: "balanced-production",
      finalAssemblyRequired: true,
      maxRegenerationAttempts: 3,
      bestPracticeNotes: []
    }),
  postProductionPlan: z
    .object({
      exactOverlays: z.array(z.string().trim().min(1).max(220)).max(16).default([]),
      safeZone: z.string().trim().max(260).default("Central vertical safe area, avoiding platform UI."),
      subtitleStyle: z.string().trim().max(220).default("Bold, high-contrast subtitles in short chunks."),
      proofPolicy: z.string().trim().max(260).default("Only customer-approved proof appears in deterministic overlays."),
      ctaPolicy: z.string().trim().max(220).default("One measurable CTA in the final safe zone."),
      logoPolicy: z.string().trim().max(220).default("Customer logo is composited in post, never generated inside footage.")
    })
    .default({
      exactOverlays: [],
      safeZone: "Central vertical safe area, avoiding platform UI.",
      subtitleStyle: "Bold, high-contrast subtitles in short chunks.",
      proofPolicy: "Only customer-approved proof appears in deterministic overlays.",
      ctaPolicy: "One measurable CTA in the final safe zone.",
      logoPolicy: "Customer logo is composited in post, never generated inside footage."
    }),
  positivePrompt: z.string().trim().min(40).max(4000),
  providerNativeNegative: z.string().trim().max(1400).optional().or(z.literal("")).default(""),
  qaConstraints: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  safetyConstraints: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  costTier: MediaCostTierSchema,
  publicSummary: z.string().trim().max(240)
});

export const MediaQaReportSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().min(1).max(180),
  shotId: z.string().trim().max(120).default(""),
  status: z.enum(["publish-ready", "edit-fixable", "regen-required", "needs-customer-assets", "blocked"]),
  scores: z.object({
    firstFrameImpact: z.number().int().min(0).max(5),
    threeSecondRetention: z.number().int().min(0).max(5),
    businessSpecificity: z.number().int().min(0).max(5),
    productServiceClarity: z.number().int().min(0).max(5),
    proofCredibility: z.number().int().min(0).max(5),
    visualQuality: z.number().int().min(0).max(5),
    temporalConsistency: z.number().int().min(0).max(5),
    mobileReadability: z.number().int().min(0).max(5),
    brandFit: z.number().int().min(0).max(5),
    platformFit: z.number().int().min(0).max(5),
    ctaClarity: z.number().int().min(0).max(5),
    costEfficiency: z.number().int().min(0).max(5)
  }),
  metadataChecks: z
    .object({
      aspectRatioOk: z.boolean().default(true),
      durationOk: z.boolean().default(true),
      playable: z.boolean().default(true),
      resolutionOk: z.boolean().default(true),
      safeZonePlanned: z.boolean().default(true),
      finalAssemblyRequired: z.boolean().default(true)
    })
    .default({
      aspectRatioOk: true,
      durationOk: true,
      playable: true,
      resolutionOk: true,
      safeZonePlanned: true,
      finalAssemblyRequired: true
    }),
  semanticChecks: z
    .object({
      textInFootageDetected: z.boolean().default(false),
      logoDistortionDetected: z.boolean().default(false),
      anatomyIssueDetected: z.boolean().default(false),
      genericStockFeelScore: z.number().int().min(0).max(100).default(0),
      first3SecondImpactScore: z.number().int().min(0).max(100).default(0),
      brandFitScore: z.number().int().min(0).max(100).default(0),
      claimRiskScore: z.number().int().min(0).max(100).default(0),
      proofRiskScore: z.number().int().min(0).max(100).default(0)
    })
    .default({
      textInFootageDetected: false,
      logoDistortionDetected: false,
      anatomyIssueDetected: false,
      genericStockFeelScore: 0,
      first3SecondImpactScore: 0,
      brandFitScore: 0,
      claimRiskScore: 0,
      proofRiskScore: 0
    }),
  verdict: z.enum(["pass", "edit-fixable", "regenerate", "needs-assets", "blocked"]).default("pass"),
  failureReasons: z.array(z.string().trim().min(1).max(220)).max(16).default([]),
  regenerationRecipeId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  claimSafetyPassed: z.boolean(),
  fakeProofRiskPassed: z.boolean(),
  issues: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  nextActions: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  reviewedAt: z.string()
});

export const RegenerationRequestSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().min(1).max(180),
  shotId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(300),
  attempt: z.number().int().min(1).max(5).default(1),
  maxAttempts: z.number().int().min(1).max(5).default(3),
  unchangedBlocks: z.array(z.string().trim().min(1).max(240)).max(20),
  retain: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  issuesToFix: z.array(z.string().trim().min(1).max(240)).max(20),
  change: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  promptDelta: z.string().trim().max(500).default(""),
  updatedNegativePrompt: z.string().trim().max(1000).default(""),
  tierEscalation: z.enum(["none", "standard", "premium", "fallback-still-motion"]).default("none"),
  route: z.enum(["regenerate-shot", "edit-in-post", "switch-to-still-motion", "request-more-assets", "block"])
});

export const RenderCompositionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().min(1).max(180),
  aspectRatio: MediaAspectRatioSchema.default("9:16"),
  durationSeconds: VideoDurationSecondsSchema,
  sourceShotIds: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  sourceProofIds: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  assemblyStrategy: z
    .enum(["ai-clips-plus-deterministic-overlays", "still-motion-plus-overlays", "programmatic-proof-card", "manual-review"])
    .default("ai-clips-plus-deterministic-overlays"),
  safeZoneSpec: z.array(z.string().trim().min(1).max(240)).max(16).default([
    "Keep title and proof overlays in the central safe area.",
    "Avoid bottom caption/UI region and right-side platform controls."
  ]),
  overlaySpec: z.array(z.string().trim().min(1).max(240)).max(40),
  subtitleSpec: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
  audioSpec: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  thumbnailSpec: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  loudnessTarget: z.string().trim().max(80).default("-14 LUFS integrated, speech clear"),
  ctaSpec: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  exportVariants: z.array(PlatformSchema).min(1).max(6)
});

export const MediaJobSchema = z.object({
  id: z.string().trim().min(1).max(120),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  campaignId: z.string().trim().min(1).max(80),
  conceptTitle: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  shotId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  jobType: MediaJobTypeSchema,
  status: MediaJobStatusSchema,
  attempt: z.number().int().min(0).max(20).default(0),
  priority: z.number().int().min(0).max(100).default(50),
  costTier: MediaCostTierSchema.default("preview"),
  publicStatus: z.string().trim().max(240).default("Preparing VIDSLOOM media production."),
  internalError: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  createdAt: z.string(),
  startedAt: z.string().optional().or(z.literal("")).default(""),
  completedAt: z.string().optional().or(z.literal("")).default(""),
  nextAction: z.string().trim().max(240).optional().or(z.literal("")).default("")
});

export const MediaBudgetLineSchema = z.object({
  label: z.string().trim().min(1).max(160),
  jobType: MediaJobTypeSchema,
  shotId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  costTier: MediaCostTierSchema.default("preview"),
  estimatedCents: z.number().int().min(0)
});

export const MediaBudgetPlanSchema = z.object({
  configuredBudgetCents: z.number().int().min(0).default(0),
  estimatedCostCents: z.number().int().min(0).default(0),
  remainingBudgetCents: z.number().int().default(0),
  allowUnbudgetedGeneration: z.boolean().default(false),
  maxPremiumClips: z.number().int().min(0).default(0),
  premiumClipsPlanned: z.number().int().min(0).default(0),
  executableShotIds: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  blockedShotIds: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  status: z.enum(["dry-run-only", "within-budget", "no-budget", "over-budget", "premium-limit", "blocked-by-qa"]).default("dry-run-only"),
  blockers: z.array(z.string().trim().min(1).max(260)).max(20).default([]),
  costLines: z.array(MediaBudgetLineSchema).max(120).default([])
});

export const MediaProductionPlanSchema = z.object({
  id: z.string().trim().min(1).max(120),
  campaignId: z.string().trim().min(1).max(80),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  createdAt: z.string(),
  mode: z.enum(["dry-run", "reference-frame", "video-generation", "final-assembly"]).default("dry-run"),
  productionBrief: ProductionBriefSchema,
  assetAnalyses: z.array(AssetAnalysisSchema).max(200).default([]),
  shotPlans: z.array(MediaShotPlanSchema).max(100).default([]),
  promptPackets: z.array(CompiledPromptPacketSchema).max(100).default([]),
  qaReports: z.array(MediaQaReportSchema).max(100).default([]),
  regenerationRequests: z.array(RegenerationRequestSchema).max(100).default([]),
  renderCompositions: z.array(RenderCompositionSchema).max(30).default([]),
  jobs: z.array(MediaJobSchema).max(200).default([]),
  budget: MediaBudgetPlanSchema,
  publicSummary: z.object({
    status: z.enum(["ready-for-preview", "needs-assets", "blocked"]),
    message: z.string().trim().max(360),
    nextActions: z.array(z.string().trim().min(1).max(240)).max(20)
  })
});

export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;
export type ProductionBrief = z.infer<typeof ProductionBriefSchema>;
export type MediaShotPlan = z.infer<typeof MediaShotPlanSchema>;
export type CompiledPromptPacket = z.infer<typeof CompiledPromptPacketSchema>;
export type MediaQaReport = z.infer<typeof MediaQaReportSchema>;
export type RegenerationRequest = z.infer<typeof RegenerationRequestSchema>;
export type RenderComposition = z.infer<typeof RenderCompositionSchema>;
export type MediaJob = z.infer<typeof MediaJobSchema>;
export type MediaBudgetLine = z.infer<typeof MediaBudgetLineSchema>;
export type MediaBudgetPlan = z.infer<typeof MediaBudgetPlanSchema>;
export type MediaProductionPlan = z.infer<typeof MediaProductionPlanSchema>;
