import "server-only";

import { applyCampaignGuardrails } from "@/lib/campaign-guardrails";
import { createId } from "@/lib/id";
import { buildFallbackCampaignPack } from "@/lib/fallback-campaign";
import { generateCampaignPack, getGeminiModel, getPromptVersion } from "@/lib/gemini";
import { buildPublishingQueue } from "@/lib/publishing";
import { AgentRun, Campaign, CampaignIntake, CustomerAsset } from "@/lib/schemas";
import { getCampaign, listCustomerAssetsForCustomer, saveCampaign } from "@/lib/storage";
import { buildQueuedCampaignVideoAssets } from "@/lib/video-assets";

const AGENTS = [
  "OfferProfiler",
  "ZeitgeistScout",
  "TrendScout",
  "ScriptForge",
  "CreativeDirector",
  "PublisherAssist",
  "RevenueAnalyst"
] as const;

function createAgentRuns(params: {
  campaignId: string;
  intake: CampaignIntake;
  mode: "gemini" | "fallback";
  model: string;
  generationError?: string;
}) {
  const startedAt = new Date().toISOString();
  const completedAt = new Date().toISOString();
  return AGENTS.map<AgentRun>((agentName) => ({
    id: createId("run"),
    campaignId: params.campaignId,
    agentName,
    model: params.mode === "gemini" ? params.model : "deterministic-fallback",
    status: params.mode === "gemini" ? "completed" : "fallback",
    promptVersion: getPromptVersion(),
    startedAt,
    completedAt,
    inputSummary: `${params.intake.businessName} | ${params.intake.industry} | ${params.intake.platforms.join(", ")}`,
    outputSummary:
      params.mode === "gemini"
        ? [
            `${agentName} completed its campaign-planning responsibility.`,
            params.generationError ? `Recovery note: ${params.generationError}` : ""
          ]
            .filter(Boolean)
            .join(" ")
        : `${agentName} used deterministic fallback because ${params.generationError ?? "Gemini is not configured"}.`
  }));
}

export async function createCampaign(
  intake: CampaignIntake,
  metadata: { customerId?: string; source?: Campaign["source"]; customerAssets?: CustomerAsset[] } = {}
) {
  const id = createId("campaign");
  const generated = await generateCampaignPack(intake);
  const createdAt = new Date().toISOString();
  const basePack = {
    ...generated.pack,
    publishingQueue: buildPublishingQueue(intake, generated.pack)
  };
  const guardedPack = applyCampaignGuardrails({
    intake,
    pack: basePack,
    customerAssets: metadata.customerAssets ?? [],
    mode: generated.mode,
    fallbackReason: generated.error ?? ""
  });
  const pack = {
    ...guardedPack,
    videoAssets: buildQueuedCampaignVideoAssets({
      campaignId: id,
      intake,
      pack: guardedPack,
      createdAt
    })
  };
  const agentRuns = createAgentRuns({
    campaignId: id,
    intake,
    mode: generated.mode,
    model: generated.model || getGeminiModel(),
    generationError: generated.error
  });

  const campaign: Campaign = {
    id,
    createdAt,
    customerId: metadata.customerId ?? "",
    source: metadata.source ?? "workspace",
    mode: generated.mode,
    planningStatus: "pack-ready",
    planningQueuedAt: createdAt,
    planningStartedAt: createdAt,
    planningCompletedAt: createdAt,
    planningJobId: "",
    planningError: "",
    intake,
    pack,
    agentRuns,
    evidenceSummary: {
      revenueEvidenceNeeded: [
        "Confirm the primary conversion action: booking, enquiry, checkout, trial, or direct message.",
        "Set the first measurable success target before publishing.",
        "Decide whether the first week is organic-only or includes a small paid boost after early signals."
      ],
      customerEvidenceNeeded: [
        "Confirm customer-approved proof points, testimonials, reviews, or anonymized examples.",
        "Collect the best existing social links, product visuals, founder clips, and offer pages.",
        "Choose who approves content and which claims require extra review."
      ],
      productEvidenceGenerated: [
        "Validated customer intake.",
        "Campaign pack output.",
        "Queued customer-specific MP4 and poster rendering jobs from selected duration and quality settings.",
        "Publishing queue with captions, account requirements, approval checks, and scheduling guidance.",
        "AI planning steps for offer fit, trend fit, scripts, creative direction, publishing support, and KPI planning."
      ]
    }
  };

  await saveCampaign(campaign);
  return campaign;
}

export async function createCampaignDraft(
  intake: CampaignIntake,
  metadata: { customerId?: string; source?: Campaign["source"]; customerAssets?: CustomerAsset[] } = {}
) {
  const id = createId("campaign");
  const createdAt = new Date().toISOString();
  const fallbackPack = buildFallbackCampaignPack(intake);
  const basePack = {
    ...fallbackPack,
    publishingQueue: buildPublishingQueue(intake, fallbackPack),
    videoAssets: []
  };
  const pack = applyCampaignGuardrails({
    intake,
    pack: basePack,
    customerAssets: metadata.customerAssets ?? [],
    mode: "fallback",
    fallbackReason: "Campaign workspace created before async AI planning completes."
  });

  const campaign: Campaign = {
    id,
    createdAt,
    customerId: metadata.customerId ?? "",
    source: metadata.source ?? "workspace",
    mode: "fallback",
    planningStatus: "planning-queued",
    planningQueuedAt: createdAt,
    planningStartedAt: "",
    planningCompletedAt: "",
    planningJobId: "",
    planningError: "",
    intake,
    pack,
    agentRuns: [],
    evidenceSummary: {
      revenueEvidenceNeeded: [
        "Confirm the primary conversion action: booking, enquiry, checkout, trial, or direct message.",
        "Set the first measurable success target before publishing.",
        "Decide whether the first week is organic-only or includes a small paid boost after early signals."
      ],
      customerEvidenceNeeded: [
        "Confirm customer-approved proof points, testimonials, reviews, or anonymized examples.",
        "Collect the best existing social links, product visuals, founder clips, and offer pages.",
        "Choose who approves content and which claims require extra review."
      ],
      productEvidenceGenerated: [
        "Validated customer intake.",
        "Created a campaign workspace immediately.",
        "Queued AI planning for trend intelligence, scripts, captions, schedule, and approval checks.",
        "Video rendering will queue automatically after planning completes."
      ]
    }
  };

  await saveCampaign(campaign);
  return campaign;
}

export async function completeCampaignPlanning({ campaignId, force = false }: { campaignId: string; force?: boolean }) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return {
      ok: false,
      status: "not-found" as const
    };
  }

  if (!force && campaign.planningStatus === "pack-ready") {
    return {
      ok: true,
      status: "already-planned" as const,
      campaign
    };
  }

  const startedAt = new Date().toISOString();
  await saveCampaign({
    ...campaign,
    planningStatus: "planning",
    planningStartedAt: startedAt,
    planningError: ""
  });

  try {
    const generated = await generateCampaignPack(campaign.intake);
    const completedAt = new Date().toISOString();
    const customerAssets = campaign.customerId ? await listCustomerAssetsForCustomer(campaign.customerId, 200) : [];
    const basePack = {
      ...generated.pack,
      publishingQueue: buildPublishingQueue(campaign.intake, generated.pack)
    };
    const guardedPack = applyCampaignGuardrails({
      intake: campaign.intake,
      pack: basePack,
      customerAssets,
      mode: generated.mode,
      fallbackReason: generated.error ?? ""
    });
    const pack = {
      ...guardedPack,
      videoAssets: buildQueuedCampaignVideoAssets({
        campaignId: campaign.id,
        intake: campaign.intake,
        pack: guardedPack,
        createdAt: completedAt
      })
    };
    const agentRuns = createAgentRuns({
      campaignId: campaign.id,
      intake: campaign.intake,
      mode: generated.mode,
      model: generated.model || getGeminiModel(),
      generationError: generated.error
    });

    const plannedCampaign: Campaign = {
      ...campaign,
      mode: generated.mode,
      planningStatus: "pack-ready",
      planningStartedAt: campaign.planningStartedAt || startedAt,
      planningCompletedAt: completedAt,
      planningError: "",
      pack,
      agentRuns,
      evidenceSummary: {
        revenueEvidenceNeeded: [
          "Confirm the primary conversion action: booking, enquiry, checkout, trial, or direct message.",
          "Set the first measurable success target before publishing.",
          "Decide whether the first week is organic-only or includes a small paid boost after early signals."
        ],
        customerEvidenceNeeded: [
          "Confirm customer-approved proof points, testimonials, reviews, or anonymized examples.",
          "Collect the best existing social links, product visuals, founder clips, and offer pages.",
          "Choose who approves content and which claims require extra review."
        ],
        productEvidenceGenerated: [
          "Validated customer intake.",
          "Campaign pack output.",
          "Queued customer-specific MP4 and poster rendering jobs from selected duration and quality settings.",
          "Publishing queue with captions, account requirements, approval checks, and scheduling guidance.",
          "AI planning steps for offer fit, trend fit, scripts, creative direction, publishing support, and KPI planning."
        ]
      }
    };

    await saveCampaign(plannedCampaign);
    return {
      ok: true,
      status: "planned" as const,
      campaign: plannedCampaign
    };
  } catch (error) {
    const failedCampaign: Campaign = {
      ...campaign,
      planningStatus: "planning-failed",
      planningStartedAt: campaign.planningStartedAt || startedAt,
      planningCompletedAt: new Date().toISOString(),
      planningError: error instanceof Error ? error.message : "Campaign planning failed."
    };
    await saveCampaign(failedCampaign);
    return {
      ok: true,
      status: "planning-failed" as const,
      campaign: failedCampaign
    };
  }
}
