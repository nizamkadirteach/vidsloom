"use client";

import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

export function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [consentToEmail, setConsentToEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          businessName,
          source: "newsletter-page",
          tags: ["VIDSLOOM", "newsletter-page"],
          consentToEmail
        })
      });
      const data = (await response.json()) as { subscriber?: { id: string }; error?: string };
      if (!response.ok || !data.subscriber) {
        throw new Error(data.error ?? "Newsletter subscription failed.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Newsletter subscription failed.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="newsletterSignupSuccess">
        <CheckCircle2 size={30} />
        <h2>You are on the list.</h2>
        <p>Check your inbox for the welcome note. You can unsubscribe from any VIDSLOOM email.</p>
      </div>
    );
  }

  return (
    <form className="newsletterSignupForm" onSubmit={submit}>
      <label>
        <span>Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        <span>Business</span>
        <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
      </label>
      <label className="leadConsent">
        <input
          type="checkbox"
          checked={consentToEmail}
          onChange={(event) => setConsentToEmail(event.target.checked)}
          required
        />
        <span>Send me VIDSLOOM trend notes and practical video ideas. I can unsubscribe anytime.</span>
      </label>
      {error ? <p className="leadError">{error}</p> : null}
      <button className="siteButton primarySiteButton" disabled={loading} type="submit">
        {loading ? <Loader2 className="spin" size={18} /> : <Mail size={18} />}
        {loading ? "Joining" : "Join the trend notes"}
      </button>
    </form>
  );
}
