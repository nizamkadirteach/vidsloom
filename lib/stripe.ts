import "server-only";

import crypto from "node:crypto";

import type { CheckoutCreate, CheckoutPlan } from "@/lib/schemas";

type CheckoutSessionResponse = {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
};

type StripeApiError = {
  error?: {
    message?: string;
    type?: string;
  };
};

export const checkoutPlans: Record<
  CheckoutPlan,
  {
    id: CheckoutPlan;
    name: string;
    label: string;
    price: string;
    amountCents: number;
    currency: "sgd";
    description: string;
    bullets: string[];
    priceEnvKeys: string[];
  }
> = {
  starter: {
    id: "starter",
    name: "VIDSLOOM Starter",
    label: "Starter",
    price: "S$390/month intro",
    amountCents: 39000,
    currency: "sgd",
    description: "Monthly AI-generated short-form video production for one owner-led business.",
    bullets: [
      "4 finished short-form videos per month",
      "1 priority platform",
      "Captions, thumbnail frames, CTAs, and schedule windows",
      "Approval-first queue with first-cycle quality review"
    ],
    priceEnvKeys: ["STRIPE_PRICE_STARTER", "STRIPE_PLATFORM_PRICE_STARTER"]
  },
  growth: {
    id: "growth",
    name: "VIDSLOOM Growth",
    label: "Growth",
    price: "S$790/month intro",
    amountCents: 79000,
    currency: "sgd",
    description: "Higher-volume monthly video testing rhythm for businesses ready to scale content output.",
    bullets: [
      "10 finished short-form videos per month",
      "2 priority platforms",
      "Trend refresh, captions, thumbnail frames, CTAs, and schedule windows",
      "Organic winners prepared for paid reuse"
    ],
    priceEnvKeys: ["STRIPE_PRICE_GROWTH", "STRIPE_PRICE_PRO", "STRIPE_PLATFORM_PRICE_PRO"]
  }
};

export function getCheckoutPlan(plan: CheckoutPlan) {
  return checkoutPlans[plan];
}

export function getPlanPriceId(plan: CheckoutPlan) {
  if (process.env.STRIPE_USE_CONFIGURED_PRICE_IDS?.trim() !== "true") return "";

  const config = getCheckoutPlan(plan);
  for (const key of config.priceEnvKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function getStripeStatus() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const policy = stripeModePolicy(secretKey);
  return {
    configured: isUsableStripeSecretKey(secretKey) && policy.allowed,
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    starterPriceConfigured: Boolean(getPlanPriceId("starter")),
    growthPriceConfigured: Boolean(getPlanPriceId("growth")),
    usingConfiguredPriceIds: process.env.STRIPE_USE_CONFIGURED_PRICE_IDS?.trim() === "true",
    checkoutMode: "subscription",
    environmentPolicy: policy.policy,
    keyPolicyOk: policy.allowed
  };
}

export async function createStripeCheckoutSession(input: CheckoutCreate, origin: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !isUsableStripeSecretKey(secretKey)) {
    return {
      ok: false as const,
      status: 503,
      error: "Stripe checkout is not configured on this environment."
    };
  }
  const policy = stripeModePolicy(secretKey);
  if (!policy.allowed) {
    return {
      ok: false as const,
      status: 503,
      error: policy.error
    };
  }

  const plan = getCheckoutPlan(input.plan);
  const priceId = getPlanPriceId(input.plan);
  const successUrl = new URL("/checkout/success", origin);
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const stripeSuccessUrl = successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
  const cancelUrl = new URL("/checkout/cancel", origin);
  cancelUrl.searchParams.set("plan", input.plan);

  const body = new URLSearchParams({
    mode: "subscription",
    customer_email: input.email.trim().toLowerCase(),
    client_reference_id: input.leadId || input.email.trim().toLowerCase(),
    success_url: stripeSuccessUrl,
    cancel_url: cancelUrl.toString(),
    "payment_method_types[0]": "card",
    allow_promotion_codes: "true",
    "phone_number_collection[enabled]": "true",
    "metadata[plan]": input.plan,
    "metadata[source]": input.source,
    "metadata[businessName]": input.businessName,
    "metadata[contactName]": input.contactName,
    "metadata[email]": input.email.trim().toLowerCase(),
    "metadata[phone]": input.phone ?? "",
    "metadata[leadId]": input.leadId ?? "",
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][businessName]": input.businessName,
    "subscription_data[metadata][leadId]": input.leadId ?? ""
  });

  body.set("line_items[0][quantity]", "1");
  if (priceId) {
    body.set("line_items[0][price]", priceId);
  } else {
    body.set("line_items[0][price_data][currency]", plan.currency);
    body.set("line_items[0][price_data][unit_amount]", String(plan.amountCents));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", plan.name);
    body.set("line_items[0][price_data][product_data][description]", plan.description);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const json = (await response.json().catch(() => ({}))) as CheckoutSessionResponse & StripeApiError;
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: json.error?.message || `Stripe checkout failed with HTTP ${response.status}.`
    };
  }

  return {
    ok: true as const,
    session: json,
    priceId
  };
}

export function verifyStripeSignature({
  payload,
  signatureHeader,
  secret,
  toleranceSeconds = 300
}: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}) {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((accumulator, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return accumulator;
    accumulator[key] = [...(accumulator[key] ?? []), value];
    return accumulator;
  }, {});

  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 ?? [];
  if (!timestamp || !signatures.length) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

function timingSafeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isUsableStripeSecretKey(value: string) {
  return /^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(value);
}

function stripeModePolicy(secretKey: string) {
  const requireTestMode = process.env.STRIPE_REQUIRE_TEST_MODE === "true";
  const requireLiveMode = process.env.STRIPE_REQUIRE_LIVE_MODE === "true";
  const isTestKey = secretKey.startsWith("sk_test_");
  const isLiveKey = secretKey.startsWith("sk_live_");

  if (requireTestMode && !isTestKey) {
    return {
      allowed: false,
      policy: "test-required",
      error: "Stripe checkout requires a test-mode key on this environment."
    };
  }

  if (requireLiveMode && !isLiveKey) {
    return {
      allowed: false,
      policy: "live-required",
      error: "Stripe checkout requires a live-mode key on this environment."
    };
  }

  return {
    allowed: true,
    policy: requireTestMode ? "test-required" : requireLiveMode ? "live-required" : "none",
    error: ""
  };
}
