import "server-only";

import { createId } from "@/lib/id";
import { buildCustomerAssetGenerationBrief } from "@/lib/customer-assets";
import {
  BillingCustomer,
  CampaignIntake,
  CustomerAsset,
  CustomerOnboarding,
  CustomerOnboardingSchema,
  CustomerOnboardingUpdate,
  Platform
} from "@/lib/schemas";

export function buildCustomerOnboarding({
  customer,
  input,
  existing
}: {
  customer: BillingCustomer;
  input: CustomerOnboardingUpdate;
  existing?: CustomerOnboarding | null;
}) {
  const now = new Date().toISOString();
  const connectedAccounts = input.connectedAccounts.length
    ? input.connectedAccounts
    : input.platforms.map((platform) => ({
        platform,
        handle: "",
        status: "not-connected" as const,
        autoPublish: false
      }));

  return CustomerOnboardingSchema.parse({
    ...input,
    id: existing?.id ?? createId("onboarding"),
    customerId: customer.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    submittedAt: existing?.submittedAt || now,
    status: "submitted",
    connectedAccounts,
    generatedCampaignIds: existing?.generatedCampaignIds ?? []
  });
}

export function onboardingToCampaignIntake(
  customer: BillingCustomer,
  onboarding: CustomerOnboarding,
  customerAssets: CustomerAsset[] = []
): CampaignIntake {
  return {
    businessName: truncate(customer.businessName, 80),
    website: truncate(onboarding.websiteSocial, 160),
    industry: truncate(onboarding.industry, 80),
    offer: truncate(onboarding.offer, 900),
    audience: truncate(onboarding.targetAudience, 900),
    goal: truncate(onboarding.primaryGoal, 400),
    brandVoice: truncate(onboarding.brandVoice, 300),
    platforms: onboarding.platforms,
    constraints: buildConstraints(onboarding),
    proofPoints: truncate(onboarding.proofPoints, 900),
    assets: buildAssets(onboarding, customerAssets),
    cadence: onboarding.postingCadence,
    brandKit: onboarding.brandKit,
    creativeSettings: onboarding.creativeSettings,
    videoSettings: onboarding.videoSettings,
    automationSetup: {
      publishingMode: onboarding.publishingMode,
      approvalPolicy: onboarding.approvalPolicy,
      notificationChannels: onboarding.approvalChannels,
      notificationContact: onboarding.notificationContact || onboarding.approvalContact,
      postingTimezone: onboarding.postingTimezone,
      quietHours: onboarding.quietHours,
      budgetSensitivity: onboarding.budgetSensitivity,
      assetSource: onboarding.assetSource,
      connectedAccounts: onboarding.connectedAccounts.length
        ? onboarding.connectedAccounts
        : onboarding.platforms.map((platform) => ({
            platform,
            handle: "",
            status: "not-connected",
            autoPublish: false
          }))
    }
  };
}

export function customerPlanLimit(platforms: Platform[], maxPlatforms: number) {
  return platforms.slice(0, Math.max(1, Math.min(maxPlatforms, platforms.length)));
}

function buildConstraints(onboarding: CustomerOnboarding) {
  const parts = [
    onboarding.constraints,
    onboarding.autoPostingIntent
      ? "Customer is interested in auto-posting after social OAuth and publish rules are connected."
      : "Use approval-first queue; do not auto-post unless the customer later connects OAuth and publish rules.",
    `Approval contact: ${onboarding.approvalContact}.`,
    `Quiet hours: ${onboarding.quietHours}.`
  ];
  return truncate(parts.filter(Boolean).join("\n"), 900);
}

function buildAssets(onboarding: CustomerOnboarding, customerAssets: CustomerAsset[] = []) {
  const structuredAssetBrief = buildCustomerAssetGenerationBrief(customerAssets);
  const parts = [
    structuredAssetBrief ? `Structured asset library:\n${structuredAssetBrief}` : "",
    onboarding.assetLinks ? `Asset links: ${onboarding.assetLinks}` : "",
    onboarding.currentContent ? `Current content: ${onboarding.currentContent}` : "",
    onboarding.competitors ? `Competitors/reference accounts: ${onboarding.competitors}` : ""
  ];
  return truncate(parts.filter(Boolean).join("\n"), 900);
}

function truncate(value: string, max: number) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}
