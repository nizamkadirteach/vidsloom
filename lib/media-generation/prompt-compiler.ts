import type { Campaign, CampaignIntake, CustomerAsset, VideoConcept } from "@/lib/schemas";
import { createId } from "@/lib/id";
import { analyzeCustomerAssets, selectAssetsForShot } from "@/lib/media-generation/asset-intelligence";
import { segmentVideoDuration } from "@/lib/media-generation/duration";
import {
  fakeProofConstraints,
  MEDIA_PROMPT_VERSION,
  mediaPromptTemplates,
  universalNegativeConstraints
} from "@/lib/media-generation/prompt-library";
import {
  CompiledPromptPacketSchema,
  MediaShotPlanSchema,
  ProductionBriefSchema,
  type AssetAnalysis,
  type CompiledPromptPacket,
  type MediaShotPlan,
  type ProductionBrief
} from "@/lib/media-generation/schemas";

export function buildProductionBrief({
  campaign,
  customerAssets = []
}: {
  campaign: Pick<Campaign, "id" | "customerId" | "intake" | "pack">;
  customerAssets?: CustomerAsset[];
}): ProductionBrief {
  const intake = campaign.intake;
  const proofItems = campaign.pack.proofGraph.items
    .filter((item) => item.status === "verified-from-customer" || item.status === "needs-customer-confirmation")
    .map((item) => item.summary);
  const brandColors = [intake.brandKit.primaryColor, intake.brandKit.secondaryColor].filter(Boolean);

  return ProductionBriefSchema.parse({
    campaignId: campaign.id,
    customerId: campaign.customerId ?? "",
    businessName: intake.businessName,
    industry: intake.industry,
    offer: intake.offer,
    audience: intake.audience,
    goal: intake.goal,
    brandVoice: intake.brandVoice,
    brandColors,
    platforms: intake.platforms,
    durationSeconds: intake.videoSettings.durationSeconds,
    qualityMode: intake.videoSettings.qualityMode,
    approvedProof: proofItems,
    prohibitedClaims: [
      ...campaign.pack.proofGraph.blockedClaims,
      ...customerAssets
        .filter((asset) => asset.kind === "compliance-note")
        .map((asset) => asset.notes || asset.label)
        .filter(Boolean)
    ],
    complianceNotes: splitNotes([intake.constraints ?? "", intake.brandKit.brandDont ?? ""]),
    referenceAssetIds: customerAssets.filter((asset) => asset.status === "active").map((asset) => asset.id),
    overlayPolicy: "post-production-only"
  });
}

export function buildShotPlans({
  campaign,
  concept,
  customerAssets = [],
  assetAnalyses = analyzeCustomerAssets(customerAssets)
}: {
  campaign: Pick<Campaign, "id" | "intake" | "pack">;
  concept: VideoConcept;
  customerAssets?: CustomerAsset[];
  assetAnalyses?: AssetAnalysis[];
}): MediaShotPlan[] {
  const segments = segmentVideoDuration(campaign.intake.videoSettings.durationSeconds);
  const storyboard = concept.storyboard.length ? concept.storyboard : [];
  const plainShotList = concept.shotList.length ? concept.shotList : [concept.hook, concept.script, concept.cta];

  return segments.map((segment, index) => {
    const source = storyboard[index];
    const text = source?.onScreenText || plainShotList[index % plainShotList.length] || concept.hook;
    const role = source?.purpose ?? segment.role;
    const sourceType = inferSourceType(role, source?.visualSource, campaign.intake);
    const creativeFormula = trendFormulaFor({ campaign, concept, role });
    const subject = inferSubject({ concept, intake: campaign.intake, text, role });
    const action = inferAction({ concept, text, role });
    const draft = MediaShotPlanSchema.parse({
      id: `${campaign.id}_${slug(concept.title)}_shot_${String(segment.shotNumber).padStart(2, "0")}`,
      campaignId: campaign.id,
      conceptTitle: concept.title,
      platform: concept.platform,
      shotNumber: segment.shotNumber,
      startSecond: segment.startSecond,
      endSecond: segment.endSecond,
      durationSeconds: Math.max(1, segment.endSecond - segment.startSecond),
      role,
      creativeFormula,
      visualGoal: visualGoalFor({ concept, text, role }),
      cameraLanguage: cameraLanguageForRole(role),
      motionGoal: motionGoalForRole(role),
      sourceType,
      costTier: costTierFor({ role, intake: campaign.intake, sourceType }),
      requiredProofIds: proofIdsForRole(campaign, role),
      referenceAssetIds: [],
      subject,
      action,
      setting: settingFor(campaign.intake),
      camera: cameraForRole(role),
      lighting: lightingFor(campaign.intake),
      pace: segment.shotNumber === 1 ? "immediate movement within the first 0.5 seconds" : "fast social-native pacing",
      emotion: emotionFor(campaign.intake),
      overlayText: sanitizeOverlayText(text),
      voiceoverLine: source?.voiceover || voiceoverForRole({ concept, role, text }),
      overlaySafeZoneRequired: true,
      expectedCleanOverlayZones: expectedCleanOverlayZonesFor(role),
      safeZoneNotes: safeZoneNotesFor(concept.platform),
      complianceNotes: splitNotes([campaign.intake.constraints ?? "", ...concept.approvalRisks]),
      fallbackRoute: fallbackRouteFor(sourceType, role)
    });
    return {
      ...draft,
      referenceAssetIds: selectAssetsForShot({ shot: draft, assets: customerAssets, analyses: assetAnalyses })
    };
  });
}

export function compilePromptPackets({
  brief,
  shotPlans
}: {
  brief: ProductionBrief;
  shotPlans: MediaShotPlan[];
}): CompiledPromptPacket[] {
  return shotPlans.map((shot, index) => {
    const invariantBlock = {
      businessName: brief.businessName,
      industry: brief.industry,
      offer: brief.offer,
      audience: brief.audience,
      brandVoice: brief.brandVoice,
      approvedProof: brief.approvedProof,
      prohibitedClaims: brief.prohibitedClaims,
      complianceNotes: [...brief.complianceNotes, ...shot.complianceNotes],
      referenceAssetIds: [...new Set([...brief.referenceAssetIds, ...shot.referenceAssetIds])].slice(0, 12),
      platform: shot.platform,
      aspectRatio: "9:16" as const,
      overlayPolicy: "post-production-only" as const
    };
    const shotBlock = {
      shotPurpose: shot.role,
      subject: shot.subject,
      action: shot.action,
      scene: shot.setting,
      productServiceSpecifics: `${brief.industry}: ${brief.offer}`,
      camera: shot.cameraLanguage || shot.camera,
      lighting: shot.lighting,
      pace: shot.pace,
      emotion: shot.emotion,
      mustShow: mustShowFor(brief, shot),
      avoid: avoidFor(brief, shot),
      durationSeconds: Math.min(8, Math.max(2, shot.durationSeconds)),
      continuity: continuityFor(shot, index, shotPlans.length)
    };
    const categoryDirection = categoryVisualDirection({ brief, shot });
    const qualityProfile = qualityProfileFor({ brief, shot, clipDurationSeconds: clipDurationSeconds(shotBlock.durationSeconds) });
    const postProductionPlan = postProductionPlanFor({ brief, shot });
    const videoMarketingBrief = isVideoMarketingContext(`${brief.businessName} ${brief.industry} ${brief.offer}`);
    const inSceneTextConstraint = videoMarketingBrief
      ? "Hard constraints: no readable in-scene text, no words, no letters, no captions, no signs, no labels, no logo, no logo-like marks, no watermark, no fake readable reviews, no fake proof, no prices. Abstract non-readable workflow panels, video thumbnails, calendars, and approval screens are allowed only as blurred or symbolic interface shapes."
      : "Hard constraints: no readable text, no words, no letters, no captions, no signs, no labels, no logo, no logo-like marks, no watermark, no fake UI, no fake reviews, no fake proof, no prices, no dashboards, no before/after claims.";
    const workspaceConstraint = videoMarketingBrief
      ? "Avoid generic office desks as the main subject, restaurant kitchens, chefs, dental/clinic rooms, ecommerce packing tables, readable dashboard UI, provider logos, and exact product names. Show the video-marketing workflow itself: phone review, vertical clips, approval queue, scheduling calendar, creator handoff, or campaign storyboard."
      : "Avoid office desks, keyboards, paperwork, generic laptops, generic meeting rooms, abstract SaaS screens, and delivery-bag closeups unless the business is specifically an office, software, or delivery service.";
    const positivePrompt = truncatePrompt([
      "Generate one premium short-form business video clip only. This is a motion ingredient, not the final ad.",
      videoMarketingBrief
        ? "The output must look like premium commercial b-roll for an AI video marketing company workflow, not a restaurant, clinic, ecommerce pack table, generic office, stock ad, or placeholder scene."
        : "The output must look like premium commercial b-roll for a real small business, not a generic office, stock-ad, SaaS dashboard, or placeholder scene.",
      `Business context only, not visual text: ${brief.businessName}`,
      `Industry context: ${brief.industry}`,
      `Offer context for meaning only: ${brief.offer}`,
      `Audience context: ${brief.audience}`,
      `Category-specific visual direction: ${categoryDirection.mustShow}`,
      `Category-specific exclusions: ${categoryDirection.avoid}`,
      `Creative formula: ${shot.creativeFormula || "strong hook, clear motion, proof-safe CTA support"}`,
      `Platform: ${shot.platform}`,
      "Aspect ratio: 9:16 vertical mobile video, full-frame portrait composition.",
      `Duration: ${qualityProfile.clipDurationSeconds}s`,
      `Shot role: ${shotBlock.shotPurpose}`,
      `Scene goal: ${shot.visualGoal || shotBlock.shotPurpose}`,
      `Primary subject: ${shotBlock.subject}`,
      `Action and physics: ${shotBlock.action}`,
      `Environment: ${shotBlock.scene}`,
      `Camera setup: ${shotBlock.camera}`,
      `Motion goal: ${shot.motionGoal}`,
      `Lighting: ${shotBlock.lighting}`,
      `Pacing: ${shotBlock.pace}`,
      `Mood: ${shotBlock.emotion}`,
      `Continuity: ${shotBlock.continuity}`,
      `Must show: ${shotBlock.mustShow.join("; ")}`,
      "Make the first frame immediately understandable and visually premium. The viewer should know what kind of business this is without reading any overlay text.",
      inSceneTextConstraint,
      workspaceConstraint,
      "Leave clean upper-middle, center, and lower-third safe areas for deterministic overlays.",
      "Final assembly will add exact captions, proof, prices, logos, subtitles, CTA cards, thumbnails, audio mix, and platform-safe exports. Focus only on realistic cinematic motion and premium visual quality."
    ].join("\n"));

    return CompiledPromptPacketSchema.parse({
      id: createId("prompt"),
      campaignId: brief.campaignId,
      conceptTitle: shot.conceptTitle,
      shotId: shot.id,
      promptVersion: MEDIA_PROMPT_VERSION,
      templateIds: templateIdsFor(shot),
      invariantBlock,
      shotBlock,
      qualityProfile,
      postProductionPlan,
      positivePrompt,
      providerNativeNegative: [...universalNegativeConstraints, ...(shot.role === "proof" ? fakeProofConstraints : [])]
        .slice(0, 20)
        .join(", "),
      qaConstraints: [
        "first-frame impact is clear under 1 second",
        "first 3 seconds have visible motion and no dead air",
        "offer context is supported without generating exact proof or text",
        "mobile overlays remain readable in safe zones",
        "business visuals feel specific rather than generic",
        "no readable in-scene text, logo-like marks, fake UI, fake proof, or malformed hands"
      ],
      safetyConstraints: [
        "do not invent testimonials, reviews, star ratings, results, awards, customers, or revenue",
        "do not generate readable logo, price, proof, or CTA text in the video model",
        "do not imply regulated outcomes without approved proof"
      ],
      costTier: shot.costTier,
      publicSummary: `Shot ${shot.shotNumber}: ${shot.role} using ${shot.sourceType.replace(/-/g, " ")}.`
    });
  });
}

function clipDurationSeconds(input: number) {
  if (input <= 4) return 4 as const;
  if (input <= 6) return 6 as const;
  return 8 as const;
}

function qualityProfileFor({
  brief,
  shot,
  clipDurationSeconds
}: {
  brief: ProductionBrief;
  shot: MediaShotPlan;
  clipDurationSeconds: 4 | 6 | 8;
}) {
  const generationLane =
    shot.costTier === "premium" ? "premium-hero" : shot.costTier === "preview" ? "low-cost-preview" : "balanced-production";
  return {
    targetDurationSeconds: brief.durationSeconds,
    clipDurationSeconds,
    resolution: shot.costTier === "premium" && clipDurationSeconds === 8 ? ("1080p" as const) : ("720p" as const),
    generationLane,
    finalAssemblyRequired: true,
    maxRegenerationAttempts: 3,
    bestPracticeNotes: [
      "Use multiple short clips for final 10-60s videos rather than one monolithic generation.",
      "Keep all exact text, proof, logos, captions, prices, and CTAs for deterministic assembly.",
      "Prefer customer-owned assets or reference frames when product or environment consistency matters.",
      "Regenerate at most three times, then fall back to still-motion or programmatic proof cards."
    ]
  };
}

function postProductionPlanFor({ brief, shot }: { brief: ProductionBrief; shot: MediaShotPlan }) {
  const exactOverlays = [
    shot.overlayText ? `Overlay copy: ${shot.overlayText}` : "",
    shot.voiceoverLine ? `Subtitle/voiceover line: ${shot.voiceoverLine}` : "",
    shot.requiredProofIds.length ? `Approved proof ids: ${shot.requiredProofIds.join(", ")}` : "",
    `Offer CTA context: ${brief.offer}`,
    "Customer logo only if supplied and approved"
  ]
    .filter(Boolean)
    .map((item) => truncate(item, 210));

  return {
    exactOverlays: exactOverlays.slice(0, 16),
    safeZone:
      "Use central safe area: avoid top progress/profile area, bottom caption/CTA UI, and right-side engagement controls.",
    subtitleStyle: "Bold, high-contrast, 1-2 short lines at a time, with first-hook words readable immediately.",
    proofPolicy: "Only customer-approved proof appears in deterministic overlays; the generated clip must not invent proof.",
    ctaPolicy: shot.role === "cta" ? "Hold one clear CTA end card in the final safe zone." : "Support one final CTA without competing messages.",
    logoPolicy: "Composite customer logo in post-production; never generate it inside footage."
  };
}

function inferSourceType(
  role: MediaShotPlan["role"],
  visualSource: "customer-asset" | "generated-support" | "text-overlay" | "reference-only" | "needs-asset" | undefined,
  intake: CampaignIntake
): MediaShotPlan["sourceType"] {
  if (role === "proof") return "proof-overlay";
  if (visualSource === "customer-asset") return "hybrid";
  if (visualSource === "text-overlay") {
    return intake.automationSetup.assetSource === "customer-uploaded" ? "programmatic-card" : "generated-support";
  }
  if (visualSource === "needs-asset") return intake.automationSetup.assetSource === "customer-uploaded" ? "needs-customer-asset" : "generated-support";
  if (role === "cta") return "programmatic-card";
  return "hybrid";
}

function trendFormulaFor({
  campaign,
  concept,
  role
}: {
  campaign: Pick<Campaign, "pack">;
  concept: VideoConcept;
  role: MediaShotPlan["role"];
}) {
  const platformSignal =
    campaign.pack.trendIntelligence.signals.find((signal) => signal.platform === concept.platform) ??
    campaign.pack.trendIntelligence.signals[0];
  const angle = campaign.pack.trendAngles[0];
  const formula =
    platformSignal?.formulaSummary ||
    platformSignal?.remixFormula ||
    angle?.executionNote ||
    "stop-scroll hook, one concrete business visual, claim-safe proof support, one clear CTA";

  if (role === "hook") return truncate(`${formula} Focus this shot on the pattern interrupt and first-three-second curiosity gap.`, 250);
  if (role === "proof") return truncate(`${formula} Use the scene only as support; exact proof is deterministic overlay.`, 250);
  if (role === "cta") return truncate(`${formula} Resolve into one frictionless action.`, 250);
  return truncate(formula, 250);
}

function visualGoalFor({ concept, text, role }: { concept: VideoConcept; text: string; role: MediaShotPlan["role"] }) {
  if (role === "hook") return `make the viewer understand the problem or payoff immediately: ${truncate(concept.hook, 130)}`;
  if (role === "problem") return `make the pain or missed opportunity visually obvious: ${truncate(text, 130)}`;
  if (role === "offer") return `make the product or service category concrete without rendering exact text: ${truncate(text, 130)}`;
  if (role === "proof") return "create a credible, uncluttered proof-supporting background with clean overlay space";
  if (role === "demo") return `show one practical action, product use, or service process beat: ${truncate(text, 130)}`;
  if (role === "cta") return "settle into a clean final frame that supports the CTA overlay";
  return `keep the timeline moving while preserving visual continuity: ${truncate(text, 130)}`;
}

function cameraLanguageForRole(role: MediaShotPlan["role"]) {
  if (role === "hook") return "tight close-up or medium close-up, immediate push-in, snap pan, or satisfying macro movement";
  if (role === "problem") return "handheld or fast lateral movement showing friction, clutter, delay, or customer pain";
  if (role === "offer") return "clean medium shot with one primary subject and enough negative space for offer overlay";
  if (role === "proof") return "stable vertical frame with shallow motion and central negative space for approved proof overlay";
  if (role === "demo") return "single continuous action, close enough to understand the product or service process";
  if (role === "cta") return "stable end-frame composition with simple background and clean lower-third space";
  return "brief smooth transition shot with consistent palette and mobile-first framing";
}

function motionGoalForRole(role: MediaShotPlan["role"]) {
  if (role === "hook") return "visible motion in the first half-second; no static opening";
  if (role === "problem") return "show friction resolving or escalating through one clear movement";
  if (role === "offer") return "make the offer feel tangible through handling, setup, reveal, or service process motion";
  if (role === "proof") return "keep motion subtle so deterministic proof overlays remain readable";
  if (role === "demo") return "show one concrete product-use or service-delivery action from start to finish";
  if (role === "cta") return "slow down into a readable final beat";
  return "maintain visual rhythm without introducing new claims or props";
}

function expectedCleanOverlayZonesFor(role: MediaShotPlan["role"]) {
  if (role === "cta") return ["center", "lower-third"] as const;
  if (role === "proof") return ["upper-middle", "center", "lower-third"] as const;
  if (role === "hook") return ["upper-middle", "center"] as const;
  return ["upper-middle", "center", "lower-third"] as const;
}

function costTierFor({
  role,
  intake,
  sourceType
}: {
  role: MediaShotPlan["role"];
  intake: CampaignIntake;
  sourceType: MediaShotPlan["sourceType"];
}): MediaShotPlan["costTier"] {
  if (sourceType === "programmatic-card" || sourceType === "proof-overlay") return "preview";
  if (intake.videoSettings.qualityMode === "highest-quality" && (role === "hook" || role === "demo")) return "premium";
  if (intake.automationSetup.budgetSensitivity === "maximum-impact" && role === "hook") return "premium";
  return intake.videoSettings.qualityMode === "fast-preview" ? "preview" : "standard";
}

function proofIdsForRole(campaign: Pick<Campaign, "pack">, role: MediaShotPlan["role"]) {
  if (role !== "proof") return [];
  return campaign.pack.proofGraph.items
    .filter((item) => item.status !== "prohibited")
    .map((item) => item.id)
    .slice(0, 4);
}

function inferSubject({
  concept,
  intake,
  text,
  role
}: {
  concept: VideoConcept;
  intake: CampaignIntake;
  text: string;
  role: MediaShotPlan["role"];
}) {
  if (isVideoMarketingContext(`${intake.businessName} ${intake.industry} ${intake.offer}`)) {
    if (role === "hook") {
      return "busy business owner reviewing vertical video campaign previews on a phone, with clean non-readable approval cards and no restaurant, clinic, or ecommerce scene";
    }
    if (role === "problem") {
      return "overloaded owner moving from messy content tasks into a clean VIDSLOOM-style approval workflow, no readable UI text";
    }
    if (role === "proof") return "proof-safe video approval queue background with non-readable clip thumbnails and clean overlay space";
    if (role === "cta") return "clean video campaign approval screen or mobile review frame with brand-safe abstract background";
    return "AI video marketing workflow: vertical clip previews, caption cards, schedule blocks, and approval queue with all UI text unreadable";
  }

  if (/restaurant|cafe|food|dining|bar|bakery/i.test(intake.industry)) {
    if (role === "hook") {
      return `signature plated dish or hero food item from ${intake.businessName}, appetite-first and restaurant-specific`;
    }
    if (role === "demo" || role === "offer") {
      return `chef hands, service counter, fresh ingredients, plated food, or dining table moment for ${intake.businessName}`;
    }
  }
  if (role === "hook") return `real ${intake.businessName} product, service moment, founder, or customer-relevant visual`;
  if (role === "cta") return `${intake.businessName} offer card with brand-safe background`;
  if (role === "proof") return `approved customer proof asset connected to ${concept.title}`;
  return `${intake.industry} scene showing ${truncate(text || concept.objective, 120)}`;
}

function inferAction({ concept, text, role }: { concept: VideoConcept; text: string; role: MediaShotPlan["role"] }) {
  if (role === "hook") return `open with immediate motion that makes the viewer stop and understand ${truncate(concept.hook, 120)}`;
  if (role === "cta") return `hold a clear end frame for the action: ${truncate(concept.cta, 120)}`;
  if (role === "proof") return "animate the real proof overlay in post while the background supports credibility";
  return `show one concrete action beat that supports: ${truncate(text, 140)}`;
}

function settingFor(intake: CampaignIntake) {
  if (isVideoMarketingContext(`${intake.businessName} ${intake.industry} ${intake.offer}`)) {
    return "premium AI video marketing workspace: mobile video review, non-readable approval queue, campaign storyboard cards, scheduling calendar shapes, creator handoff, clean neon-accented production desk; no restaurant, clinic, ecommerce, or readable dashboard text";
  }
  if (/restaurant|cafe|food|dining|bar|bakery/i.test(intake.industry)) {
    return "premium real restaurant environment: warm dining room, open kitchen pass, chef plating station, service counter, or table-side dish reveal; no office desk, no keyboard, no paperwork, no generic delivery-bag scene";
  }
  if (/clinic|medical|dental|health/i.test(intake.industry)) return "clean professional clinic environment without dramatic or unsafe treatment implications";
  if (/ecommerce|shop|product|retail/i.test(intake.industry)) return "clean product-use setting with strong product visibility";
  if (/service|home|repair|local/i.test(intake.industry)) return "realistic service-work environment with tools, hands, process, and trust cues";
  return "business-specific vertical social video environment";
}

function cameraForRole(role: MediaShotPlan["role"]) {
  if (role === "hook") return "extreme close-up or medium close-up, fast push-in or snap pan, vertical mobile framing";
  if (role === "proof") return "stable frame with negative space for proof overlay and safe-zone-aware text";
  if (role === "cta") return "stable end-card composition with clear central focus";
  return "single camera setup, one primary action, clean vertical composition";
}

function categoryVisualDirection({ brief, shot }: { brief: ProductionBrief; shot: MediaShotPlan }) {
  const context = `${brief.industry} ${brief.offer} ${shot.subject} ${shot.action}`.toLowerCase();

  if (isVideoMarketingContext(context)) {
    return {
      mustShow:
        "premium AI video marketing workflow: owner reviewing vertical clips on phone, approval queue cards, non-readable campaign calendar blocks, caption/CTA workflow shapes, creator handoff, clean production polish, mobile-first social video context",
      avoid:
        "restaurant kitchens, chefs, food plating, dental or clinic treatment rooms, ecommerce packing tables, skincare product shelves, generic corporate meetings, readable UI text, fake metrics, provider logos, exact dashboards"
    };
  }

  if (/restaurant|cafe|food|dining|bar|bakery|lunch|dish|menu|bowl|meal|chef/.test(context)) {
    return {
      mustShow:
        "premium appetite-led food footage: plated dish texture, steam or sauce motion, chef hands plating, table-side reveal, restaurant pass, warm dining-room depth, fresh ingredients, real service energy",
      avoid:
        "office desks, keyboards, paperwork, generic laptops, plastic takeout containers as the main subject, brown paper bags as the main subject, sterile corporate pantry scenes, unreadable menu text"
    };
  }

  if (/clinic|medical|dental|health|wellness|spa|beauty/.test(context)) {
    return {
      mustShow:
        "clean premium service environment, professional tools, calm staff movement, reception or treatment-room context, process cues without medical outcome claims",
      avoid: "dramatic procedure shots, before-after claims, fake certificates, fake screens, unreadable forms, unsafe treatment implications"
    };
  }

  if (/ecommerce|shop|product|retail|unboxing|bundle|sku/.test(context)) {
    return {
      mustShow:
        "clear product handling, unboxing, use routine, packaging texture, shelf or fulfillment context, hand-scale demonstration, premium product lighting",
      avoid: "generic laptop shopping screens, fake checkout pages, unreadable labels, random products, distorted packaging, warehouse clutter"
    };
  }

  return {
    mustShow: "one concrete product, service, staff, environment, or customer-relevant process cue that makes the business category obvious",
    avoid: "generic office desks, fake dashboards, random abstract b-roll, unreadable text, stock-photo composition, unrelated props"
  };
}

function lightingFor(intake: CampaignIntake) {
  if (isVideoMarketingContext(`${intake.businessName} ${intake.industry} ${intake.offer}`)) return "crisp premium media-company lighting with cyan and magenta brand accents";
  if (/clinic|medical|dental|health/i.test(intake.industry)) return "bright, clean, trustworthy, professional lighting";
  if (/restaurant|food|cafe/i.test(intake.industry)) return "appetizing, warm, realistic lighting with texture and depth";
  if (/beauty|wellness|spa/i.test(intake.industry)) return "soft premium lighting, realistic skin and product texture";
  return "crisp high-contrast lighting that looks premium but believable";
}

function emotionFor(intake: CampaignIntake) {
  if (isVideoMarketingContext(`${intake.businessName} ${intake.industry} ${intake.offer}`)) return "sharp, modern, useful, hands-off, commercially credible";
  if (/clinic|medical|dental|health/i.test(intake.industry)) return "calm, credible, reassuring";
  if (/restaurant|food|cafe/i.test(intake.industry)) return "appetizing, immediate, energetic";
  if (/b2b|consult|agency|saas/i.test(intake.industry)) return "sharp, useful, commercially credible";
  return "confident, useful, action-oriented";
}

function voiceoverForRole({ concept, role, text }: { concept: VideoConcept; role: MediaShotPlan["role"]; text: string }) {
  if (role === "hook") return concept.hook;
  if (role === "cta") return concept.cta;
  return text;
}

function safeZoneNotesFor(platform: string) {
  const base = ["keep key text inside the central vertical safe zone", "avoid bottom caption/UI overlap"];
  if (platform === "TikTok") return [...base, "avoid right-side UI icon column"];
  if (platform === "Instagram Reels" || platform === "Facebook Reels") return [...base, "leave lower region clear for interface overlays"];
  if (platform === "LinkedIn") return [...base, "prioritize subtitle readability for sound-off viewing"];
  return base;
}

function fallbackRouteFor(sourceType: MediaShotPlan["sourceType"], role: MediaShotPlan["role"]): MediaShotPlan["fallbackRoute"] {
  if (sourceType === "needs-customer-asset") return "request-assets";
  if (sourceType === "programmatic-card" || role === "proof") return "programmatic-card";
  return "still-motion";
}

function templateIdsFor(shot: MediaShotPlan) {
  const ids = ["master-video-brief", "storyboard", "per-shot-video"];
  if (shot.sourceType === "generated-support" || shot.sourceType === "hybrid") ids.push("reference-image");
  if (/product|menu|food|pack|sku/i.test(`${shot.subject} ${shot.action}`)) ids.push("product-scene");
  if (/service|clinic|technician|appointment|process/i.test(`${shot.subject} ${shot.action}`)) ids.push("service-scene");
  if (shot.role === "cta") ids.push("thumbnail");
  ids.push("qa", "regeneration");
  return ids.filter((id) => mediaPromptTemplates.some((template) => template.id === id));
}

function mustShowFor(brief: ProductionBrief, shot: MediaShotPlan) {
  const items = [shot.subject, shot.action];
  if (shot.referenceAssetIds.length) items.push(`reference asset ids: ${shot.referenceAssetIds.join(", ")}`);
  if (shot.requiredProofIds.length) items.push(`approved proof ids: ${shot.requiredProofIds.join(", ")}`);
  if (brief.brandColors.length) items.push(`brand palette influence: ${brief.brandColors.join(", ")}`);
  return items.slice(0, 8);
}

function avoidFor(brief: ProductionBrief, shot: MediaShotPlan) {
  const avoids = [
    "readable generated text in the video model",
    "invented proof",
    "wrong logo or distorted branding",
    "generic stock-ad feel",
    ...brief.prohibitedClaims,
    ...shot.complianceNotes
  ];
  return avoids.filter(Boolean).slice(0, 12);
}

function continuityFor(shot: MediaShotPlan, index: number, total: number) {
  if (index === 0) return "first shot must begin with immediate motion and establish the customer/category quickly";
  if (index === total - 1) return "final shot must settle into a readable CTA frame";
  return `continue from shot ${shot.shotNumber - 1} with consistent palette, product/service identity, and pacing`;
}

function sanitizeOverlayText(input: string) {
  const text = input.replace(/\s+/g, " ").replace(/^[-*\d. ]+/, "").trim();
  if (looksPlannerOverlayText(text)) return "";
  return truncate(text, 160);
}

function isVideoMarketingContext(input: string) {
  return /\b(vidsloom|short-form video|short form video|video marketing|video growth|campaign packs?|approval queues?|approval-ready|posting support|caption cards?|cta cards?|posting schedules?|ai video marketing|video engine|content engine|marketing engine)\b/i.test(
    input
  );
}

function looksPlannerOverlayText(input: string) {
  return (
    /\bawareness\s*(?:&|and)\s*lead generation\b/i.test(input) ||
    /\b(?:TOFU|MOFU|BOFU)\b/.test(input) ||
    /\bfunnel stage\b/i.test(input) ||
    /\bstock footage\b/i.test(input) ||
    /\bmockup\b/i.test(input) ||
    /\btext overlay\b/i.test(input) ||
    /\bvisual\s*:/i.test(input) ||
    /\bvoiceover\s*:/i.test(input)
  );
}

function splitNotes(values: string[]) {
  return values
    .flatMap((value) => value.split(/\n|;/g))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function truncatePrompt(input: string) {
  const text = input
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.length <= 3900 ? text : `${text.slice(0, 3897).trim()}...`;
}

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
