import { CampaignIntake, CampaignPack, Platform, PublishingTask } from "@/lib/schemas";

const PLATFORM_REQUIREMENTS: Record<Platform, string> = {
  TikTok: "Requires a customer-authorized TikTok account and approved Content Posting API permissions for direct posting.",
  "Instagram Reels": "Requires a professional Instagram account connected through Meta permissions for content publishing.",
  "YouTube Shorts": "Requires customer OAuth consent for YouTube upload permissions before direct video publishing.",
  LinkedIn: "Requires customer LinkedIn authorization and organization/member posting permissions.",
  X: "Requires customer account authorization and posting permissions for the selected account.",
  "Facebook Reels": "Requires customer Facebook Page authorization through Meta permissions for content publishing."
};

function accountFor(intake: CampaignIntake, platform: Platform) {
  return intake.automationSetup.connectedAccounts.find((account) => account.platform === platform);
}

function notificationSuffix(intake: CampaignIntake) {
  const channels = intake.automationSetup.notificationChannels.join(", ");
  const contact = intake.automationSetup.notificationContact || "the configured customer contact";
  return `Notify via ${channels} to ${contact}, respecting ${intake.automationSetup.quietHours}.`;
}

function statusFor(intake: CampaignIntake, platform: Platform): PublishingTask["status"] {
  const account = accountFor(intake, platform);
  if (!account || account.status !== "connected") return "blocked";
  if (intake.automationSetup.publishingMode === "manual-only") return "needs-approval";
  if (intake.automationSetup.assetSource === "customer-uploaded" && !intake.assets?.trim()) return "needs-assets";
  if (intake.automationSetup.approvalPolicy === "approve-every-post") return "needs-approval";
  return "ready-to-schedule";
}

function automationModeFor(intake: CampaignIntake, platform: Platform): PublishingTask["automationMode"] {
  const account = accountFor(intake, platform);
  if (intake.automationSetup.publishingMode === "manual-only") return "manual-upload-fallback";
  if (account?.status === "connected" && account.autoPublish) return "direct-api-after-oauth";
  return "approval-required";
}

export function buildPublishingQueue(intake: CampaignIntake, pack: CampaignPack): PublishingTask[] {
  return pack.calendar.map((item) => {
    const concept = pack.videoConcepts.find(
      (candidate) => candidate.title === item.conceptTitle && candidate.platform === item.platform
    ) ?? pack.videoConcepts.find((candidate) => candidate.title === item.conceptTitle);
    const account = accountFor(intake, item.platform);
    const mode = automationModeFor(intake, item.platform);
    const status = statusFor(intake, item.platform);

    return {
      platform: item.platform,
      conceptTitle: item.conceptTitle,
      day: item.day,
      publishWindow: item.publishWindow,
      caption: concept?.caption ?? `Publish ${item.conceptTitle} for ${intake.businessName}.`,
      hashtags: concept?.hashtags?.length ? concept.hashtags.slice(0, 10) : ["#smallbusiness", "#marketing", "#growth"],
      status,
      automationMode: mode,
      connectedAccountRequired: account?.status !== "connected",
      assetChecklist: [
        "Approved vertical video file or customer-approved source footage.",
        "Thumbnail or cover frame suitable for the selected platform.",
        "Final caption, hashtags, CTA, and link destination."
      ],
      approvalChecklist: [
        "Offer accuracy and regulated-claim review completed.",
        "Caption, CTA, and publishing time accepted by customer rules.",
        notificationSuffix(intake)
      ],
      platformRequirement: PLATFORM_REQUIREMENTS[item.platform],
      costControlNote:
        intake.automationSetup.budgetSensitivity === "lowest-cost"
          ? "Use organic publishing, reusable templates, and customer-owned assets before paid media or contractor work."
          : intake.automationSetup.budgetSensitivity === "balanced"
            ? "Prioritize organic reach first, then test small paid boosts only when content shows early traction."
            : "Prioritize highest-impact publishing windows and creative variants while still tracking customer-approved spend."
    };
  });
}
