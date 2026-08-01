"use client";

import { BadgeCheck, CreditCard, Loader2, LockKeyhole, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type CheckoutPlanView = {
  id: "starter" | "growth";
  label: string;
  price: string;
  description: string;
};

type ApiIssue = {
  path?: Array<string | number>;
  message: string;
};

export function CheckoutForm({
  plan,
  defaults
}: {
  plan: CheckoutPlanView;
  defaults?: {
    email?: string;
    contactName?: string;
    businessName?: string;
    phone?: string;
    leadId?: string;
  };
}) {
  const [form, setForm] = useState({
    email: defaults?.email ?? "",
    contactName: defaults?.contactName ?? "",
    businessName: defaults?.businessName ?? "",
    phone: defaults?.phone ?? "",
    leadId: defaults?.leadId ?? "",
    accepted: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          email: form.email,
          contactName: form.contactName,
          businessName: form.businessName,
          phone: form.phone,
          leadId: form.leadId,
          source: form.leadId ? "lead" : "checkout"
        })
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string; issues?: ApiIssue[] };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(formatApiError(data, "Checkout could not be started."));
      }
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown checkout error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="checkoutForm" id="checkout-form" onSubmit={submit}>
      <div className="checkoutFormHeader">
        <span>
          <LockKeyhole size={16} />
          Secure monthly checkout
        </span>
        <h2>{plan.label}</h2>
        <strong>{plan.price}</strong>
        <p>{plan.description}</p>
      </div>

      <div className="checkoutTrustBadges" aria-label="Checkout trust signals">
        <span>
          <CreditCard size={15} />
          Secure card checkout
        </span>
        <span>
          <ShieldCheck size={15} />
          Connected-account permissions; no social passwords
        </span>
        <span>
          <RefreshCcw size={15} />
          First-cycle quality review
        </span>
        <span>
          <BadgeCheck size={15} />
          Cancel before the next renewal
        </span>
      </div>

      <div className="checkoutFields">
        <label>
          <span>
            Your name <em aria-hidden="true">*</em>
          </span>
          <input
            autoComplete="name"
            value={form.contactName}
            onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>
            Business name <em aria-hidden="true">*</em>
          </span>
          <input
            autoComplete="organization"
            value={form.businessName}
            onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>
            Email <em aria-hidden="true">*</em>
          </span>
          <input
            autoComplete="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>Phone or WhatsApp <small>optional</small></span>
          <input
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </label>
      </div>

      <label className="checkoutConsent">
        <input
          type="checkbox"
          checked={form.accepted}
          onChange={(event) => setForm((current) => ({ ...current, accepted: event.target.checked }))}
          required
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank">
            Terms
          </Link>
          ,{" "}
          <Link href="/privacy" target="_blank">
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/refund" target="_blank">
            Refund Policy
          </Link>
          . This starts a recurring monthly VIDSLOOM subscription. Production stays approval-first before publishing.{" "}
          <em aria-hidden="true">*</em>
        </span>
      </label>

      {error ? (
        <p className="leadError" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <button className="siteButton primarySiteButton checkoutSubmit" disabled={loading} type="submit">
        {loading ? <Loader2 className="spin" size={18} /> : <CreditCard size={18} />}
        {loading ? "Opening checkout" : `Subscribe now - ${plan.price}`}
      </button>
      <div className="checkoutDeliverables" aria-label="What happens after checkout">
        <strong>Before your first renewal, VIDSLOOM will prepare:</strong>
        <ul>
          <li>Business brief, proof checklist, and campaign direction</li>
          <li>Finished videos with captions, thumbnails, CTAs, and schedule windows</li>
          <li>Approval queue with edit requests, pause controls, and optional posting support</li>
          <li>First-cycle quality review if the agreed brief is missed after revision</li>
        </ul>
      </div>
      <div className="checkoutOauthNotice">
        <LockKeyhole size={17} />
        <p>
          Optional auto-posting only starts after you connect each social account through its permission flow and approve
          publishing rules. VIDSLOOM requests only the permissions needed to prepare or publish approved content and
          does not ask for your social passwords.
        </p>
      </div>
      <p className="checkoutPolicyReminder">
        Policy links:{" "}
        <Link href="/privacy" target="_blank">
          Privacy
        </Link>
        ,{" "}
        <Link href="/terms" target="_blank">
          Terms
        </Link>
        ,{" "}
        <Link href="/refund" target="_blank">
          Refund Policy
        </Link>
        .
      </p>
    </form>
  );
}

function formatApiError(data: { error?: string; issues?: ApiIssue[] }, fallback: string) {
  const firstIssue = data.issues?.[0];
  if (!firstIssue) return data.error ?? fallback;

  const path = firstIssue.path?.length ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}
