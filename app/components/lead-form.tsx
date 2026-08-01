"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { FormEvent, useState } from "react";

import type { LeadCreate } from "@/lib/schemas";

type ApiIssue = {
  path?: Array<string | number>;
  message: string;
};

const defaultLead: LeadCreate = {
  source: "growth-audit",
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  industry: "",
  goal: "",
  currentContent: "",
  platforms: ["Instagram Reels"],
  monthlyBudget: "not-sure",
  urgency: "this-month",
  preferredContact: "Email",
  newsletterOptIn: false,
  consentToContact: false
};

const platformOptions: LeadCreate["platforms"][number][] = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "LinkedIn",
  "Facebook Reels",
  "X"
];

const budgetOptions: Array<{ value: LeadCreate["monthlyBudget"]; label: string }> = [
  { value: "not-sure", label: "Not sure yet" },
  { value: "under-500", label: "Under S$500/month" },
  { value: "500-1500", label: "S$500-S$1,500/month" },
  { value: "1500-5000", label: "S$1,500-S$5,000/month" },
  { value: "5000-plus", label: "S$5,000+/month" }
];

const urgencyOptions: Array<{ value: LeadCreate["urgency"]; label: string }> = [
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "exploring", label: "Exploring options" }
];

export function LeadForm({
  source = "growth-audit",
  title = "Request your video growth audit",
  compact = false
}: {
  source?: LeadCreate["source"];
  title?: string;
  compact?: boolean;
}) {
  const [lead, setLead] = useState<LeadCreate>({ ...defaultLead, source });
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof LeadCreate>(key: K, value: LeadCreate[K]) {
    setLead((current) => ({ ...current, [key]: value }));
  }

  function togglePlatform(platform: LeadCreate["platforms"][number]) {
    setLead((current) => {
      const exists = current.platforms.includes(platform);
      const platforms = exists ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];

      return {
        ...current,
        platforms: platforms.length ? platforms : current.platforms
      };
    });
  }

  function checkoutHref(plan: "starter" | "growth") {
    const params = new URLSearchParams({
      plan,
      leadId: submittedId ?? "",
      email: lead.email,
      contactName: lead.contactName,
      businessName: lead.businessName,
      phone: lead.phone ?? ""
    });

    return `/checkout?${params.toString()}`;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead)
      });
      const data = (await response.json()) as { lead?: { id: string }; error?: string; issues?: ApiIssue[] };
      if (!response.ok || !data.lead) {
        throw new Error(formatApiError(data, "Lead submission failed."));
      }
      setSubmittedId(data.lead.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  if (submittedId) {
    return (
      <div className="leadSuccess">
        <CheckCircle2 size={28} />
        <h3>Request received</h3>
        <p>
          We captured your brief. The next step is a short review of your offer, current content, and best first
          campaign angle.
        </p>
        <span>Reference: {submittedId}</span>
        <div className="leadSuccessActions">
          <a className="siteButton primarySiteButton" href={checkoutHref("growth")}>
            Start Growth now
          </a>
          <a className="siteButton lightSiteButton" href={checkoutHref("starter")}>
            Start Starter
          </a>
        </div>
        <p className="leadSuccessFinePrint">
          Starting now is optional. The free audit still runs first, and the first paid cycle includes approval-first
          production, quality review, and clear posting rules.
        </p>
      </div>
    );
  }

  return (
    <form className={compact ? "leadForm leadFormCompact" : "leadForm"} onSubmit={submit}>
      <div className="leadFormHeader">
        <h3>{title}</h3>
        <p>One-minute request. Give enough context for a useful video plan; platform permissions can wait.</p>
      </div>

      <div className="leadFields">
        <label>
          <span>
            Your name <em aria-hidden="true">*</em>
          </span>
          <input value={lead.contactName} onChange={(event) => update("contactName", event.target.value)} required />
        </label>
        <label>
          <span>
            Email <em aria-hidden="true">*</em>
          </span>
          <input type="email" value={lead.email} onChange={(event) => update("email", event.target.value)} required />
        </label>
        <label>
          <span>
            Business name <em aria-hidden="true">*</em>
          </span>
          <input value={lead.businessName} onChange={(event) => update("businessName", event.target.value)} required />
        </label>
        <label>
          <span>
            Business type <em aria-hidden="true">*</em>
          </span>
          <input
            value={lead.industry}
            onChange={(event) => update("industry", event.target.value)}
            placeholder="Restaurant, clinic, ecommerce, coach"
            required
          />
        </label>
        <label>
          <span>Website or social link <small>optional</small></span>
          <input
            value={lead.website ?? ""}
            onChange={(event) => update("website", event.target.value)}
            placeholder="https:// or @handle"
          />
        </label>
        <label>
          <span>Phone or WhatsApp <small>optional</small></span>
          <input value={lead.phone ?? ""} onChange={(event) => update("phone", event.target.value)} />
        </label>
        <label>
          <span>
            Best follow-up channel <em aria-hidden="true">*</em>
          </span>
          <select
            value={lead.preferredContact}
            onChange={(event) => update("preferredContact", event.target.value as LeadCreate["preferredContact"])}
          >
            <option value="Email">Email</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="Phone">Phone</option>
          </select>
        </label>
        <label>
          <span>
            How soon do you want to move? <em aria-hidden="true">*</em>
          </span>
          <select value={lead.urgency} onChange={(event) => update("urgency", event.target.value as LeadCreate["urgency"])}>
            {urgencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Monthly content budget <em aria-hidden="true">*</em>
          </span>
          <select
            value={lead.monthlyBudget}
            onChange={(event) => update("monthlyBudget", event.target.value as LeadCreate["monthlyBudget"])}
          >
            {budgetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="leadWide">
          <span>
            Main goal <em aria-hidden="true">*</em>
          </span>
          <textarea
            value={lead.goal}
            onChange={(event) => update("goal", event.target.value)}
            placeholder="Example: more appointment bookings, trial signups, WhatsApp enquiries, ecommerce sales"
            required
          />
        </label>
        <label className="leadWide">
          <span>Current content, proof, or assets <small>optional</small></span>
          <textarea
            value={lead.currentContent ?? ""}
            onChange={(event) => update("currentContent", event.target.value)}
            placeholder="Reviews, before/after proof, product photos, menu, service pages, existing reels, testimonials, FAQs"
          />
        </label>
      </div>

      <div className="leadPlatformGroup">
        <span>
          Priority platforms <em aria-hidden="true">*</em>
        </span>
        <div>
          {platformOptions.map((platform) => (
            <label key={platform} className={lead.platforms.includes(platform) ? "leadPlatform active" : "leadPlatform"}>
              <input type="checkbox" checked={lead.platforms.includes(platform)} onChange={() => togglePlatform(platform)} />
              {platform}
            </label>
          ))}
        </div>
      </div>

      <p className="leadMicrocopy">
        Direct posting setup happens only after fit is clear, the customer approves publish rules, and the required
        social-account permissions are connected.
      </p>

      <label className="leadConsent">
        <input
          type="checkbox"
          checked={lead.consentToContact}
          onChange={(event) => update("consentToContact", event.target.checked)}
          required
        />
        <span>
          I agree to be contacted about a VIDSLOOM audit or pilot. <em aria-hidden="true">*</em>
        </span>
      </label>

      <label className="leadConsent">
        <input
          type="checkbox"
          checked={lead.newsletterOptIn}
          onChange={(event) => update("newsletterOptIn", event.target.checked)}
        />
        <span>Send me practical weekly trend notes and video ideas for business owners.</span>
      </label>

      {error ? (
        <p className="leadError" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <button className="siteButton primarySiteButton leadSubmit" disabled={loading} type="submit">
        {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
        {loading ? "Sending request" : "Request free video audit"}
      </button>
    </form>
  );
}

function formatApiError(data: { error?: string; issues?: ApiIssue[] }, fallback: string) {
  const firstIssue = data.issues?.[0];
  if (!firstIssue) return data.error ?? fallback;

  const path = firstIssue.path?.length ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}
