import { z } from "zod";

export const PlatformSchema = z.enum([
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "LinkedIn",
  "X",
  "Facebook Reels"
]);

export const AutomationSetupSchema = z.object({
  publishingMode: z.enum(["approval-first", "auto-after-rules", "manual-only"]).default("approval-first"),
  approvalPolicy: z.enum(["approve-every-post", "auto-approve-low-risk", "auto-publish-after-24h"]).default("approve-every-post"),
  notificationChannels: z.array(z.enum(["Email", "WhatsApp", "SMS", "Slack"])).min(1).default(["Email"]),
  notificationContact: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  postingTimezone: z.string().trim().max(80).default("Customer local time"),
  quietHours: z.string().trim().max(80).default("9:00 PM-8:00 AM local time"),
  budgetSensitivity: z.enum(["lowest-cost", "balanced", "maximum-impact"]).default("lowest-cost"),
  assetSource: z.enum(["customer-uploaded", "vidsloom-assisted", "stock-and-template-light"]).default("customer-uploaded"),
  connectedAccounts: z
    .array(
      z.object({
        platform: PlatformSchema,
        handle: z.string().trim().max(80).optional().or(z.literal("")).default(""),
        status: z.enum(["not-connected", "connected", "needs-renewal", "pending-review"]).default("not-connected"),
        autoPublish: z.boolean().default(false)
      })
    )
    .default([])
});

export const VideoDurationSecondsSchema = z.union([
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
  z.literal(45),
  z.literal(60)
]);

export const VideoQualityModeSchema = z.enum(["fast-preview", "balanced", "highest-quality"]);

export const defaultVideoQualityInstructions =
  "Use a strong first-three-second hook, premium 9:16 mobile framing, visible product/service context, realistic motion, large readable subtitles, claim-safe proof overlays, clean safe zones, and one clear CTA. Keep exact text, logos, prices, captions, reviews, metrics, and proof in deterministic post-production; never generate them inside AI footage.";

export const VideoSettingsSchema = z.object({
  durationSeconds: VideoDurationSecondsSchema.default(15),
  qualityMode: VideoQualityModeSchema.default("balanced"),
  qualityInstructions: z.string().trim().max(900).default(defaultVideoQualityInstructions)
});

export const defaultBrandKit = {
  logoUrl: "",
  primaryColor: "",
  secondaryColor: "",
  fontStyle: "",
  brandDo: "",
  brandDont: ""
};

export const BrandKitSchema = z.object({
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")).default(""),
  primaryColor: z.string().trim().max(40).optional().or(z.literal("")).default(""),
  secondaryColor: z.string().trim().max(40).optional().or(z.literal("")).default(""),
  fontStyle: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  brandDo: z.string().trim().max(800).optional().or(z.literal("")).default(""),
  brandDont: z.string().trim().max(800).optional().or(z.literal("")).default("")
});

export const defaultCreativeSettings = {
  hookStyle: "proof-first" as const,
  captionStyle: "bold-subtitles" as const,
  ctaType: "send-dm" as const,
  visualStyle: "fast-cut" as const,
  musicMood: "upbeat" as const,
  voiceoverStyle: "narrator" as const,
  subtitlesRequired: true
};

export const CreativeSettingsSchema = z.object({
  hookStyle: z
    .enum(["direct-problem", "before-after", "proof-first", "founder-pov", "trend-remix"])
    .default("proof-first"),
  captionStyle: z.enum(["bold-subtitles", "clean-premium", "ugc-native", "minimal"]).default("bold-subtitles"),
  ctaType: z.enum(["book-call", "send-dm", "buy-now", "claim-offer", "learn-more"]).default("send-dm"),
  visualStyle: z.enum(["premium-clean", "ugc-authentic", "fast-cut", "product-demo", "testimonial-proof"]).default("fast-cut"),
  musicMood: z.enum(["upbeat", "calm-premium", "energetic", "none"]).default("upbeat"),
  voiceoverStyle: z.enum(["none", "founder", "narrator", "customer-story"]).default("narrator"),
  subtitlesRequired: z.boolean().default(true)
});

export const CampaignIntakeSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  website: z.string().trim().max(160).optional().or(z.literal("")),
  industry: z.string().trim().min(2).max(80),
  offer: z.string().trim().min(20).max(900),
  audience: z.string().trim().min(20).max(900),
  goal: z.string().trim().min(10).max(400),
  brandVoice: z.string().trim().min(5).max(300),
  platforms: z.array(PlatformSchema).min(1).max(6),
  constraints: z.string().trim().max(900).optional().or(z.literal("")),
  proofPoints: z.string().trim().max(900).optional().or(z.literal("")),
  assets: z.string().trim().max(900).optional().or(z.literal("")),
  cadence: z.enum(["3 posts/week", "5 posts/week", "Daily", "Launch sprint"]),
  brandKit: BrandKitSchema.default(defaultBrandKit),
  creativeSettings: CreativeSettingsSchema.default(defaultCreativeSettings),
  videoSettings: VideoSettingsSchema.default({
    durationSeconds: 15,
    qualityMode: "balanced",
    qualityInstructions: defaultVideoQualityInstructions
  }),
  automationSetup: AutomationSetupSchema.default({
    publishingMode: "approval-first",
    approvalPolicy: "approve-every-post",
    notificationChannels: ["Email"],
    notificationContact: "",
    postingTimezone: "Customer local time",
    quietHours: "9:00 PM-8:00 AM local time",
    budgetSensitivity: "lowest-cost",
    assetSource: "customer-uploaded",
    connectedAccounts: []
  })
});

export const TrendAngleSchema = z.object({
  name: z.string(),
  insight: z.string(),
  fitScore: z.number().min(0).max(100),
  executionNote: z.string()
});

export const TrendSignalSchema = z.object({
  trendId: z.string().trim().max(120).default(""),
  capturedAt: z.string().trim().max(80).default(""),
  platform: PlatformSchema,
  format: z.string(),
  trendSignal: z.string(),
  whyNow: z.string(),
  remixFormula: z.string(),
  formulaSummary: z.string().trim().max(500).default(""),
  hookPatterns: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
  shotPatterns: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
  ctaPattern: z.string().trim().max(220).default(""),
  audioPattern: z.string().trim().max(220).default(""),
  funnelStage: z.enum(["TOFU", "MOFU", "BOFU", "mixed"]).default("TOFU"),
  organicPlay: z.string(),
  paidVariant: z.string(),
  recommendedAssetType: z.string(),
  costLevel: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(100),
  organicFit: z.number().min(0).max(100).default(0),
  paidFit: z.number().min(0).max(100).default(0),
  transferability: z.number().min(0).max(100).default(0),
  businessSafety: z.number().min(0).max(100).default(0),
  complianceRisk: z.number().min(0).max(100).default(0),
  decayRisk: z.number().min(0).max(100).default(0),
  regions: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  categories: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  sourceUrls: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  recommendedFor: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  avoidFor: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  sourceType: z.enum(["google-search-grounded", "platform-observation", "model-formula", "fallback-formula"])
});

export const TrendIntelligenceSchema = z.object({
  agentName: z.literal("ZeitgeistScout"),
  generatedAt: z.string(),
  freshnessWindow: z.string(),
  caveat: z.string(),
  recommendedFormats: z.array(z.string()).min(3),
  signals: z.array(TrendSignalSchema).min(3)
});

export const ProofClaimTypeSchema = z.enum([
  "offer",
  "pricing",
  "testimonial",
  "performance",
  "business-fact",
  "regulated",
  "visual",
  "other"
]);

export const ProofItemSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["customer-intake", "customer-asset", "customer-proof-note", "customer-review", "system-policy"]),
  claimType: ProofClaimTypeSchema,
  summary: z.string().trim().min(1).max(240),
  evidenceText: z.string().trim().max(800).default(""),
  assetIds: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  status: z.enum(["verified-from-customer", "needs-customer-confirmation", "reference-only", "prohibited"]).default(
    "needs-customer-confirmation"
  ),
  action: z.string().trim().max(240).default("")
});

export const CampaignProofGraphSchema = z.object({
  generatedAt: z.string().default(""),
  readinessScore: z.number().int().min(0).max(100).default(0),
  readinessStatus: z.enum(["not-ready", "needs-assets", "usable", "strong"]).default("not-ready"),
  policy: z.string().trim().max(700).default(
    "Only customer-supplied or customer-approved proof can support claims. Do not invent testimonials, metrics, awards, outcomes, medical claims, financial claims, or guaranteed performance."
  ),
  items: z.array(ProofItemSchema).max(80).default([]),
  missingProof: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  blockedClaims: z.array(z.string().trim().min(1).max(220)).max(20).default([])
});

export const ClaimReviewSchema = z.object({
  status: z.enum(["pass", "needs-proof", "blocked"]).default("needs-proof"),
  supportedClaims: z.array(z.string().trim().min(1).max(220)).max(20).default([]),
  unsupportedClaims: z.array(z.string().trim().min(1).max(220)).max(20).default([]),
  blockedClaims: z.array(z.string().trim().min(1).max(220)).max(20).default([]),
  requiredCustomerConfirmations: z.array(z.string().trim().min(1).max(220)).max(20).default([])
});

export const StoryboardShotSchema = z.object({
  shotNumber: z.number().int().min(1).max(20),
  startSecond: z.number().min(0).max(180),
  endSecond: z.number().min(0).max(180),
  purpose: z.enum(["hook", "problem", "offer", "proof", "demo", "cta", "transition"]),
  visualSource: z.enum(["customer-asset", "generated-support", "text-overlay", "reference-only", "needs-asset"]).default(
    "needs-asset"
  ),
  assetRefs: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  onScreenText: z.string().trim().min(1).max(180),
  voiceover: z.string().trim().max(280).default(""),
  motionDirection: z.string().trim().max(220).default(""),
  productionNote: z.string().trim().max(260).default(""),
  approvalRequired: z.boolean().default(true)
});

export const QualityGateCheckSchema = z.object({
  category: z.string().trim().min(2).max(80),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  issue: z.string().trim().max(220).default(""),
  action: z.string().trim().max(220).default("")
});

export const ConceptQualityGateSchema = z.object({
  status: z.enum(["pass", "needs-review", "blocked"]).default("needs-review"),
  score: z.number().int().min(0).max(100).default(0),
  minPublishScore: z.number().int().min(0).max(100).default(78),
  checks: z.array(QualityGateCheckSchema).max(20).default([]),
  publishBlockers: z.array(z.string().trim().min(1).max(220)).max(20).default([]),
  nextActions: z.array(z.string().trim().min(1).max(220)).max(20).default([])
});

export const GenerationRoutingSchema = z.object({
  planningModel: z.string().trim().max(120).default("configured-ai-planner"),
  mediaModel: z.string().trim().max(120).default("configured-video-engine"),
  renderEngine: z.enum(["ai-video", "ffmpeg-assembly", "sample-fallback", "manual"]).default("ffmpeg-assembly"),
  qualityTier: VideoQualityModeSchema.default("balanced"),
  degradedMode: z.boolean().default(false),
  fallbackReason: z.string().trim().max(360).default(""),
  customerVisibleStatus: z.string().trim().max(220).default("AI campaign planning with review-safe rendering path."),
  internalNotes: z.array(z.string().trim().min(1).max(240)).max(20).default([])
});

export const VideoConceptSchema = z.object({
  title: z.string(),
  platform: PlatformSchema,
  objective: z.string(),
  hook: z.string(),
  script: z.string(),
  shotList: z.array(z.string()).min(3),
  caption: z.string(),
  hashtags: z.array(z.string()).min(3).max(10),
  cta: z.string(),
  approvalRisks: z.array(z.string()),
  qualityScore: z.number().min(0).max(100),
  claimReview: ClaimReviewSchema.default({
    status: "needs-proof",
    supportedClaims: [],
    unsupportedClaims: [],
    blockedClaims: [],
    requiredCustomerConfirmations: []
  }),
  storyboard: z.array(StoryboardShotSchema).default([]),
  qualityGate: ConceptQualityGateSchema.default({
    status: "needs-review",
    score: 0,
    minPublishScore: 78,
    checks: [],
    publishBlockers: [],
    nextActions: []
  })
});

export const GeneratedVideoAssetSchema = z.object({
  id: z.string(),
  conceptTitle: z.string(),
  platform: PlatformSchema,
  title: z.string(),
  status: z
    .enum([
      "render-queued",
      "rendering",
      "rendered-preview",
      "ready-for-approval",
      "approved",
      "revision-requested",
      "render-failed",
      "final-ready"
    ])
    .default("rendered-preview"),
  videoUrl: z.string(),
  posterUrl: z.string(),
  sourceImageUrl: z.string().optional().or(z.literal("")).default(""),
  storageProvider: z.enum(["public-sample", "local", "gcs"]).default("public-sample"),
  storageKey: z.string().optional().or(z.literal("")).default(""),
  posterStorageKey: z.string().optional().or(z.literal("")).default(""),
  renderMode: z.enum(["sample-fallback", "queued-render", "dynamic-render", "ai-generated"]).default("sample-fallback"),
  renderJobId: z.string().optional().or(z.literal("")).default(""),
  renderError: z.string().optional().or(z.literal("")).default(""),
  renderQueuedAt: z.string().optional().or(z.literal("")).default(""),
  renderStartedAt: z.string().optional().or(z.literal("")).default(""),
  renderCompletedAt: z.string().optional().or(z.literal("")).default(""),
  aspectRatio: z.literal("9:16").default("9:16"),
  resolution: z.string().optional().or(z.literal("")).default("720x1280"),
  durationSeconds: z.number().min(1).max(180),
  qualityMode: VideoQualityModeSchema.default("balanced"),
  qualityInstructions: z.string().trim().max(900).default(defaultVideoQualityInstructions),
  renderStyle: z.string(),
  generatedBy: z.enum(["VIDSLOOM video renderer", "VIDSLOOM AI media pipeline"]).default("VIDSLOOM video renderer"),
  provenance: z.string(),
  sourceInputs: z.array(z.string()).min(1),
  pipelineSteps: z.array(z.string()).min(3),
  outputIncludes: z.array(z.string()).min(3),
  usageBoundary: z.string(),
  aiMediaQa: z
    .object({
      verdict: z.enum(["pass", "edit-fixable", "regenerate", "blocked", "not-run"]).default("not-run"),
      firstThreeSecondImpact: z.number().int().min(0).max(100).default(0),
      motionCoherence: z.number().int().min(0).max(100).default(0),
      artifactRisk: z.number().int().min(0).max(100).default(0),
      textOrLogoLeak: z.boolean().default(false),
      failureReasons: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
      qaSource: z.enum(["deterministic-preflight", "vision-review", "human-review", "not-run"]).default("not-run")
    })
    .default({
      verdict: "not-run",
      firstThreeSecondImpact: 0,
      motionCoherence: 0,
      artifactRisk: 0,
      textOrLogoLeak: false,
      failureReasons: [],
      qaSource: "not-run"
    }),
  qualityGate: ConceptQualityGateSchema.default({
    status: "needs-review",
    score: 0,
    minPublishScore: 78,
    checks: [],
    publishBlockers: [],
    nextActions: []
  }),
  createdAt: z.string()
});

export const MediaGenerationAssetRecordSchema = z.object({
  shotId: z.string().trim().min(1).max(240),
  conceptTitle: z.string().trim().min(1).max(180),
  type: z.enum(["reference-frame", "video-clip", "final-video"]),
  status: z.enum(["disabled", "generated", "failed"]),
  assetUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  assetKey: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  provider: z.string().trim().max(60).optional().or(z.literal("")).default(""),
  error: z.string().trim().max(1200).optional().or(z.literal("")).default("")
});

export const MediaGenerationRunSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  mode: z.enum(["dry-run", "reference-frame", "video-generation", "final-assembly"]),
  status: z.enum(["planned", "generated", "disabled", "failed"]),
  planId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  generatedAssets: z.array(MediaGenerationAssetRecordSchema).default([]),
  promotedAssetIds: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  qaSummary: z
    .object({
      passed: z.number().int().min(0).default(0),
      editFixable: z.number().int().min(0).default(0),
      regenerate: z.number().int().min(0).default(0),
      blocked: z.number().int().min(0).default(0),
      maxRegenerationAttempts: z.number().int().min(1).max(5).default(3)
    })
    .default({
      passed: 0,
      editFixable: 0,
      regenerate: 0,
      blocked: 0,
      maxRegenerationAttempts: 3
    }),
  assemblySummary: z
    .array(z.string().trim().min(1).max(220))
    .max(12)
    .default([
      "AI clips are treated as motion ingredients.",
      "Exact text, logos, proof, captions, prices, and CTAs are added in deterministic post-production."
    ]),
  summary: z.string().trim().max(360).default("")
});

export const CalendarItemSchema = z.object({
  day: z.string(),
  platform: PlatformSchema,
  conceptTitle: z.string(),
  publishWindow: z.string(),
  reason: z.string()
});

export const ExperimentSchema = z.object({
  testName: z.string(),
  variantA: z.string(),
  variantB: z.string(),
  successMetric: z.string()
});

export const KpiSchema = z.object({
  metric: z.string(),
  target: z.string(),
  captureMethod: z.string()
});

export const PublishingTaskSchema = z.object({
  platform: PlatformSchema,
  conceptTitle: z.string(),
  day: z.string(),
  publishWindow: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()).min(1).max(12),
  status: z.enum(["needs-assets", "needs-approval", "ready-to-schedule", "scheduled", "published", "blocked"]),
  automationMode: z.enum(["direct-api-after-oauth", "approval-required", "manual-upload-fallback"]),
  connectedAccountRequired: z.boolean(),
  assetChecklist: z.array(z.string()).min(2),
  approvalChecklist: z.array(z.string()).min(2),
  platformRequirement: z.string(),
  costControlNote: z.string()
});

export const PublishingMethodSchema = z.enum(["manual-assisted", "direct-api"]);
export const PublishingAttemptStatusSchema = z.enum([
  "manual-kit-ready",
  "queued",
  "publishing",
  "published",
  "blocked",
  "failed"
]);

export const SocialConnectionSchema = z.object({
  id: z.string(),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  platform: PlatformSchema,
  handle: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  accountId: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  accountName: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  status: z.enum(["connected", "pending-review", "needs-renewal", "revoked"]).default("pending-review"),
  autoPublish: z.boolean().default(false),
  scopes: z.array(z.string().trim().min(1).max(140)).max(30).default([]),
  tokenType: z.string().trim().max(40).optional().or(z.literal("")).default("Bearer"),
  accessTokenEncrypted: z.string().optional().or(z.literal("")).default(""),
  refreshTokenEncrypted: z.string().optional().or(z.literal("")).default(""),
  expiresAt: z.string().optional().or(z.literal("")).default(""),
  metadata: z.record(z.string(), z.string()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastValidatedAt: z.string().optional().or(z.literal("")).default("")
});

export const PublishingAttemptSchema = z.object({
  id: z.string(),
  campaignId: z.string().trim().min(1).max(80),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  taskKey: z.string().trim().min(1).max(360),
  platform: PlatformSchema,
  conceptTitle: z.string().trim().min(1).max(180),
  method: PublishingMethodSchema,
  status: PublishingAttemptStatusSchema,
  requestedBy: z.enum(["qa", "customer", "system"]).default("qa"),
  connectionId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  assetUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  posterUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  caption: z.string().trim().max(3000).default(""),
  hashtags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  publishWindow: z.string().trim().max(120).default(""),
  scheduledFor: z.string().optional().or(z.literal("")).default(""),
  instructions: z.array(z.string().trim().min(1).max(360)).max(30).default([]),
  checklist: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  externalPostId: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  externalUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  providerResponse: z.record(z.string(), z.string()).default({}),
  error: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const PublishingActionRequestSchema = z.object({
  taskKey: z.string().trim().min(1).max(360),
  method: PublishingMethodSchema,
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  accessToken: z.string().trim().max(180).optional().or(z.literal("")).default("")
});

export const CampaignPackSchema = z.object({
  executiveBrief: z.string(),
  positioning: z.string(),
  trendIntelligence: TrendIntelligenceSchema.default(() => TrendIntelligenceSchema.parse({
    agentName: "ZeitgeistScout",
    generatedAt: "",
    freshnessWindow: "Fallback trend formulas; refresh before production publishing.",
    caveat: "Trend intelligence should be refreshed before publishing because viral formats change quickly.",
    recommendedFormats: ["Problem-first hook", "Founder POV", "Before-after proof", "Comment-led myth busting"],
    signals: [
      {
        platform: "TikTok",
        format: "Problem-first hook",
        trendSignal: "Short educational hooks with immediate payoff.",
        whyNow: "Works as an evergreen fallback when live trend grounding is unavailable.",
        remixFormula: "Name the pain, show the consequence, give one useful next step.",
        organicPlay: "Post as a low-production founder explanation.",
        paidVariant: "Boost only after organic retention or replies show traction.",
        recommendedAssetType: "Vertical founder video",
        costLevel: "low",
        confidence: 70,
        sourceType: "fallback-formula"
      },
      {
        platform: "Instagram Reels",
        format: "Before-after proof",
        trendSignal: "Simple transformation framing for business outcomes.",
        whyNow: "Works as an evergreen fallback when live trend grounding is unavailable.",
        remixFormula: "Show the old workflow, the new workflow, and the concrete customer benefit.",
        organicPlay: "Use captions and on-screen labels to make the outcome clear without sound.",
        paidVariant: "Use as a retargeting creative after proof is approved.",
        recommendedAssetType: "Vertical demo clip",
        costLevel: "low",
        confidence: 68,
        sourceType: "fallback-formula"
      },
      {
        platform: "YouTube Shorts",
        format: "Checklist explainer",
        trendSignal: "Compact checklist formats remain useful for search and discovery.",
        whyNow: "Works as an evergreen fallback when live trend grounding is unavailable.",
        remixFormula: "Give three checks, one warning, and one next action.",
        organicPlay: "Publish as a reusable educational short.",
        paidVariant: "Use as a low-cost top-of-funnel explainer.",
        recommendedAssetType: "Talking head plus captions",
        costLevel: "low",
        confidence: 66,
        sourceType: "fallback-formula"
      },
      {
        platform: "LinkedIn",
        format: "Comment-led myth busting",
        trendSignal: "Business audiences often respond to sharp corrections of common operating mistakes.",
        whyNow: "Works as an evergreen fallback when live trend grounding is unavailable.",
        remixFormula: "Quote the misconception, explain the cost, then show a practical replacement behavior.",
        organicPlay: "Publish as founder video or text-led clip with one clear lesson.",
        paidVariant: "Promote only to narrow customer segments after comments or saves indicate relevance.",
        recommendedAssetType: "Founder video or caption-led template",
        costLevel: "low",
        confidence: 65,
        sourceType: "fallback-formula"
      }
    ]
  })),
  proofGraph: CampaignProofGraphSchema.default({
    generatedAt: "",
    readinessScore: 0,
    readinessStatus: "not-ready",
    policy:
      "Only customer-supplied or customer-approved proof can support claims. Do not invent testimonials, metrics, awards, outcomes, medical claims, financial claims, or guaranteed performance.",
    items: [],
    missingProof: [],
    blockedClaims: []
  }),
  generationRouting: GenerationRoutingSchema.default({
    planningModel: "configured-ai-planner",
    mediaModel: "configured-video-engine",
    renderEngine: "ffmpeg-assembly",
    qualityTier: "balanced",
    degradedMode: false,
    fallbackReason: "",
    customerVisibleStatus: "AI campaign planning with review-safe rendering path.",
    internalNotes: []
  }),
  brandReadiness: z.array(z.string()).min(3),
  trendAngles: z.array(TrendAngleSchema).min(3),
  videoConcepts: z.array(VideoConceptSchema).min(3),
  videoAssets: z.array(GeneratedVideoAssetSchema).default([]),
  mediaJobs: z.array(MediaGenerationRunSchema).default([]),
  calendar: z.array(CalendarItemSchema).min(3),
  publishingQueue: z.array(PublishingTaskSchema).default([]),
  experiments: z.array(ExperimentSchema).min(2),
  kpiPlan: z.array(KpiSchema).min(3),
  risks: z.array(z.string()).min(2),
  nextActions: z.array(z.string()).min(4)
});

export const AgentRunSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  agentName: z.string(),
  model: z.string(),
  status: z.enum(["completed", "fallback", "failed"]),
  promptVersion: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  inputSummary: z.string(),
  outputSummary: z.string()
});

export const CampaignSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  customerId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  source: z.enum(["workspace", "customer-portal"]).default("workspace"),
  mode: z.enum(["gemini", "fallback"]),
  planningStatus: z.enum(["planning-queued", "planning", "planning-failed", "pack-ready"]).default("pack-ready"),
  planningQueuedAt: z.string().optional().or(z.literal("")).default(""),
  planningStartedAt: z.string().optional().or(z.literal("")).default(""),
  planningCompletedAt: z.string().optional().or(z.literal("")).default(""),
  planningJobId: z.string().optional().or(z.literal("")).default(""),
  planningError: z.string().optional().or(z.literal("")).default(""),
  intake: CampaignIntakeSchema,
  pack: CampaignPackSchema,
  agentRuns: z.array(AgentRunSchema),
  evidenceSummary: z.object({
    revenueEvidenceNeeded: z.array(z.string()),
    customerEvidenceNeeded: z.array(z.string()),
    productEvidenceGenerated: z.array(z.string())
  })
});

export const LeadSalesStatusSchema = z.enum(["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"]);
export const LeadPrioritySchema = z.enum(["hot", "warm", "nurture"]);
export const LeadSalesEventTypeSchema = z.enum(["created", "status", "contact", "note", "follow-up", "proposal", "won", "lost"]);

export const LeadSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  source: z.enum(["homepage", "growth-audit", "pilot", "sample-app"]).default("homepage"),
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  website: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  industry: z.string().trim().min(2).max(120),
  goal: z.string().trim().min(10).max(500),
  currentContent: z.string().trim().max(500).optional().or(z.literal("")).default(""),
  platforms: z.array(PlatformSchema).min(1).max(6),
  monthlyBudget: z.enum(["under-500", "500-1500", "1500-5000", "5000-plus", "not-sure"]).default("not-sure"),
  urgency: z.enum(["this-week", "this-month", "exploring"]).default("this-month"),
  preferredContact: z.enum(["Email", "WhatsApp", "SMS", "Phone"]).default("Email"),
  newsletterOptIn: z.boolean().default(false),
  consentToContact: z.boolean(),
  sales: z
    .object({
      status: LeadSalesStatusSchema.default("new"),
      priority: LeadPrioritySchema.default("warm"),
      score: z.number().int().min(0).max(100).default(0),
      scoreReasons: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
      assignedTo: z.string().trim().max(80).optional().or(z.literal("")).default(""),
      followUpTask: z.string().trim().max(240).optional().or(z.literal("")).default(""),
      lastContactedAt: z.string().optional().or(z.literal("")).default(""),
      nextFollowUpAt: z.string().optional().or(z.literal("")).default(""),
      notes: z.string().trim().max(2000).optional().or(z.literal("")).default(""),
      closeProbability: z.number().int().min(0).max(100).default(20),
      proposalAmount: z.number().min(0).default(0),
      lostReason: z.string().trim().max(240).optional().or(z.literal("")).default(""),
      events: z
        .array(
          z.object({
            id: z.string(),
            createdAt: z.string(),
            type: LeadSalesEventTypeSchema,
            summary: z.string().trim().min(1).max(280)
          })
        )
        .max(50)
        .default([])
    })
    .default({
      status: "new",
      priority: "warm",
      score: 0,
      scoreReasons: [],
      assignedTo: "",
      followUpTask: "",
      lastContactedAt: "",
      nextFollowUpAt: "",
      notes: "",
      closeProbability: 20,
      proposalAmount: 0,
      lostReason: "",
      events: []
    })
});

export const LeadCreateSchema = LeadSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sales: true
}).refine((data) => data.consentToContact, {
  message: "Consent to contact is required.",
  path: ["consentToContact"]
});

export const LeadSalesUpdateSchema = z.object({
  status: LeadSalesStatusSchema.optional(),
  priority: LeadPrioritySchema.optional(),
  score: z.number().int().min(0).max(100).optional(),
  scoreReasons: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  assignedTo: z.string().trim().max(80).optional().or(z.literal("")),
  followUpTask: z.string().trim().max(240).optional().or(z.literal("")),
  lastContactedAt: z.string().optional().or(z.literal("")),
  nextFollowUpAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  closeProbability: z.number().int().min(0).max(100).optional(),
  proposalAmount: z.number().min(0).optional(),
  lostReason: z.string().trim().max(240).optional().or(z.literal("")),
  eventType: LeadSalesEventTypeSchema.exclude(["created"]).optional(),
  eventSummary: z.string().trim().max(280).optional().or(z.literal(""))
});

export const BillingPlanSchema = z.enum(["starter", "growth", "managed"]);
export const CheckoutPlanSchema = z.enum(["starter", "growth"]);
export const BillingStatusSchema = z.enum([
  "checkout-started",
  "active",
  "trialing",
  "incomplete",
  "payment-failed",
  "cancelled",
  "refunded",
  "manual-review"
]);

export const BillingCustomerSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  email: z.string().trim().email().max(180),
  contactName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  plan: BillingPlanSchema,
  status: BillingStatusSchema.default("checkout-started"),
  source: z.enum(["pricing", "checkout", "lead", "manual", "webhook"]).default("checkout"),
  leadId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  stripeCustomerId: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  stripeCheckoutSessionId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  stripeSubscriptionId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  stripePriceId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  amountTotal: z.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default("sgd"),
  mode: z.enum(["subscription"]).default("subscription"),
  onboardingStatus: z.enum(["not-started", "needs-intake", "in-progress", "ready-for-production"]).default("needs-intake"),
  portalAccessToken: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  portalLastAccessAt: z.string().optional().or(z.literal("")).default(""),
  events: z
    .array(
      z.object({
        id: z.string(),
        createdAt: z.string(),
        type: z.enum(["checkout-created", "checkout-completed", "subscription-updated", "payment-failed", "cancelled", "note"]),
        summary: z.string().trim().min(1).max(280),
        stripeEventId: z.string().trim().max(160).optional().or(z.literal("")).default("")
      })
    )
    .max(80)
    .default([])
});

export const CheckoutCreateSchema = z.object({
  plan: CheckoutPlanSchema,
  email: z.string().trim().email().max(180),
  contactName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  leadId: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  source: z.enum(["pricing", "checkout", "lead"]).default("checkout")
});

export const StripeEventSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  processedAt: z.string(),
  type: z.string().trim().min(1).max(120),
  status: z.enum(["processed", "ignored", "failed"]),
  summary: z.string().trim().min(1).max(320),
  checkoutSessionId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  subscriptionId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  customerId: z.string().trim().max(160).optional().or(z.literal("")).default(""),
  error: z.string().trim().max(800).optional().or(z.literal("")).default("")
});

export const CustomerAssetKindSchema = z.enum([
  "logo",
  "brand-guide",
  "product-photo",
  "service-photo",
  "raw-video",
  "testimonial-proof",
  "review-screenshot",
  "menu-pricing",
  "website-screenshot",
  "social-reference",
  "compliance-note",
  "other"
]);

export const CustomerAssetSourceSchema = z.enum(["upload", "url"]);
export const CustomerAssetStatusSchema = z.enum(["active", "archived", "needs-review"]);
export const CustomerAssetStorageProviderSchema = z.enum(["gcs", "local", "remote-url"]);
export const CustomerAssetUsageRightsSchema = z.enum([
  "owned-or-licensed",
  "public-reference-only",
  "needs-review"
]);

export const CustomerAssetSchema = z.object({
  id: z.string(),
  customerId: z.string().trim().min(6).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: CustomerAssetStatusSchema.default("active"),
  kind: CustomerAssetKindSchema,
  source: CustomerAssetSourceSchema,
  label: z.string().trim().min(2).max(140),
  notes: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  sourceUrl: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  originalFileName: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  mimeType: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  sizeBytes: z.number().int().min(0).max(500 * 1024 * 1024).default(0),
  width: z.number().int().min(0).max(20000).default(0),
  height: z.number().int().min(0).max(20000).default(0),
  durationSeconds: z.number().min(0).max(7200).default(0),
  storageProvider: CustomerAssetStorageProviderSchema.default("remote-url"),
  storageKey: z.string().trim().max(600).optional().or(z.literal("")).default(""),
  usageRights: CustomerAssetUsageRightsSchema.default("owned-or-licensed"),
  usageConsent: z.boolean().default(false),
  consentText: z.string().trim().max(500).optional().or(z.literal("")).default(""),
  qualityScore: z.number().int().min(0).max(100).default(0),
  qualityIssues: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  qualityRecommendations: z.array(z.string().trim().min(1).max(220)).max(12).default([]),
  readinessTags: z.array(z.string().trim().min(1).max(80)).max(20).default([])
});

export const CustomerAssetCreateSchema = z.object({
  customerId: z.string().trim().min(6).max(80),
  accessToken: z.string().trim().min(16).max(180),
  kind: CustomerAssetKindSchema.default("other"),
  label: z.string().trim().max(140).optional().or(z.literal("")).default(""),
  notes: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  sourceUrl: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  usageRights: CustomerAssetUsageRightsSchema.default("owned-or-licensed"),
  usageConsent: z.boolean().default(false)
});

export const CustomerPortalAccessSchema = z.object({
  customerId: z.string().trim().min(6).max(80),
  accessToken: z.string().trim().min(16).max(180)
});

export const CustomerOnboardingStatusSchema = z.enum([
  "not-started",
  "draft",
  "submitted",
  "first-pack-generated",
  "ready-for-production"
]);

export const CustomerOnboardingSchema = z.object({
  id: z.string(),
  customerId: z.string().trim().min(6).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().optional().or(z.literal("")).default(""),
  status: CustomerOnboardingStatusSchema.default("draft"),
  websiteSocial: z.string().trim().min(4).max(800),
  industry: z.string().trim().min(2).max(120),
  locations: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  offer: z.string().trim().min(20).max(1200),
  targetAudience: z.string().trim().min(20).max(1200),
  primaryGoal: z.string().trim().min(10).max(600),
  brandVoice: z.string().trim().min(5).max(360),
  proofPoints: z.string().trim().max(1400).optional().or(z.literal("")).default(""),
  assetLinks: z.string().trim().max(1400).optional().or(z.literal("")).default(""),
  currentContent: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  competitors: z.string().trim().max(800).optional().or(z.literal("")).default(""),
  constraints: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  platforms: z.array(PlatformSchema).min(1).max(6),
  postingCadence: z.enum(["3 posts/week", "5 posts/week", "Daily", "Launch sprint"]).default("3 posts/week"),
  brandKit: BrandKitSchema.default(defaultBrandKit),
  creativeSettings: CreativeSettingsSchema.default(defaultCreativeSettings),
  videoSettings: VideoSettingsSchema.default({
    durationSeconds: 15,
    qualityMode: "balanced",
    qualityInstructions: defaultVideoQualityInstructions
  }),
  approvalContact: z.string().trim().min(3).max(180),
  approvalChannels: z.array(z.enum(["Email", "WhatsApp", "SMS", "Slack"])).min(1).max(4).default(["Email"]),
  notificationContact: z.string().trim().max(180).optional().or(z.literal("")).default(""),
  postingTimezone: z.string().trim().max(80).default("Customer local time"),
  quietHours: z.string().trim().max(80).default("9:00 PM-8:00 AM local time"),
  budgetSensitivity: z.enum(["lowest-cost", "balanced", "maximum-impact"]).default("lowest-cost"),
  assetSource: z.enum(["customer-uploaded", "vidsloom-assisted", "stock-and-template-light"]).default("vidsloom-assisted"),
  publishingMode: z.enum(["approval-first", "auto-after-rules", "manual-only"]).default("approval-first"),
  approvalPolicy: z.enum(["approve-every-post", "auto-approve-low-risk", "auto-publish-after-24h"]).default("approve-every-post"),
  autoPostingIntent: z.boolean().default(false),
  connectedAccounts: AutomationSetupSchema.shape.connectedAccounts.default([]),
  consentToUseAssets: z.boolean(),
  understandsOauth: z.boolean(),
  consentToStart: z.boolean(),
  generatedCampaignIds: z.array(z.string().trim().min(1).max(80)).max(20).default([])
});

export const CustomerOnboardingUpdateSchema = CustomerOnboardingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  status: true,
  generatedCampaignIds: true
})
  .extend({
    accessToken: CustomerPortalAccessSchema.shape.accessToken
  })
  .refine((data) => data.consentToUseAssets, {
    message: "Consent to use submitted business assets is required.",
    path: ["consentToUseAssets"]
  })
  .refine((data) => data.understandsOauth, {
    message: "Social account OAuth acknowledgement is required.",
    path: ["understandsOauth"]
  })
  .refine((data) => data.consentToStart, {
    message: "Approval to start onboarding is required.",
    path: ["consentToStart"]
  });

export const CustomerCampaignGenerateSchema = CustomerPortalAccessSchema;

export const CustomerReviewStatusSchema = z.enum([
  "needs-review",
  "approved",
  "changes-requested",
  "regenerate",
  "ready-to-schedule",
  "scheduled",
  "blocked"
]);

export const CustomerCampaignOverallStatusSchema = z.enum([
  "needs-review",
  "changes-requested",
  "approved",
  "ready-to-schedule",
  "scheduled",
  "blocked"
]);

export const CustomerVideoReviewSchema = z.object({
  conceptTitle: z.string().trim().min(1).max(180),
  status: CustomerReviewStatusSchema.default("needs-review"),
  note: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  updatedAt: z.string()
});

const defaultPublishingPerformance = {
  livePostUrl: "",
  directPostUrl: "",
  directPostId: "",
  directPostStatus: "",
  directPostPrivacyStatus: "",
  directPostUploadStatus: "",
  directPostCapturedAt: "",
  directPostMetricsAt: "",
  directViews: 0,
  directLikes: 0,
  directComments: 0,
  directShares: 0,
  directSaves: 0,
  directClicks: 0,
  directNotes: "",
  screenshotLinks: "",
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  clicks: 0,
  directMessages: 0,
  bookings: 0,
  salesValue: 0,
  currency: "sgd",
  notes: "",
  capturedAt: "",
  followUp24hJobId: "",
  followUp48hJobId: "",
  followUp24hSentAt: "",
  followUp48hSentAt: ""
};

export const CustomerPublishingPerformanceSchema = z.object({
  livePostUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  directPostUrl: z.string().trim().max(1000).optional().or(z.literal("")).default(""),
  directPostId: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  directPostStatus: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  directPostPrivacyStatus: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  directPostUploadStatus: z.string().trim().max(80).optional().or(z.literal("")).default(""),
  directPostCapturedAt: z.string().optional().or(z.literal("")).default(""),
  directPostMetricsAt: z.string().optional().or(z.literal("")).default(""),
  directViews: z.number().int().min(0).max(999_999_999).default(0),
  directLikes: z.number().int().min(0).max(999_999_999).default(0),
  directComments: z.number().int().min(0).max(999_999_999).default(0),
  directShares: z.number().int().min(0).max(999_999_999).default(0),
  directSaves: z.number().int().min(0).max(999_999_999).default(0),
  directClicks: z.number().int().min(0).max(999_999_999).default(0),
  directNotes: z.string().trim().max(1800).optional().or(z.literal("")).default(""),
  screenshotLinks: z.string().trim().max(1400).optional().or(z.literal("")).default(""),
  views: z.number().int().min(0).max(999_999_999).default(0),
  likes: z.number().int().min(0).max(999_999_999).default(0),
  comments: z.number().int().min(0).max(999_999_999).default(0),
  shares: z.number().int().min(0).max(999_999_999).default(0),
  saves: z.number().int().min(0).max(999_999_999).default(0),
  clicks: z.number().int().min(0).max(999_999_999).default(0),
  directMessages: z.number().int().min(0).max(999_999_999).default(0),
  bookings: z.number().int().min(0).max(999_999_999).default(0),
  salesValue: z.number().min(0).max(999_999_999).default(0),
  currency: z.string().trim().length(3).default("sgd"),
  notes: z.string().trim().max(1800).optional().or(z.literal("")).default(""),
  capturedAt: z.string().optional().or(z.literal("")).default(""),
  followUp24hJobId: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  followUp48hJobId: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  followUp24hSentAt: z.string().optional().or(z.literal("")).default(""),
  followUp48hSentAt: z.string().optional().or(z.literal("")).default("")
});

export const CustomerPublishingReviewSchema = z.object({
  taskKey: z.string().trim().min(1).max(280),
  conceptTitle: z.string().trim().min(1).max(180),
  platform: PlatformSchema,
  day: z.string().trim().min(1).max(80),
  status: CustomerReviewStatusSchema.default("needs-review"),
  note: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  scheduledFor: z.string().optional().or(z.literal("")).default(""),
  autoPublishApproved: z.boolean().default(false),
  publishingJobId: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  publishingJobQueuedAt: z.string().optional().or(z.literal("")).default(""),
  publishingError: z.string().trim().max(1200).optional().or(z.literal("")).default(""),
  performance: CustomerPublishingPerformanceSchema.default(defaultPublishingPerformance),
  updatedAt: z.string()
});

export const CustomerCampaignReviewSchema = z.object({
  id: z.string(),
  customerId: z.string().trim().min(6).max(80),
  campaignId: z.string().trim().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  overallStatus: CustomerCampaignOverallStatusSchema.default("needs-review"),
  videoReviews: z.array(CustomerVideoReviewSchema).max(30).default([]),
  publishingReviews: z.array(CustomerPublishingReviewSchema).max(60).default([]),
  customerNotes: z.string().trim().max(2000).optional().or(z.literal("")).default(""),
  proofNotes: z.string().trim().max(3000).optional().or(z.literal("")).default(""),
  proofPermission: z.boolean().default(false)
});

export const CustomerCampaignReviewUpdateSchema = CustomerCampaignReviewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  overallStatus: true
}).extend({
  accessToken: CustomerPortalAccessSchema.shape.accessToken
});

export const NewsletterSubscriberSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  email: z.string().trim().email().max(180),
  name: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  businessName: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  status: z.enum(["active", "unsubscribed", "bounced", "complained"]).default("active"),
  source: z
    .enum(["newsletter-page", "lead-form", "growth-audit", "pilot", "sample-app", "manual-import"])
    .default("newsletter-page"),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default(["VIDSLOOM"]),
  consentText: z.string().trim().max(500),
  consentAt: z.string(),
  unsubscribeToken: z.string().min(12),
  unsubscribedAt: z.string().optional()
});

export const NewsletterAudienceRuleSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  sources: z.array(NewsletterSubscriberSchema.shape.source).max(10).default([]),
  statuses: z.array(NewsletterSubscriberSchema.shape.status).max(4).default(["active"])
});

export const NewsletterSegmentSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(220),
  rule: NewsletterAudienceRuleSchema,
  count: z.number().int().min(0).default(0)
});

export const NewsletterBroadcastSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subject: z.string().trim().min(6).max(140),
  body: z.string().trim().min(20).max(6000),
  status: z.enum(["draft", "test", "sending", "sent", "partial", "failed"]).default("draft"),
  audience: NewsletterAudienceRuleSchema.default({
    tags: [],
    sources: [],
    statuses: ["active"]
  }),
  stats: z
    .object({
      attempted: z.number().int().min(0).default(0),
      sent: z.number().int().min(0).default(0),
      skipped: z.number().int().min(0).default(0),
      failed: z.number().int().min(0).default(0)
    })
    .default({
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    }),
  sentAt: z.string().optional(),
  testEmail: z.string().trim().email().optional().or(z.literal(""))
});

export const NewsletterEmailEventSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  email: z.string().trim().email().max(180),
  recipientName: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  subject: z.string().trim().min(1).max(180),
  messageType: z.enum(["transactional", "newsletter-broadcast", "newsletter-sequence", "internal-notification"]),
  status: z.enum(["sent", "skipped", "failed"]),
  provider: z.enum(["sendgrid", "internal"]).default("sendgrid"),
  providerStatus: z.number().int().optional(),
  providerJobId: z.string().optional(),
  reason: z.string().trim().max(800).optional(),
  subscriberId: z.string().optional(),
  leadId: z.string().optional(),
  broadcastId: z.string().optional(),
  sequenceId: z.string().optional(),
  sequenceStepId: z.string().optional(),
  category: z.string().trim().max(80).default("vidsloom-email"),
  metadata: z.record(z.string(), z.string()).default({})
});

export const NewsletterSequenceStepSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  delayHours: z.number().min(0).max(24 * 30),
  subject: z.string().trim().min(6).max(140),
  body: z.string().trim().min(20).max(6000),
  messageType: z.enum(["marketing", "transactional"]).default("marketing")
});

export const NewsletterSequenceSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240),
  trigger: z.enum(["newsletter-subscribed", "lead-created", "pilot-requested", "manual"]),
  status: z.enum(["active", "paused"]).default("active"),
  audience: z.enum(["marketing-opt-in", "contact-consent"]).default("marketing-opt-in"),
  steps: z.array(NewsletterSequenceStepSchema).min(1).max(8)
});

export const NewsletterEnrollmentSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  email: z.string().trim().email().max(180),
  subscriberId: z.string().optional(),
  leadId: z.string().optional(),
  sequenceId: z.string(),
  status: z.enum(["active", "completed", "paused", "cancelled"]).default("active"),
  currentStepIndex: z.number().int().min(0).default(0),
  nextSendAt: z.string(),
  lastSentAt: z.string().optional(),
  completedAt: z.string().optional(),
  metadata: z.record(z.string(), z.string()).default({})
});

export const NewsletterSubscribeSchema = z
  .object({
    email: z.string().trim().email().max(180),
    name: z.string().trim().max(120).optional().or(z.literal("")).default(""),
    businessName: z.string().trim().max(120).optional().or(z.literal("")).default(""),
    source: NewsletterSubscriberSchema.shape.source.default("newsletter-page"),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default(["VIDSLOOM"]),
    consentToEmail: z.boolean()
  })
  .refine((data) => data.consentToEmail, {
    message: "Consent to receive email is required.",
    path: ["consentToEmail"]
  });

export const OpsAlertSuppressionSchema = z.object({
  id: z.string(),
  alertId: z.string().trim().min(3).max(240),
  createdAt: z.string(),
  updatedAt: z.string(),
  acknowledgedAt: z.string(),
  acknowledgedBy: z.string().trim().min(1).max(120).default("qa"),
  note: z.string().trim().max(600).optional().or(z.literal("")).default(""),
  suppressUntil: z.string(),
  resolvedAt: z.string().optional().or(z.literal("")).default("")
});

export type CampaignIntake = z.infer<typeof CampaignIntakeSchema>;
export type AutomationSetup = z.infer<typeof AutomationSetupSchema>;
export type VideoDurationSeconds = z.infer<typeof VideoDurationSecondsSchema>;
export type VideoQualityMode = z.infer<typeof VideoQualityModeSchema>;
export type VideoSettings = z.infer<typeof VideoSettingsSchema>;
export type BrandKit = z.infer<typeof BrandKitSchema>;
export type CreativeSettings = z.infer<typeof CreativeSettingsSchema>;
export type TrendIntelligence = z.infer<typeof TrendIntelligenceSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type ProofClaimType = z.infer<typeof ProofClaimTypeSchema>;
export type ProofItem = z.infer<typeof ProofItemSchema>;
export type CampaignProofGraph = z.infer<typeof CampaignProofGraphSchema>;
export type ClaimReview = z.infer<typeof ClaimReviewSchema>;
export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;
export type QualityGateCheck = z.infer<typeof QualityGateCheckSchema>;
export type ConceptQualityGate = z.infer<typeof ConceptQualityGateSchema>;
export type GenerationRouting = z.infer<typeof GenerationRoutingSchema>;
export type VideoConcept = z.infer<typeof VideoConceptSchema>;
export type GeneratedVideoAsset = z.infer<typeof GeneratedVideoAssetSchema>;
export type MediaGenerationAssetRecord = z.infer<typeof MediaGenerationAssetRecordSchema>;
export type MediaGenerationRun = z.infer<typeof MediaGenerationRunSchema>;
export type CampaignPack = z.infer<typeof CampaignPackSchema>;
export type PublishingTask = z.infer<typeof PublishingTaskSchema>;
export type PublishingMethod = z.infer<typeof PublishingMethodSchema>;
export type PublishingAttemptStatus = z.infer<typeof PublishingAttemptStatusSchema>;
export type SocialConnection = z.infer<typeof SocialConnectionSchema>;
export type PublishingAttempt = z.infer<typeof PublishingAttemptSchema>;
export type PublishingActionRequest = z.infer<typeof PublishingActionRequestSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Lead = z.infer<typeof LeadSchema>;
export type LeadCreate = z.infer<typeof LeadCreateSchema>;
export type LeadSalesUpdate = z.infer<typeof LeadSalesUpdateSchema>;
export type BillingPlan = z.infer<typeof BillingPlanSchema>;
export type CheckoutPlan = z.infer<typeof CheckoutPlanSchema>;
export type BillingCustomer = z.infer<typeof BillingCustomerSchema>;
export type CheckoutCreate = z.infer<typeof CheckoutCreateSchema>;
export type StripeEvent = z.infer<typeof StripeEventSchema>;
export type CustomerAssetKind = z.infer<typeof CustomerAssetKindSchema>;
export type CustomerAssetSource = z.infer<typeof CustomerAssetSourceSchema>;
export type CustomerAssetStatus = z.infer<typeof CustomerAssetStatusSchema>;
export type CustomerAssetStorageProvider = z.infer<typeof CustomerAssetStorageProviderSchema>;
export type CustomerAssetUsageRights = z.infer<typeof CustomerAssetUsageRightsSchema>;
export type CustomerAsset = z.infer<typeof CustomerAssetSchema>;
export type CustomerAssetCreate = z.infer<typeof CustomerAssetCreateSchema>;
export type CustomerPortalAccess = z.infer<typeof CustomerPortalAccessSchema>;
export type CustomerOnboarding = z.infer<typeof CustomerOnboardingSchema>;
export type CustomerOnboardingUpdate = z.infer<typeof CustomerOnboardingUpdateSchema>;
export type CustomerReviewStatus = z.infer<typeof CustomerReviewStatusSchema>;
export type CustomerPublishingPerformance = z.infer<typeof CustomerPublishingPerformanceSchema>;
export type CustomerCampaignReview = z.infer<typeof CustomerCampaignReviewSchema>;
export type CustomerCampaignReviewUpdate = z.infer<typeof CustomerCampaignReviewUpdateSchema>;
export type NewsletterSubscriber = z.infer<typeof NewsletterSubscriberSchema>;
export type NewsletterSubscribe = z.infer<typeof NewsletterSubscribeSchema>;
export type NewsletterAudienceRule = z.infer<typeof NewsletterAudienceRuleSchema>;
export type NewsletterSegment = z.infer<typeof NewsletterSegmentSchema>;
export type NewsletterBroadcast = z.infer<typeof NewsletterBroadcastSchema>;
export type NewsletterEmailEvent = z.infer<typeof NewsletterEmailEventSchema>;
export type NewsletterSequence = z.infer<typeof NewsletterSequenceSchema>;
export type NewsletterSequenceStep = z.infer<typeof NewsletterSequenceStepSchema>;
export type NewsletterEnrollment = z.infer<typeof NewsletterEnrollmentSchema>;
export type OpsAlertSuppression = z.infer<typeof OpsAlertSuppressionSchema>;
