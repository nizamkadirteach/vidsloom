import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { authorizeCustomerPortal, buildCustomerPortalUrl } from "@/lib/customer-access";
import { buildCustomerOnboarding } from "@/lib/customer-onboarding";
import { createId } from "@/lib/id";
import { CustomerOnboardingUpdateSchema } from "@/lib/schemas";
import { triggerCustomerOnboardingNotifications } from "@/lib/sendgrid";
import { getCustomerOnboardingByCustomerId, saveBillingCustomer, saveCustomerOnboarding } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = CustomerOnboardingUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding brief.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal({
    customerId: parsed.data.customerId,
    accessToken: parsed.data.accessToken
  });
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const existing = await getCustomerOnboardingByCustomerId(customer.id);
  const onboarding = buildCustomerOnboarding({
    customer,
    input: parsed.data,
    existing
  });
  await saveCustomerOnboarding(onboarding);

  const now = new Date().toISOString();
  await saveBillingCustomer({
    ...customer,
    updatedAt: now,
    onboardingStatus: "in-progress",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "note" as const,
        summary: "Customer onboarding brief submitted.",
        stripeEventId: ""
      },
      ...customer.events
    ].slice(0, 80)
  });

  const origin = publicUrl(request, "/").origin;
  const notifications = await triggerCustomerOnboardingNotifications({
    customer,
    onboarding,
    portalUrl: buildCustomerPortalUrl(origin, customer)
  });

  return NextResponse.json({ ok: true, onboarding, notifications });
}
