import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Film,
  Mail,
  MessageCircle,
  PhoneCall,
  Sparkles,
  TrendingUp
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LeadForm } from "@/app/components/lead-form";
import { getPublicContactActions } from "@/lib/contact-actions";

export const dynamic = "force-dynamic";

const pilotDeliverables = [
  {
    icon: TrendingUp,
    title: "Growth audit",
    text: "Clarify your offer, target buyer, current content bottleneck, and fastest conversion action."
  },
  {
    icon: Film,
    title: "Sample campaign pack",
    text: "Receive 5 bespoke video concepts with hooks, scripts, captions, thumbnail frames, CTAs, and posting times."
  },
  {
    icon: CalendarCheck,
    title: "Approval queue",
    text: "Approve or edit your queue; posts can be scheduled automatically once each account is connected."
  }
];

const operatingRules = [
  "Organic-first testing before paid boosting",
  "Customer chooses video length: 10, 15, 20, 30, 45, or 60 seconds",
  "Premium production available for hero clips and higher-consideration offers",
  "Use customer-owned assets wherever possible",
  "No auto-posting until social account permissions are connected",
  "Owner approvals stay simple: approve, request changes, or block"
];

export default function PilotPage() {
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
          <Link href="/growth-audit">Audit</Link>
          <Link className="navAction" href="/workspace-demo">
            <Sparkles size={17} />
            Demo
          </Link>
        </nav>
      </header>

      <section className="pilotHero">
        <div className="pilotHeroText">
          <p className="siteEyebrow">Founding Pilot</p>
          <h1>Launch your AI video engine without hiring a full creative team.</h1>
          <p>
            We review your offer, target customer, proof, and content library, then create a sample campaign pack and
            approval rhythm. Intro packages start from S$390/month for 4 finished videos per month after the free pilot.
          </p>
          <div className="pilotMeta">
            <span>
              <Clock size={18} />
              Fast first review
            </span>
            <span>
              <BadgeCheck size={18} />
              Approval-first
            </span>
          </div>
          {hasInstantContact ? (
            <div className="funnelContact">
              <span>Talk now:</span>
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

        <LeadForm source="pilot" title="Apply for the founding pilot" />
      </section>

      <section className="pilotDetailBand">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">What You Get</p>
              <h2>Enough structure to move fast, enough control to protect your brand.</h2>
            </div>
            <Link className="siteButton lightSiteButton" href="/growth-audit">
              Start with audit
            </Link>
          </div>
          <div className="proofGrid">
            {pilotDeliverables.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="proofCard">
                  <Icon size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="fitBand">
        <div className="sectionInner fitLayout">
          <div>
            <p className="siteEyebrow">Low Friction Setup</p>
            <h2>Start with email. Add WhatsApp, SMS, and auto-posting when each account is ready.</h2>
            <p>
              VIDSLOOM can create campaign packs immediately. Direct auto-posting is enabled only after the customer
              connects each social account and grants the required platform permissions. The first production settings
              are simple: preferred video length, quality level, proof assets, platforms, approval rule, and notification
              channel.
            </p>
          </div>
          <div className="fitList">
            {operatingRules.map((item) => (
              <p key={item}>
                <CheckCircle2 size={18} />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
