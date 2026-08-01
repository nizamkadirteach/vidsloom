import type { AgentRun, Campaign } from "@/lib/schemas";
import { buildCampaignVideoAssets } from "@/lib/video-assets";

export type PublicAgentRun = Omit<AgentRun, "id" | "campaignId" | "model" | "outputSummary"> & {
  outputSummary: string;
};

type CampaignPack = Campaign["pack"];
type TrendIntelligence = CampaignPack["trendIntelligence"];
type TrendSignal = TrendIntelligence["signals"][number];

export type PublicTrendSignal = Omit<TrendSignal, "sourceType"> & {
  sourceLabel: string;
};

export type PublicTrendIntelligence = Omit<TrendIntelligence, "agentName" | "signals"> & {
  agentName: string;
  signals: PublicTrendSignal[];
};

export type PublicCampaignPack = Omit<CampaignPack, "trendIntelligence"> & {
  trendIntelligence: PublicTrendIntelligence;
};

export type PublicCampaign = Omit<Campaign, "id" | "customerId" | "source" | "mode" | "agentRuns" | "pack"> & {
  id: string;
  generationStatus: "ai-generated" | "offline-fallback";
  pack: PublicCampaignPack;
  agentRuns: PublicAgentRun[];
};

export function sanitizePublicText(text: string) {
  return text
    .replace(/Build with Gemini XPRIZE/gi, "launch deadline")
    .replace(/Gemini XPRIZE/gi, "launch deadline")
    .replace(/Gemini\/Search grounding/gi, "VIDSLOOM trend intelligence")
    .replace(/Search grounding/gi, "trend intelligence")
    .replace(/Google Search/gi, "trend research")
    .replace(/google-search-grounded/gi, "AI trend intelligence")
    .replace(/VIDSLOOM AI trend scout/gi, "VIDSLOOM intelligence layer")
    .replace(/AI trend scout/gi, "AI trend intelligence")
    .replace(/trend scout/gi, "trend intelligence")
    .replace(/Proof in Production:\s*Cloud Run\s*&\s*Firestore/gi, "Production-ready marketing engine")
    .replace(/Built on Google Cloud,\s*powered by AI\./gi, "Built for reliable AI-powered marketing.")
    .replace(/Powered by Google Cloud/gi, "Powered by VIDSLOOM AI")
    .replace(/Cloud Run deployments/gi, "production deployments")
    .replace(/Cloud Run dashboard/gi, "production dashboard")
    .replace(/Cloud Run/gi, "production hosting")
    .replace(/Firestore console/gi, "campaign database")
    .replace(/Firestore data/gi, "campaign records")
    .replace(/Firestore logs/gi, "campaign logs")
    .replace(/Firestore/gi, "campaign records")
    .replace(/Google Cloud/gi, "production cloud")
    .replace(/SendGrid/gi, "email follow-up")
    .replace(/Vertex AI/gi, "AI")
    .replace(/Gemini/gi, "AI");
}

function sanitizeValue<T>(value: T): T {
  if (typeof value === "string") return sanitizePublicText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)])) as T;
  }
  return value;
}

function toPublicPack(campaign: Campaign): PublicCampaignPack {
  const normalizedPack = {
    ...campaign.pack,
    videoAssets: campaign.pack.videoAssets.length
      ? campaign.pack.videoAssets
      : buildCampaignVideoAssets({
          campaignId: campaign.id,
          intake: campaign.intake,
          pack: campaign.pack,
          createdAt: campaign.createdAt
        })
  };
  const sanitizedPack = sanitizeValue(normalizedPack);

  return {
    ...sanitizedPack,
    generationRouting: {
      ...sanitizedPack.generationRouting,
      planningModel: "VIDSLOOM AI planning route",
      mediaModel: "VIDSLOOM AI media route",
      internalNotes: []
    },
    trendIntelligence: {
      ...sanitizedPack.trendIntelligence,
      agentName: "VIDSLOOM Intelligence Layer",
      signals: sanitizedPack.trendIntelligence.signals.map(({ sourceType: _sourceType, ...signal }) => ({
        ...signal,
        sourceLabel: campaign.mode === "gemini" ? "AI trend intelligence" : "VIDSLOOM planning signal"
      }))
    }
  };
}

export function toPublicCampaign(campaign: Campaign): PublicCampaign {
  return {
    id: campaign.id,
    createdAt: campaign.createdAt,
    planningStatus: campaign.planningStatus,
    planningQueuedAt: campaign.planningQueuedAt,
    planningStartedAt: campaign.planningStartedAt,
    planningCompletedAt: campaign.planningCompletedAt,
    planningJobId: campaign.planningJobId,
    planningError: sanitizePublicText(campaign.planningError),
    generationStatus: campaign.mode === "gemini" ? "ai-generated" : "offline-fallback",
    intake: sanitizeValue(campaign.intake),
    pack: toPublicPack(campaign),
    evidenceSummary: sanitizeValue(campaign.evidenceSummary),
    agentRuns: campaign.agentRuns.map((run) => ({
      agentName: run.agentName,
      status: run.status,
      promptVersion: run.promptVersion,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      inputSummary: sanitizePublicText(run.inputSummary),
      outputSummary:
        run.status === "completed"
          ? `${run.agentName} completed its campaign-planning responsibility.`
          : `${run.agentName} prepared a review-safe planning draft for this run.`
    }))
  };
}
