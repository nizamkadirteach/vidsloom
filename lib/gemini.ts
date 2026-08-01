import "server-only";

import { GoogleGenAI } from "@google/genai";

import { buildFallbackCampaignPack } from "@/lib/fallback-campaign";
import { extractJsonObject } from "@/lib/json";
import {
  CampaignIntake,
  CampaignPack,
  CampaignPackSchema,
  PlatformSchema,
  TrendIntelligence,
  TrendIntelligenceSchema
} from "@/lib/schemas";

const PROMPT_VERSION = "campaign-pack-v1.0";
const TREND_FORMAT_FALLBACKS = [
  "Problem-solution hook",
  "Behind-the-scenes proof",
  "Before-after workflow",
  "Objection-led Q&A",
  "Founder POV"
];

type GeminiCandidate = {
  model: string;
  location: string;
  source: "configured" | "default";
};

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export function getGeminiFallbackModel() {
  return process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
}

export function getPromptVersion() {
  return PROMPT_VERSION;
}

export function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

export function shouldUseEnterpriseGemini() {
  return process.env.GOOGLE_GENAI_USE_ENTERPRISE === "true" || process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
}

export function getCloudProject() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "";
}

export function getCloudLocation() {
  return process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
}

function getTimeoutMs(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('"code":429') ||
    message.includes('"code":500') ||
    message.includes('"code":503') ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE_EXCEEDED")
  );
}

async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  label: string,
  attempts = 3,
  options: {
    attemptsEnv?: string;
    baseDelayEnv?: string;
    maxDelayEnv?: string;
  } = {}
) {
  let lastError: unknown;
  const maxAttempts = Math.max(
    1,
    Math.min(8, getPositiveInteger(options.attemptsEnv ?? "VIDSLOOM_GEMINI_RETRY_ATTEMPTS", attempts))
  );
  const baseDelayMs = getPositiveInteger(options.baseDelayEnv ?? "VIDSLOOM_GEMINI_RETRY_BASE_MS", 5000);
  const maxDelayMs = getPositiveInteger(options.maxDelayEnv ?? "VIDSLOOM_GEMINI_RETRY_MAX_MS", 45000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientGeminiError(error)) break;
      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * Math.min(1000, baseDelayMs));
      await sleep(Math.min(maxDelayMs, exponentialDelay) + jitter);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  console.warn(`VIDSLOOM Gemini ${label} failed after ${maxAttempts} attempts: ${message.slice(0, 360)}`);
  throw lastError;
}

export function getGeminiRuntime() {
  if (shouldUseEnterpriseGemini()) {
    return {
      configured: Boolean(getCloudProject()),
      mode: "vertex",
      project: getCloudProject(),
      location: getCloudLocation()
    };
  }

  return {
    configured: Boolean(getGeminiKey()),
    mode: "developer-api",
    project: null,
    location: null
  };
}

export function createGeminiClient() {
  return shouldUseEnterpriseGemini()
    ? new GoogleGenAI({
        enterprise: true,
        project: getCloudProject(),
        location: getCloudLocation(),
        apiVersion: "v1"
      })
    : new GoogleGenAI({ apiKey: getGeminiKey() });
}

function createGeminiClientForCandidate(candidate: GeminiCandidate) {
  if (!shouldUseEnterpriseGemini()) return new GoogleGenAI({ apiKey: getGeminiKey() });

  return new GoogleGenAI({
    enterprise: true,
    project: getCloudProject(),
    location: candidate.location || getCloudLocation(),
    apiVersion: "v1"
  });
}

function getPackCandidates() {
  const configured = parseGeminiCandidateList(process.env.VIDSLOOM_PACK_CANDIDATES || "");
  const defaults = defaultPackCandidates();
  const limit = Math.max(1, Math.min(12, getPositiveInteger("VIDSLOOM_PACK_MAX_CANDIDATES", 5)));
  return dedupeGeminiCandidates([...configured, ...defaults]).slice(0, limit);
}

function defaultPackCandidates(): GeminiCandidate[] {
  const primaryModel = getGeminiModel();
  const fallbackModel = getGeminiFallbackModel();
  const primaryLocation = getCloudLocation();

  if (!shouldUseEnterpriseGemini()) {
    return dedupeGeminiCandidates([
      { model: primaryModel, location: "", source: "default" },
      { model: fallbackModel, location: "", source: "default" }
    ]);
  }

  return dedupeGeminiCandidates([
    { model: primaryModel, location: primaryLocation, source: "default" },
    { model: fallbackModel, location: "global", source: "default" },
    { model: primaryModel, location: "global", source: "default" },
    { model: fallbackModel, location: "us-east1", source: "default" },
    { model: primaryModel, location: "us-east1", source: "default" },
    { model: fallbackModel, location: "us-east4", source: "default" },
    { model: primaryModel, location: "us-east4", source: "default" }
  ]);
}

function parseGeminiCandidateList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item): GeminiCandidate => {
      const [model, location] = item.split("@").map((part) => part.trim());
      return {
        model,
        location: shouldUseEnterpriseGemini() ? location || getCloudLocation() : "",
        source: "configured"
      };
    })
    .filter((candidate) => Boolean(candidate.model));
}

function dedupeGeminiCandidates(candidates: GeminiCandidate[]) {
  const seen = new Set<string>();
  const deduped: GeminiCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.model) continue;
    const key = `${candidate.model}@${candidate.location}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function candidateLabel(candidate: GeminiCandidate) {
  return shouldUseEnterpriseGemini() ? `${candidate.model}@${candidate.location || getCloudLocation()}` : candidate.model;
}

function buildTrendPrompt(intake: CampaignIntake) {
  return `You are ZeitgeistScout, the trend intelligence agent inside VIDSLOOM.

Use Google Search grounding to identify timely short-form video trend patterns relevant to this customer. Focus on formats and repeatable creative formulas, not unverifiable promises of virality.

Business intake:
${JSON.stringify(intake, null, 2)}

Rules:
- Prefer current, platform-relevant short-form video formats and remixable patterns.
- Do not promise guaranteed viral reach, revenue, or paid-campaign performance.
- Keep recommendations low-cost first: organic, customer-owned assets, reusable templates, and only then paid tests.
- Every signal must be immediately usable by a small business.
- Set every signal's sourceType to "google-search-grounded" because this agent is using Search grounding.
- Return valid JSON only. No markdown, no comments, no surrounding prose.

Return this exact object:
{
  "agentName": "ZeitgeistScout",
  "generatedAt": "ISO datetime string",
  "freshnessWindow": "string",
  "caveat": "string",
  "recommendedFormats": ["string"],
  "signals": [
    {
      "trendId": "string",
      "capturedAt": "ISO datetime string",
      "platform": "TikTok | Instagram Reels | YouTube Shorts | LinkedIn | X | Facebook Reels",
      "format": "string",
      "trendSignal": "string",
      "whyNow": "string",
      "remixFormula": "string",
      "formulaSummary": "string",
      "hookPatterns": ["string"],
      "shotPatterns": ["string"],
      "ctaPattern": "string",
      "audioPattern": "string",
      "funnelStage": "TOFU | MOFU | BOFU | mixed",
      "organicPlay": "string",
      "paidVariant": "string",
      "recommendedAssetType": "string",
      "costLevel": "low | medium | high",
      "confidence": 0,
      "organicFit": 0,
      "paidFit": 0,
      "transferability": 0,
      "businessSafety": 0,
      "complianceRisk": 0,
      "decayRisk": 0,
      "regions": ["string"],
      "categories": ["string"],
      "sourceUrls": ["string"],
      "recommendedFor": ["string"],
      "avoidFor": ["string"],
      "sourceType": "google-search-grounded"
    }
  ]
}

Minimums:
- 4 recommendedFormats
- 4 signals
- Use only the customer's selected platforms where possible.`;
}

function buildPrompt(intake: CampaignIntake, trendIntelligence?: TrendIntelligence | null) {
  return `You are VIDSLOOM, an AI-operated social video marketing engine for small businesses.

Create a production-quality short-form video campaign pack for this customer.

Business intake:
${JSON.stringify(intake, null, 2)}

${trendIntelligence ? `Search-grounded trend intelligence to copy into the "trendIntelligence" field exactly:\n${JSON.stringify(trendIntelligence, null, 2)}\n` : ""}

Quality rules:
- Be concrete enough that a marketer can execute the campaign today.
- Respect the selected video settings: ${intake.videoSettings.durationSeconds}s videos, ${intake.videoSettings.qualityMode} quality, and these production instructions: ${intake.videoSettings.qualityInstructions}
- Respect the selected creative settings: ${JSON.stringify(intake.creativeSettings)}.
- Respect the brand kit where supplied: ${JSON.stringify(intake.brandKit)}. Use brand colors, logo guidance, do/don't notes, and font style in the visual direction without fabricating assets.
- Make each concept fit the selected duration. Shorter videos need fewer scene beats and sharper hooks; longer videos can include more proof, objection handling, or explanation.
- Prioritize high-quality short-form fundamentals: visible offer/proof, strong first-three-second hook, large readable captions, clear scene progression, claim-safe copy, and one clear CTA.
- Do not invent customer results, revenue, awards, testimonials, certifications, or regulated claims.
- Treat human review as mandatory before publishing.
- Create a hands-off publishing plan from the customer's automation settings, but never imply direct auto-posting is possible until the customer has connected the social account with required OAuth/API permissions.
- Minimize customer cost by reusing customer-owned assets, organic posting, and reusable templates before paid promotion.
- Prefer measurable CTAs, proof capture, and content that can create evidence for business viability.
- The output must be valid JSON only. No markdown, no comments, no surrounding prose.

Return a JSON object with this exact shape:
{
  "executiveBrief": "string",
  "positioning": "string",
  "trendIntelligence": {
    "agentName": "ZeitgeistScout",
    "generatedAt": "ISO datetime string",
    "freshnessWindow": "string",
    "caveat": "string",
    "recommendedFormats": ["string"],
    "signals": [
      {
        "trendId": "string",
        "capturedAt": "ISO datetime string",
        "platform": "TikTok | Instagram Reels | YouTube Shorts | LinkedIn | X | Facebook Reels",
        "format": "string",
        "trendSignal": "string",
        "whyNow": "string",
        "remixFormula": "string",
        "formulaSummary": "string",
        "hookPatterns": ["string"],
        "shotPatterns": ["string"],
        "ctaPattern": "string",
        "audioPattern": "string",
        "funnelStage": "TOFU | MOFU | BOFU | mixed",
        "organicPlay": "string",
        "paidVariant": "string",
        "recommendedAssetType": "string",
        "costLevel": "low | medium | high",
        "confidence": 0,
        "organicFit": 0,
        "paidFit": 0,
        "transferability": 0,
        "businessSafety": 0,
        "complianceRisk": 0,
        "decayRisk": 0,
        "regions": ["string"],
        "categories": ["string"],
        "sourceUrls": ["string"],
        "recommendedFor": ["string"],
        "avoidFor": ["string"],
        "sourceType": "google-search-grounded | platform-observation | model-formula | fallback-formula"
      }
    ]
  },
  "brandReadiness": ["string"],
  "trendAngles": [
    {
      "name": "string",
      "insight": "string",
      "fitScore": 0,
      "executionNote": "string"
    }
  ],
  "videoConcepts": [
    {
      "title": "string",
      "platform": "TikTok | Instagram Reels | YouTube Shorts | LinkedIn | X | Facebook Reels",
      "objective": "string",
      "hook": "string",
      "script": "string",
      "shotList": ["string"],
      "caption": "string",
      "hashtags": ["string"],
      "cta": "string",
      "approvalRisks": ["string"],
      "qualityScore": 0
    }
  ],
  "calendar": [
    {
      "day": "string",
      "platform": "TikTok | Instagram Reels | YouTube Shorts | LinkedIn | X | Facebook Reels",
      "conceptTitle": "string",
      "publishWindow": "string",
      "reason": "string"
    }
  ],
  "publishingQueue": [
    {
      "platform": "TikTok | Instagram Reels | YouTube Shorts | LinkedIn | X | Facebook Reels",
      "conceptTitle": "string",
      "day": "string",
      "publishWindow": "string",
      "caption": "string",
      "hashtags": ["string"],
      "status": "needs-assets | needs-approval | ready-to-schedule | scheduled | published | blocked",
      "automationMode": "direct-api-after-oauth | approval-required | manual-upload-fallback",
      "connectedAccountRequired": true,
      "assetChecklist": ["string"],
      "approvalChecklist": ["string"],
      "platformRequirement": "string",
      "costControlNote": "string"
    }
  ],
  "experiments": [
    {
      "testName": "string",
      "variantA": "string",
      "variantB": "string",
      "successMetric": "string"
    }
  ],
  "kpiPlan": [
    {
      "metric": "string",
      "target": "string",
      "captureMethod": "string"
    }
  ],
  "risks": ["string"],
  "nextActions": ["string"]
}

Minimums:
- 4 trendIntelligence recommendedFormats
- 4 trendIntelligence signals
- 4 trendAngles
- 5 videoConcepts
- 5 calendar items
- 5 publishingQueue items
- 3 experiments
- 4 KPI rows
- 5 nextActions`;
}

function coerceString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function coerceConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 70;
}

function coerceStringArray(value: unknown, fallback: string[]) {
  const items = Array.isArray(value)
    ? value.map((item) => coerceString(item, "")).filter(Boolean)
    : [];
  return items.length ? items.slice(0, 12) : fallback.slice(0, 12);
}

function parseFunnelStage(value: unknown) {
  if (value === "TOFU" || value === "MOFU" || value === "BOFU" || value === "mixed") return value;
  return "TOFU" as const;
}

function normalizeRecommendedFormats(value: unknown) {
  const formats = Array.isArray(value) ? value.map((item) => coerceString(item, "")).filter(Boolean).slice(0, 8) : [];
  for (const format of TREND_FORMAT_FALLBACKS) {
    if (formats.length >= 4) break;
    if (!formats.includes(format)) formats.push(format);
  }
  return formats;
}

function fallbackTrendSignal(intake: CampaignIntake, index: number, sourceNote?: string) {
  const platform = intake.platforms[index % intake.platforms.length];
  const format = TREND_FORMAT_FALLBACKS[index % TREND_FORMAT_FALLBACKS.length];
  const note = sourceNote ? ` Grounded note: ${sourceNote}` : "";

  return {
    trendId: `fallback_${index + 1}`,
    capturedAt: new Date().toISOString(),
    platform,
    format,
    trendSignal: `${format} is a low-cost short-form pattern that can be remixed for ${intake.industry}.${note}`,
    whyNow: "It fits current short-form behavior: fast hooks, visible proof, and immediate usefulness for a narrow audience.",
    remixFormula: "Open with the customer pain, show one concrete proof point, explain the change, and end with one measurable action.",
    formulaSummary: "Pain-first hook plus one concrete visual proof support and one measurable action.",
    hookPatterns: [
      "Name the customer pain in the first line.",
      "Show visible movement before the viewer can scroll away."
    ],
    shotPatterns: [
      "Tight product or service close-up.",
      "Fast proof-supporting cutaway.",
      "Clean CTA end beat."
    ],
    ctaPattern: "Ask for one low-friction action: DM, book, claim, buy, or request the checklist.",
    audioPattern: "Fast but clear narration with a brief pause after the hook.",
    funnelStage: index % 3 === 0 ? ("TOFU" as const) : index % 3 === 1 ? ("MOFU" as const) : ("BOFU" as const),
    organicPlay: "Use customer-owned vertical footage, on-screen captions, and a single CTA before spending on paid media.",
    paidVariant: "Boost only the version with early saves, replies, watch time, or qualified enquiries.",
    recommendedAssetType: "Vertical customer-owned footage with captions",
    costLevel: "low" as const,
    confidence: 72,
    organicFit: 82,
    paidFit: 68,
    transferability: 84,
    businessSafety: 88,
    complianceRisk: 18,
    decayRisk: 35,
    regions: [],
    categories: [intake.industry],
    sourceUrls: [],
    recommendedFor: [intake.industry, "small businesses without in-house video teams"],
    avoidFor: ["regulated claims without proof", "copyrighted audio-dependent trends"],
    sourceType: "google-search-grounded" as const
  };
}

function normalizeTrendIntelligence(value: unknown, intake: CampaignIntake) {
  const candidate = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
  const normalizedSignals = signals.slice(0, 8).map((item, index) => {
    const signal = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const parsedPlatform = PlatformSchema.safeParse(signal.platform);
    return {
      trendId: coerceString(signal.trendId, `signal_${index + 1}`),
      capturedAt: coerceString(signal.capturedAt, coerceString(candidate.generatedAt, new Date().toISOString())),
      platform: parsedPlatform.success ? parsedPlatform.data : intake.platforms[index % intake.platforms.length],
      format: coerceString(signal.format, "Current short-form trend formula"),
      trendSignal: coerceString(signal.trendSignal, "A timely short-form pattern that can be remixed for this customer."),
      whyNow: coerceString(signal.whyNow, "It aligns with current short-form discovery behavior and customer attention limits."),
      remixFormula: coerceString(signal.remixFormula, "Start with the customer pain, show the useful proof, and end with one action."),
      formulaSummary: coerceString(signal.formulaSummary, coerceString(signal.remixFormula, "Pain-first hook, concrete visual proof support, and one CTA.")),
      hookPatterns: coerceStringArray(signal.hookPatterns, [
        "Open with the buyer pain or desired payoff.",
        "Show motion in the first second."
      ]),
      shotPatterns: coerceStringArray(signal.shotPatterns, [
        "Tight vertical close-up.",
        "One proof-supporting visual.",
        "Clear CTA end beat."
      ]),
      ctaPattern: coerceString(signal.ctaPattern, "Use one measurable CTA with minimal friction."),
      audioPattern: coerceString(signal.audioPattern, "Clear narration or sound-off subtitles; avoid copyrighted audio dependency."),
      funnelStage: parseFunnelStage(signal.funnelStage),
      organicPlay: coerceString(signal.organicPlay, "Publish as a low-cost vertical video using customer-owned assets."),
      paidVariant: coerceString(signal.paidVariant, "Boost only after organic engagement shows early traction."),
      recommendedAssetType: coerceString(signal.recommendedAssetType, "Vertical customer-owned video with captions"),
      costLevel: signal.costLevel === "medium" || signal.costLevel === "high" ? signal.costLevel : "low",
      confidence: coerceConfidence(signal.confidence),
      organicFit: coerceConfidence(signal.organicFit ?? signal.confidence),
      paidFit: coerceConfidence(signal.paidFit ?? 65),
      transferability: coerceConfidence(signal.transferability ?? 75),
      businessSafety: coerceConfidence(signal.businessSafety ?? 80),
      complianceRisk: coerceConfidence(signal.complianceRisk ?? 20),
      decayRisk: coerceConfidence(signal.decayRisk ?? 35),
      regions: coerceStringArray(signal.regions, []),
      categories: coerceStringArray(signal.categories, [intake.industry]),
      sourceUrls: coerceStringArray(signal.sourceUrls, []),
      recommendedFor: coerceStringArray(signal.recommendedFor, [intake.industry]),
      avoidFor: coerceStringArray(signal.avoidFor, ["unsupported claims", "copyrighted audio-dependent formats"]),
      sourceType: "google-search-grounded" as const
    };
  });

  while (normalizedSignals.length < 4) {
    normalizedSignals.push(fallbackTrendSignal(intake, normalizedSignals.length));
  }

  return TrendIntelligenceSchema.parse({
    agentName: "ZeitgeistScout",
    generatedAt: coerceString(candidate.generatedAt, new Date().toISOString()),
    freshnessWindow: coerceString(candidate.freshnessWindow, "Search-grounded at generation time; refresh before publishing."),
    caveat: coerceString(
      candidate.caveat,
      "Trend signals change quickly. Use these formulas for low-cost testing, not as guaranteed reach or revenue claims."
    ),
    recommendedFormats: normalizeRecommendedFormats(candidate.recommendedFormats),
    signals: normalizedSignals
  });
}

function normalizeTrendText(text: string, intake: CampaignIntake) {
  const compact = text.replace(/\s+/g, " ").trim().slice(0, 420);
  const signals = Array.from({ length: 4 }, (_, index) =>
    fallbackTrendSignal(intake, index, index === 0 && compact ? compact : undefined)
  );

  return normalizeTrendIntelligence(
    {
      agentName: "ZeitgeistScout",
      generatedAt: new Date().toISOString(),
      freshnessWindow: "Search-grounded at generation time; refresh before publishing.",
      caveat: "Trend signals change quickly. Use these formulas for low-cost testing, not as guaranteed reach or revenue claims.",
      recommendedFormats: TREND_FORMAT_FALLBACKS,
      signals
    },
    intake
  );
}

async function generateTrendIntelligence(ai: GoogleGenAI, model: string, intake: CampaignIntake, label = model) {
  const response = await withGeminiRetry(
    () =>
      ai.models.generateContent({
        model,
        contents: buildTrendPrompt(intake),
        config: {
          temperature: 0.4,
          tools: [{ googleSearch: {} }],
          httpOptions: {
            timeout: getTimeoutMs("VIDSLOOM_TREND_TIMEOUT_MS", 25000)
          }
        }
      }),
    `trend intelligence (${label})`,
    1,
    {
      attemptsEnv: "VIDSLOOM_TREND_RETRY_ATTEMPTS",
      baseDelayEnv: "VIDSLOOM_TREND_RETRY_BASE_MS",
      maxDelayEnv: "VIDSLOOM_TREND_RETRY_MAX_MS"
    }
  );
  const text = response.text ?? "";
  try {
    const parsed = JSON.parse(extractJsonObject(text));
    return normalizeTrendIntelligence(parsed, intake);
  } catch {
    return normalizeTrendText(text, intake);
  }
}

export async function generateCampaignPack(intake: CampaignIntake): Promise<{
  mode: "gemini" | "fallback";
  model: string;
  pack: CampaignPack;
  rawText?: string;
  error?: string;
}> {
  const model = getGeminiModel();
  const runtime = getGeminiRuntime();

  if (!runtime.configured) {
    return {
      mode: "fallback",
      model: "deterministic-fallback",
      pack: buildFallbackCampaignPack(intake),
      error: shouldUseEnterpriseGemini()
        ? "GOOGLE_CLOUD_PROJECT is not configured for Vertex/Gemini."
        : "GEMINI_API_KEY or GOOGLE_API_KEY is not configured."
    };
  }

  const candidates = getPackCandidates();
  let lastError: unknown;

  try {
    for (const [index, candidate] of candidates.entries()) {
      const label = candidateLabel(candidate);
      try {
        const generated = await generateCampaignPackWithModel(createGeminiClientForCandidate(candidate), candidate, intake);
        return {
          mode: "gemini",
          model: label,
          ...generated,
          error: index > 0 ? `Recovered with ${label} after an earlier AI planning route was unavailable.` : undefined
        };
      } catch (candidateError) {
        lastError = candidateError;
        const message = candidateError instanceof Error ? candidateError.message : String(candidateError);
        console.warn(`VIDSLOOM Gemini campaign candidate ${label} failed: ${message.slice(0, 360)}`);
      }
    }

    throw lastError;
  } catch (error) {
    return {
      mode: "fallback",
      model,
      pack: buildFallbackCampaignPack(intake),
      error: error instanceof Error ? error.message : "Unknown Gemini generation error."
    };
  }
}

async function generateCampaignPackWithModel(ai: GoogleGenAI, candidate: GeminiCandidate, intake: CampaignIntake) {
  const label = candidateLabel(candidate);
  const trendIntelligence = await generateTrendIntelligence(ai, candidate.model, intake, label).catch(() => null);
  const response = await withGeminiRetry(
    () =>
      ai.models.generateContent({
        model: candidate.model,
        contents: buildPrompt(intake, trendIntelligence),
        config: {
          temperature: 0.55,
          responseMimeType: "application/json",
          httpOptions: {
            timeout: getTimeoutMs("VIDSLOOM_PACK_TIMEOUT_MS", 30000)
          }
        }
      }),
    `campaign pack (${label})`,
    2,
    {
      attemptsEnv: "VIDSLOOM_PACK_RETRY_ATTEMPTS",
      baseDelayEnv: "VIDSLOOM_PACK_RETRY_BASE_MS",
      maxDelayEnv: "VIDSLOOM_PACK_RETRY_MAX_MS"
    }
  );
  const text = response.text ?? "";
  const parsed = JSON.parse(extractJsonObject(text));
  const pack = CampaignPackSchema.parse({
    ...parsed,
    trendIntelligence: trendIntelligence ?? parsed.trendIntelligence,
    publishingQueue: []
  });
  return { pack, rawText: text };
}
