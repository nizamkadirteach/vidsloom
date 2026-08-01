import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { PublishingActionRequestSchema } from "@/lib/schemas";
import { executePublishingAction, listCampaignPublishingAttempts } from "@/lib/social-posting";
import { getCampaign } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = PublishingActionRequestSchema.extend({
    campaignId: PublishingActionRequestSchema.shape.taskKey
  }).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publishing action.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal({
    customerId: parsed.data.customerId,
    accessToken: parsed.data.accessToken
  });
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const campaign = await getCampaign(parsed.data.campaignId);
  if (!campaign || campaign.customerId !== customer.id) {
    return NextResponse.json({ error: "Campaign pack is not available for this customer." }, { status: 404 });
  }

  try {
    const attempt = await executePublishingAction({
      campaignId: campaign.id,
      taskKey: parsed.data.taskKey,
      method: parsed.data.method,
      origin: publicUrl(request, "/").origin,
      requestedBy: "customer",
      customerId: customer.id
    });
    return NextResponse.json({ ok: true, attempt }, { status: attempt.status === "blocked" ? 409 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publishing action failed." },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") ?? "";
  const accessToken = url.searchParams.get("accessToken") ?? "";
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const customer = await authorizeCustomerPortal({ customerId, accessToken });
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.customerId !== customer.id) {
    return NextResponse.json({ error: "Campaign pack is not available for this customer." }, { status: 404 });
  }

  const attempts = await listCampaignPublishingAttempts(campaign.id, customer.id);
  return NextResponse.json({ attempts });
}
