import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CheckoutForm } from "@/app/components/checkout-form";
import { checkoutPlans } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedPlan = params.plan === "growth" ? "growth" : "starter";
  const plan = checkoutPlans[selectedPlan];
  const leadId = singleParam(params.leadId);

  return (
    <main className="siteShell checkoutPage">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
        <nav>
          <Link href="/#pricing">
            <ArrowLeft size={16} />
            Pricing
          </Link>
          <Link href="/growth-audit">
            <Sparkles size={17} />
            Audit first
          </Link>
        </nav>
      </header>

      <section className="checkoutLayout">
        <div className="checkoutIntro">
          <p className="siteEyebrow">Start VIDSLOOM</p>
          <h1>Choose your plan. Cancel anytime.</h1>
          <p>
            Ready to turn the pilot into monthly production? Subscribe, then complete onboarding: offer, proof, brand
            voice, video length, posting mode, notification channel, and approval rules.
          </p>
          <div className="checkoutPlanSwitch">
            <Link className={selectedPlan === "starter" ? "active" : ""} href="/checkout?plan=starter">
              <span>Starter</span>
              <small>{checkoutPlans.starter.price.replace("/month", "/mo")}</small>
            </Link>
            <Link className={selectedPlan === "growth" ? "active" : ""} href="/checkout?plan=growth">
              <span>Growth</span>
              <small>{checkoutPlans.growth.price.replace("/month", "/mo")}</small>
            </Link>
          </div>
          <a className="siteButton primarySiteButton checkoutTopCta" href="#checkout-form">
            Secure checkout
          </a>
          <div className="checkoutBullets">
            {plan.bullets.map((bullet) => (
              <p key={bullet}>
                <CheckCircle2 size={18} />
                {bullet}
              </p>
            ))}
          </div>
          <p className="checkoutFinePrint">
            Auto-posting is optional and only starts after the customer connects the relevant social accounts and
            approves publish rules. VIDSLOOM does not ask for social passwords. Until then, VIDSLOOM runs as an
            approval-first production queue. If the first paid production cycle does not meet the agreed brief after
            revision, request a first-cycle quality review for remake, credit, or refund.
          </p>
          <div className="checkoutLegalLinks" aria-label="Checkout policies">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/refund">Refund policy</Link>
          </div>
        </div>
        <CheckoutForm
          plan={plan}
          defaults={{
            email: singleParam(params.email),
            contactName: singleParam(params.contactName),
            businessName: singleParam(params.businessName),
            phone: singleParam(params.phone),
            leadId
          }}
        />
      </section>
    </main>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}
