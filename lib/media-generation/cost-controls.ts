import {
  MediaBudgetPlanSchema,
  type MediaBudgetLine,
  type MediaBudgetPlan,
  type MediaProductionPlan,
  type MediaQaReport,
  type MediaShotPlan
} from "@/lib/media-generation/schemas";

type MediaPlanMode = MediaProductionPlan["mode"];

export function mediaCostControlSettings() {
  return {
    configuredBudgetCents: positiveInteger(process.env.VIDSLOOM_MEDIA_BUDGET_PER_CAMPAIGN_CENTS, 0),
    allowUnbudgetedGeneration: process.env.VIDSLOOM_ALLOW_UNBUDGETED_MEDIA_GENERATION === "true",
    maxPremiumClips: positiveInteger(process.env.VIDSLOOM_PREMIUM_VIDEO_MAX_CLIPS, 1)
  };
}

export function buildMediaBudgetPlan({
  shotPlans,
  qaReports,
  mode,
  maxShots
}: {
  shotPlans: MediaShotPlan[];
  qaReports: MediaQaReport[];
  mode: MediaPlanMode;
  maxShots?: number;
}): MediaBudgetPlan {
  const settings = mediaCostControlSettings();
  const executableShots = executableShotsFor({ shotPlans, qaReports, mode, maxShots });
  const blockedShotIds = shotPlans
    .filter((shot) => !executableShots.some((candidate) => candidate.id === shot.id))
    .map((shot) => shot.id);
  const costLines = buildCostLines({ shots: executableShots, mode });
  const estimatedCostCents = costLines.reduce((total, line) => total + line.estimatedCents, 0);
  const premiumClipsPlanned = costLines.filter((line) => line.jobType === "video-clip" && line.costTier === "premium").length;
  const blockers = budgetBlockers({
    mode,
    estimatedCostCents,
    configuredBudgetCents: settings.configuredBudgetCents,
    allowUnbudgetedGeneration: settings.allowUnbudgetedGeneration,
    premiumClipsPlanned,
    maxPremiumClips: settings.maxPremiumClips,
    executableShots,
    shotPlans
  });

  return MediaBudgetPlanSchema.parse({
    configuredBudgetCents: settings.configuredBudgetCents,
    estimatedCostCents,
    remainingBudgetCents: settings.configuredBudgetCents - estimatedCostCents,
    allowUnbudgetedGeneration: settings.allowUnbudgetedGeneration,
    maxPremiumClips: settings.maxPremiumClips,
    premiumClipsPlanned,
    executableShotIds: executableShots.map((shot) => shot.id),
    blockedShotIds,
    status: budgetStatus({
      mode,
      blockers,
      estimatedCostCents,
      configuredBudgetCents: settings.configuredBudgetCents,
      premiumClipsPlanned,
      maxPremiumClips: settings.maxPremiumClips,
      executableShots
    }),
    blockers,
    costLines
  });
}

export function executionBlockersFor(plan: MediaProductionPlan) {
  if (plan.mode === "dry-run") return [];
  return plan.budget.blockers;
}

export function executableShotIdsFor(plan: MediaProductionPlan) {
  return new Set(plan.budget.executableShotIds);
}

function executableShotsFor({
  shotPlans,
  qaReports,
  mode,
  maxShots
}: {
  shotPlans: MediaShotPlan[];
  qaReports: MediaQaReport[];
  mode: MediaPlanMode;
  maxShots?: number;
}) {
  if (mode === "dry-run") return [];
  const qaByShot = new Map(qaReports.map((report) => [report.shotId, report]));
  const limit = Math.max(0, maxShots ?? defaultMaxShotsForMode(mode));
  return shotPlans
    .filter((shot) => {
      const report = qaByShot.get(shot.id);
      return report?.status === "publish-ready";
    })
    .slice(0, limit);
}

function buildCostLines({ shots, mode }: { shots: MediaShotPlan[]; mode: MediaPlanMode }): MediaBudgetLine[] {
  const lines: MediaBudgetLine[] = [];
  for (const shot of shots) {
    if (mode === "reference-frame" || mode === "video-generation" || mode === "final-assembly") {
      lines.push({
        label: `Reference frame for ${shot.conceptTitle} shot ${shot.shotNumber}`,
        jobType: "reference-frame",
        shotId: shot.id,
        costTier: shot.costTier,
        estimatedCents: estimateCents("reference-frame", shot.costTier)
      });
    }
    if (mode === "video-generation" || mode === "final-assembly") {
      lines.push({
        label: `Video clip for ${shot.conceptTitle} shot ${shot.shotNumber}`,
        jobType: "video-clip",
        shotId: shot.id,
        costTier: shot.costTier,
        estimatedCents: estimateCents("video-clip", shot.costTier)
      });
    }
  }

  if (mode === "final-assembly" && shots.length) {
    lines.push({
      label: "Final vertical review assembly",
      jobType: "assembly",
      shotId: "final-assembly",
      costTier: "preview",
      estimatedCents: estimateCents("assembly", "preview")
    });
  }

  return lines;
}

function budgetBlockers({
  mode,
  estimatedCostCents,
  configuredBudgetCents,
  allowUnbudgetedGeneration,
  premiumClipsPlanned,
  maxPremiumClips,
  executableShots,
  shotPlans
}: {
  mode: MediaPlanMode;
  estimatedCostCents: number;
  configuredBudgetCents: number;
  allowUnbudgetedGeneration: boolean;
  premiumClipsPlanned: number;
  maxPremiumClips: number;
  executableShots: MediaShotPlan[];
  shotPlans: MediaShotPlan[];
}) {
  if (mode === "dry-run") return [];
  const blockers: string[] = [];

  if (!executableShots.length && shotPlans.length) {
    blockers.push("No shots passed pre-generation QA. Fix proof, asset, or prompt issues before paid media generation.");
  }
  if (estimatedCostCents > 0 && configuredBudgetCents <= 0 && !allowUnbudgetedGeneration) {
    blockers.push("No per-campaign media budget is configured. Set VIDSLOOM_MEDIA_BUDGET_PER_CAMPAIGN_CENTS or explicitly allow unbudgeted staging runs.");
  }
  if (configuredBudgetCents > 0 && estimatedCostCents > configuredBudgetCents) {
    blockers.push(`Estimated media cost ${formatCents(estimatedCostCents)} exceeds configured budget ${formatCents(configuredBudgetCents)}.`);
  }
  if (premiumClipsPlanned > maxPremiumClips) {
    blockers.push(`Premium clip count ${premiumClipsPlanned} exceeds the configured limit of ${maxPremiumClips}.`);
  }

  return blockers;
}

function budgetStatus({
  mode,
  blockers,
  estimatedCostCents,
  configuredBudgetCents,
  premiumClipsPlanned,
  maxPremiumClips,
  executableShots
}: {
  mode: MediaPlanMode;
  blockers: string[];
  estimatedCostCents: number;
  configuredBudgetCents: number;
  premiumClipsPlanned: number;
  maxPremiumClips: number;
  executableShots: MediaShotPlan[];
}): MediaBudgetPlan["status"] {
  if (mode === "dry-run") return "dry-run-only";
  if (!executableShots.length) return "blocked-by-qa";
  if (premiumClipsPlanned > maxPremiumClips) return "premium-limit";
  if (configuredBudgetCents > 0 && estimatedCostCents > configuredBudgetCents) return "over-budget";
  if (blockers.some((blocker) => blocker.includes("No per-campaign media budget"))) return "no-budget";
  return "within-budget";
}

function estimateCents(jobType: MediaBudgetLine["jobType"], costTier: MediaBudgetLine["costTier"]) {
  if (jobType === "assembly") return 25;
  if (jobType === "tts") return 40;
  if (jobType === "reference-frame") {
    if (costTier === "premium") return 30;
    if (costTier === "standard") return 20;
    return 10;
  }
  if (jobType === "video-clip") {
    if (costTier === "premium") return 1200;
    if (costTier === "standard") return 650;
    return 300;
  }
  return 0;
}

function defaultMaxShotsForMode(mode: MediaPlanMode) {
  if (mode === "reference-frame") return 8;
  if (mode === "video-generation") return 2;
  if (mode === "final-assembly") return 3;
  return 0;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
