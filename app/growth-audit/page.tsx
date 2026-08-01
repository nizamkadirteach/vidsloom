import { ArrowLeft, CheckCircle2, Clock, Mail, MessageCircle, PhoneCall, Sparkles, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LeadForm } from "@/app/components/lead-form";
import { getPublicContactActions } from "@/lib/contact-actions";

export const dynamic = "force-dynamic";

const auditSteps = [
  "Review your offer, audience, proof, and highest-value conversion action.",
  "Identify the first short-form formats most likely to create enquiries, bookings, sales, or warm follow-up.",
  "Map the first production queue: video concepts, hooks, captions, CTAs, schedule windows, and approval blockers."
];

export default function GrowthAuditPage() {
  const contactActions = getPublicContactActions();
  const hasInstantContact = Boolean(contactActions.whatsappUrl || contactActions.smsUrl || contactActions.mailtoUrl);

  return (
    <main className="siteShell funnelPage">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
        <nav>
          <Link href="/">
            <ArrowLeft size={16} />
            Home
          </Link>
          <Link href="/pilot">Pilot</Link>
          <Link className="navAction" href="/workspace-demo">
            <Sparkles size={17} />
            Demo
          </Link>
        </nav>
      </header>

      <section className="funnelHero">
        <div className="funnelIntro">
          <p className="siteEyebrow">Free Video Growth Audit</p>
          <h1>Map your first video campaign.</h1>
          <p>
            Tell us what you sell, who you want to reach, and what outcome matters most. VIDSLOOM will map the first
            useful video angles, captions, CTAs, and posting windows before asking for budgets, assets, or account
            permissions.
          </p>
          <div className="auditPromise">
            <span>
              <Clock size={18} />
              First campaign direction in 48 hours
            </span>
            <span>
              <TrendingUp size={18} />
              Trend-aware, not trend-chasing
            </span>
          </div>
          <div className="heroActions funnelHeroActions">
            <a className="siteButton primarySiteButton" href="#audit-form">
              <Sparkles size={18} />
              Request free audit
            </a>
          </div>
          <div className="auditSteps">
            {auditSteps.map((step) => (
              <p key={step}>
                <CheckCircle2 size={18} />
                {step}
              </p>
            ))}
          </div>
          {hasInstantContact ? (
            <div className="funnelContact">
              <span>Prefer direct contact?</span>
              {contactActions.whatsappUrl ? (
                <a href={contactActions.whatsappUrl}>
                  <MessageCircle size={17} />
                  WhatsApp
                </a>
              ) : null}
              {contactActions.smsUrl ? (
                <a href={contactActions.smsUrl}>
                  <PhoneCall size={17} />
                  SMS
                </a>
              ) : null}
              {contactActions.mailtoUrl ? (
                <a href={contactActions.mailtoUrl}>
                  <Mail size={17} />
                  Email
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div id="audit-form">
          <LeadForm source="growth-audit" title="Request your free video audit" />
        </div>
      </section>
    </main>
  );
}
