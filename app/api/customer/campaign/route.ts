import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { createCampaignDraft } from "@/lib/campaign-engine";
import { authorizeCustomerPortal, planDeliveryProfile } from "@/lib/customer-access";
import { onboardingToCampaignIntake } from "@/lib/customer-onboarding";
import { createId } from "@/lib/id";
import { enqueueCampaignPlanning } from "@/lib/planning-jobs";
import { toPublicCampaign } from "@/lib/public-campaign";
import { CustomerCampaignGenerateSchema } from "@/lib/schemas";
import {
  getCampaign,
  getCustomerOnboardingByCustomerId,
  listCustomerAssetsForCustomer,
  saveBillingCustomer,
  saveCustomerOnboarding
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = CustomerCampaignGenerateSchema.safeParse({
    customerId: url.searchParams.get("customerId") ?? "",
    accessToken: url.searchParams.get("accessToken") ?? ""
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer portal request.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal(parsed.data);
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const onboarding = await getCustomerOnboardingByCustomerId(customer.id);
  const campaigns = await Promise.all(
    (onboarding?.generatedCampaignIds ?? []).slice(0, 3).map(async (id) => {
      const campaign = await getCampaign(id);
      return campaign ? { id, campaign: toPublicCampaign(campaign) } : null;
    })
  );

  return NextResponse.json({
    ok: true,
    onboarding,
    campaigns: campaigns.filter(Boolean)
  });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = CustomerCampaignGenerateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer portal request.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal(parsed.data);
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  if (!["active", "trialing", "manual-review"].includes(customer.status)) {
    return NextResponse.json(
      { error: "Payment activation is not complete yet. Refresh after checkout confirmation or contact VIDSLOOM." },
      { status: 402 }
    );
  }

  const onboarding = await getCustomerOnboardingByCustomerId(customer.id);
  if (!onboarding) {
    return NextResponse.json({ error: "Submit the onboarding brief before generating a campaign pack." }, { status: 400 });
  }

  const profile = planDeliveryProfile(customer.plan);
  const customerAssets = await listCustomerAssetsForCustomer(customer.id, 200);
  const intake = onboardingToCampaignIntake(customer, {
    ...onboarding,
    platforms: onboarding.platforms.slice(0, profile.platforms)
  }, customerAssets);
  const campaign = await createCampaignDraft(intake, {
    customerId: customer.id,
    source: "customer-portal",
    customerAssets
  });
  const planningQueue = await enqueueCampaignPlanning({
    campaignId: campaign.id,
    origin: publicUrl(request, "/").origin
  }).catch((error) => ({
    queued: false,
    mode: "manual" as const,
    reason: error instanceof Error ? error.message : "Planning queue failed."
  }));
  const now = new Date().toISOString();

  const updatedOnboarding = await saveCustomerOnboarding({
    ...onboarding,
    updatedAt: now,
    status: "first-pack-generated",
    generatedCampaignIds: [campaign.id, ...onboarding.generatedCampaignIds.filter((id) => id !== campaign.id)].slice(0, 20)
  });

  await saveBillingCustomer({
    ...customer,
    updatedAt: now,
    onboardingStatus: "ready-for-production",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "note" as const,
        summary: `Customer campaign planning queued: ${campaign.id}.`,
        stripeEventId: ""
      },
      ...customer.events
    ].slice(0, 80)
  });

  return NextResponse.json({
    ok: true,
    campaignId: campaign.id,
    onboarding: updatedOnboarding,
    campaign: toPublicCampaign(campaign),
    planningQueue
  });
}
