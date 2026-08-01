import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { createId } from "@/lib/id";
import { enqueueApprovedPublishingTasks } from "@/lib/publishing-jobs";
import {
  CustomerCampaignReviewSchema,
  CustomerCampaignReviewUpdateSchema,
  CustomerCampaignOverallStatusSchema,
  type CustomerCampaignReviewUpdate
} from "@/lib/schemas";
import {
  getCampaign,
  getCustomerCampaignReview,
  getCustomerOnboardingByCustomerId,
  saveBillingCustomer,
  saveCustomerCampaignReview
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = CustomerCampaignReviewUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign review.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal({
    customerId: parsed.data.customerId,
    accessToken: parsed.data.accessToken
  });
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const campaign = await getCampaign(parsed.data.campaignId);
  const onboarding = await getCustomerOnboardingByCustomerId(customer.id);
  const isGeneratedForCustomer =
    campaign?.customerId === customer.id || Boolean(onboarding?.generatedCampaignIds.includes(parsed.data.campaignId));
  if (!campaign || !isGeneratedForCustomer) {
    return NextResponse.json({ error: "Campaign pack is not available for this customer." }, { status: 404 });
  }

  const gateError = validateReviewAgainstCampaignGate(campaign, parsed.data);
  if (gateError) {
    return NextResponse.json(gateError, { status: 409 });
  }

  const existing = await getCustomerCampaignReview(customer.id, parsed.data.campaignId);
  const now = new Date().toISOString();
  const { accessToken: _accessToken, ...reviewInput } = parsed.data;
  const review = CustomerCampaignReviewSchema.parse({
    ...reviewInput,
    id: existing?.id ?? createId("review"),
    customerId: customer.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    overallStatus: deriveOverallStatus(parsed.data)
  });

  const savedReview = await saveCustomerCampaignReview(review);
  await saveBillingCustomer({
    ...customer,
    updatedAt: now,
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "note" as const,
        summary: `Customer review updated for campaign ${campaign.id}: ${savedReview.overallStatus}.`,
        stripeEventId: ""
      },
      ...customer.events
    ].slice(0, 80)
  });

  try {
    const publishingAutomation = await enqueueApprovedPublishingTasks({
      review: savedReview,
      campaign,
      onboarding,
      origin: publicUrl(request, "/").origin
    });

    return NextResponse.json({
      ok: true,
      review: publishingAutomation.review,
      publishingAutomation: publishingAutomation.results
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      review: savedReview,
      publishingAutomation: [
        {
          queued: false,
          reason: error instanceof Error ? error.message : "Publishing automation could not be queued."
        }
      ]
    });
  }
}

function validateReviewAgainstCampaignGate(campaign: NonNullable<Awaited<ReturnType<typeof getCampaign>>>, input: CustomerCampaignReviewUpdate) {
  const conceptsByTitle = new Map(campaign.pack.videoConcepts.map((concept) => [concept.title, concept]));

  for (const row of input.videoReviews) {
    const concept = conceptsByTitle.get(row.conceptTitle);
    if (!concept) continue;
    const gate = concept.qualityGate;
    if (row.status === "approved" && gate.status === "blocked") {
      return {
        error: "This concept cannot be approved yet because the quality gate is blocked.",
        conceptTitle: row.conceptTitle,
        blockers: gate.publishBlockers,
        nextActions: gate.nextActions
      };
    }
  }

  for (const row of input.publishingReviews) {
    const task = campaign.pack.publishingQueue.find((item) => item.conceptTitle === row.conceptTitle);
    const concept = conceptsByTitle.get(row.conceptTitle);
    const gate = concept?.qualityGate;
    if (!gate) continue;
    if (["ready-to-schedule", "scheduled"].includes(row.status) && gate.status !== "pass") {
      return {
        error: "This post cannot be marked ready or scheduled until the proof, claim, storyboard, and QA gate pass.",
        conceptTitle: row.conceptTitle || task?.conceptTitle || "",
        qualityGate: gate.status,
        score: gate.score,
        minPublishScore: gate.minPublishScore,
        blockers: gate.publishBlockers,
        nextActions: gate.nextActions
      };
    }
  }

  return null;
}

function deriveOverallStatus(input: CustomerCampaignReviewUpdate) {
  const statuses = [...input.videoReviews.map((item) => item.status), ...input.publishingReviews.map((item) => item.status)];
  if (!statuses.length || statuses.some((status) => status === "needs-review")) {
    return CustomerCampaignOverallStatusSchema.parse("needs-review");
  }

  if (statuses.some((status) => status === "blocked")) {
    return CustomerCampaignOverallStatusSchema.parse("blocked");
  }

  if (statuses.some((status) => status === "changes-requested" || status === "regenerate")) {
    return CustomerCampaignOverallStatusSchema.parse("changes-requested");
  }

  const publishingStatuses = input.publishingReviews.map((item) => item.status);
  if (publishingStatuses.length && publishingStatuses.every((status) => status === "scheduled")) {
    return CustomerCampaignOverallStatusSchema.parse("scheduled");
  }

  if (
    input.videoReviews.length &&
    input.videoReviews.every((item) => item.status === "approved") &&
    publishingStatuses.some((status) => status === "ready-to-schedule" || status === "scheduled")
  ) {
    return CustomerCampaignOverallStatusSchema.parse("ready-to-schedule");
  }

  return CustomerCampaignOverallStatusSchema.parse("approved");
}
