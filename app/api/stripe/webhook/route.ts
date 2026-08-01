import { NextResponse } from "next/server";

import { createPortalAccessToken } from "@/lib/customer-access";
import { createId } from "@/lib/id";
import { applyLeadSalesUpdate } from "@/lib/lead-pipeline";
import { BillingCustomer, BillingCustomerSchema, CheckoutPlanSchema, StripeEventSchema } from "@/lib/schemas";
import { getCheckoutPlan, verifyStripeSignature } from "@/lib/stripe";
import {
  getBillingCustomerByCheckoutSessionId,
  getBillingCustomerBySubscriptionId,
  getLead,
  getStripeEvent,
  saveBillingCustomer,
  saveLead,
  saveStripeEvent
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeEventPayload = {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: Record<string, unknown>;
  };
};

type ProcessStripeEventResult = {
  status: "processed" | "ignored";
  summary: string;
  checkoutSessionId?: string;
  subscriptionId?: string;
  customerId?: string;
};

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured on this environment." }, { status: 503 });
  }

  const payload = await request.text();
  const verified = verifyStripeSignature({
    payload,
    signatureHeader: request.headers.get("stripe-signature"),
    secret: webhookSecret
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEventPayload;
  const existing = await getStripeEvent(event.id);
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await processStripeEvent(event);
    await saveStripeEvent(
      StripeEventSchema.parse({
        id: event.id,
        createdAt: stripeTimestampToIso(event.created),
        processedAt: new Date().toISOString(),
        type: event.type,
        status: result.status,
        summary: result.summary,
        checkoutSessionId: result.checkoutSessionId ?? "",
        subscriptionId: result.subscriptionId ?? "",
        customerId: result.customerId ?? ""
      })
    );

    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    await saveStripeEvent(
      StripeEventSchema.parse({
        id: event.id,
        createdAt: stripeTimestampToIso(event.created),
        processedAt: new Date().toISOString(),
        type: event.type,
        status: "failed",
        summary: "Stripe webhook processing failed.",
        error: error instanceof Error ? error.message : "Unknown Stripe webhook error."
      })
    );

    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }
}

async function processStripeEvent(event: StripeEventPayload): Promise<ProcessStripeEventResult> {
  const object = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    return handleCheckoutCompleted(event.id, object);
  }

  if (event.type === "customer.subscription.updated") {
    return handleSubscriptionUpdated(event.id, object);
  }

  if (event.type === "customer.subscription.deleted") {
    return handleSubscriptionCancelled(event.id, object);
  }

  if (event.type === "invoice.payment_failed") {
    return handleInvoicePaymentFailed(event.id, object);
  }

  return {
    status: "ignored" as const,
    summary: `Ignored Stripe event ${event.type}.`,
    checkoutSessionId: String(object.id ?? ""),
    subscriptionId: String(object.subscription ?? ""),
    customerId: String(object.customer ?? "")
  };
}

async function handleCheckoutCompleted(stripeEventId: string, session: Record<string, unknown>) {
  const metadata = readMetadata(session);
  const existing = await getBillingCustomerByCheckoutSessionId(String(session.id ?? ""));
  const planId = CheckoutPlanSchema.safeParse(metadata.plan).success
    ? CheckoutPlanSchema.parse(metadata.plan)
    : existing?.plan === "growth"
      ? "growth"
      : "starter";
  const plan = getCheckoutPlan(planId);
  const now = new Date().toISOString();
  const amountTotal = readNumber(session.amount_total) || existing?.amountTotal || plan.amountCents;
  const leadId = metadata.leadId || existing?.leadId || "";
  const customer = BillingCustomerSchema.parse({
    id: existing?.id ?? createId("cust"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    email: metadata.email || readCustomerEmail(session) || existing?.email,
    contactName: metadata.contactName || readCustomerName(session) || existing?.contactName || "VIDSLOOM customer",
    businessName: metadata.businessName || existing?.businessName || "VIDSLOOM customer",
    phone: metadata.phone || existing?.phone || "",
    plan: planId,
    status: readString(session.payment_status) === "paid" ? "active" : "manual-review",
    source: existing?.source ?? "webhook",
    leadId,
    stripeCustomerId: readString(session.customer) || existing?.stripeCustomerId || "",
    stripeCheckoutSessionId: readString(session.id) || existing?.stripeCheckoutSessionId || "",
    stripeSubscriptionId: readString(session.subscription) || existing?.stripeSubscriptionId || "",
    stripePriceId: existing?.stripePriceId || "",
    amountTotal,
    currency: readString(session.currency) || existing?.currency || plan.currency,
    mode: "subscription",
    onboardingStatus: "needs-intake",
    portalAccessToken: existing?.portalAccessToken || createPortalAccessToken(),
    portalLastAccessAt: existing?.portalLastAccessAt || "",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "checkout-completed",
        summary: `${plan.label} checkout completed.`,
        stripeEventId
      },
      ...(existing?.events ?? [])
    ].slice(0, 80)
  });

  await saveBillingCustomer(customer);
  await markLeadWonFromCheckout({ leadId, planLabel: plan.label, amountTotal });

  return {
    status: "processed" as const,
    summary: `${plan.label} checkout completed for ${customer.email}.`,
    checkoutSessionId: customer.stripeCheckoutSessionId,
    subscriptionId: customer.stripeSubscriptionId,
    customerId: customer.stripeCustomerId
  };
}

async function handleSubscriptionUpdated(stripeEventId: string, subscription: Record<string, unknown>) {
  const existing = await getBillingCustomerBySubscriptionId(readString(subscription.id));
  if (!existing) {
    return {
      status: "ignored" as const,
      summary: "Subscription update received before the customer record was available.",
      subscriptionId: readString(subscription.id),
      customerId: readString(subscription.customer)
    };
  }

  const stripeStatus = readString(subscription.status);
  const status = mapSubscriptionStatus(stripeStatus);
  const now = new Date().toISOString();
  await saveBillingCustomer({
    ...existing,
    updatedAt: now,
    status,
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "subscription-updated" as const,
        summary: `Subscription status changed to ${stripeStatus || status}.`,
        stripeEventId
      },
      ...existing.events
    ].slice(0, 80)
  });

  return {
    status: "processed" as const,
    summary: `Subscription status updated to ${status}.`,
    subscriptionId: existing.stripeSubscriptionId,
    customerId: existing.stripeCustomerId
  };
}

async function handleSubscriptionCancelled(stripeEventId: string, subscription: Record<string, unknown>) {
  const existing = await getBillingCustomerBySubscriptionId(readString(subscription.id));
  if (!existing) {
    return {
      status: "ignored" as const,
      summary: "Subscription cancellation received before the customer record was available.",
      subscriptionId: readString(subscription.id),
      customerId: readString(subscription.customer)
    };
  }

  const now = new Date().toISOString();
  await saveBillingCustomer({
    ...existing,
    updatedAt: now,
    status: "cancelled",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "cancelled" as const,
        summary: "Subscription cancelled.",
        stripeEventId
      },
      ...existing.events
    ].slice(0, 80)
  });

  return {
    status: "processed" as const,
    summary: "Subscription cancelled.",
    subscriptionId: existing.stripeSubscriptionId,
    customerId: existing.stripeCustomerId
  };
}

async function handleInvoicePaymentFailed(stripeEventId: string, invoice: Record<string, unknown>) {
  const existing = await getBillingCustomerBySubscriptionId(readString(invoice.subscription));
  if (!existing) {
    return {
      status: "ignored" as const,
      summary: "Payment failure received before the customer record was available.",
      subscriptionId: readString(invoice.subscription),
      customerId: readString(invoice.customer)
    };
  }

  const now = new Date().toISOString();
  await saveBillingCustomer({
    ...existing,
    updatedAt: now,
    status: "payment-failed",
    events: [
      {
        id: createId("bill_event"),
        createdAt: now,
        type: "payment-failed" as const,
        summary: "Invoice payment failed; follow-up required.",
        stripeEventId
      },
      ...existing.events
    ].slice(0, 80)
  });

  return {
    status: "processed" as const,
    summary: "Invoice payment failed.",
    subscriptionId: existing.stripeSubscriptionId,
    customerId: existing.stripeCustomerId
  };
}

async function markLeadWonFromCheckout({
  leadId,
  planLabel,
  amountTotal
}: {
  leadId: string;
  planLabel: string;
  amountTotal: number;
}) {
  if (!leadId) return;

  const lead = await getLead(leadId);
  if (!lead || lead.sales.status === "won") return;

  await saveLead(
    applyLeadSalesUpdate(lead, {
      status: "won",
      priority: "hot",
      closeProbability: 100,
      proposalAmount: Math.round(amountTotal / 100),
      eventType: "won",
      eventSummary: `Stripe checkout completed for VIDSLOOM ${planLabel}.`
    })
  );
}

function mapSubscriptionStatus(status: string): BillingCustomer["status"] {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "incomplete" || status === "past_due" || status === "unpaid") return "payment-failed";
  return "manual-review";
}

function readMetadata(object: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries((object.metadata ?? {}) as Record<string, unknown>).map(([key, value]) => [key, readString(value)])
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function readCustomerEmail(session: Record<string, unknown>) {
  const details = (session.customer_details ?? {}) as Record<string, unknown>;
  return readString(details.email);
}

function readCustomerName(session: Record<string, unknown>) {
  const details = (session.customer_details ?? {}) as Record<string, unknown>;
  return readString(details.name);
}

function stripeTimestampToIso(timestamp?: number) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}
