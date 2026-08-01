import { NextResponse } from "next/server";

import { publicUrl } from "@/lib/auth";
import { createPortalAccessToken } from "@/lib/customer-access";
import { createId } from "@/lib/id";
import { CheckoutCreateSchema, BillingCustomerSchema } from "@/lib/schemas";
import { createStripeCheckoutSession, getCheckoutPlan } from "@/lib/stripe";
import { saveBillingCustomer } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = CheckoutCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request.", issues: parsed.error.issues }, { status: 400 });
  }

  const origin = publicUrl(request, "/").origin;
  const result = await createStripeCheckoutSession(parsed.data, origin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (!result.session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const plan = getCheckoutPlan(parsed.data.plan);
  const portalAccessToken = createPortalAccessToken();
  const customer = BillingCustomerSchema.parse({
    id: createId("cust"),
    createdAt: now,
    updatedAt: now,
    email: parsed.data.email.trim().toLowerCase(),
    contactName: parsed.data.contactName,
    businessName: parsed.data.businessName,
    phone: parsed.data.phone ?? "",
    plan: parsed.data.plan,
    status: "checkout-started",
    source: parsed.data.source,
    leadId: parsed.data.leadId ?? "",
    stripeCustomerId: result.session.customer ?? "",
    stripeCheckoutSessionId: result.session.id,
    stripeSubscriptionId: result.session.subscription ?? "",
    stripePriceId: result.priceId,
    amountTotal: result.session.amount_total ?? plan.amountCents,
    currency: result.session.currency ?? plan.currency,
    mode: "subscription",
    onboardingStatus: "needs-intake",
    portalAccessToken,
    portalLastAccessAt: "",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "checkout-created",
        summary: `${plan.label} checkout session created.`
      }
    ]
  });

  await saveBillingCustomer(customer);

  return NextResponse.json({
    ok: true,
    checkoutUrl: result.session.url,
    sessionId: result.session.id,
    customerId: customer.id
  });
}
