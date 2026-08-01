import { ArrowRight, CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ensureCustomerPortalAccess } from "@/lib/customer-access";
import { getBillingCustomerByCheckoutSessionId } from "@/lib/storage";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const customer = sessionId ? await getBillingCustomerByCheckoutSessionId(sessionId) : null;
  const portalCustomer = customer ? await ensureCustomerPortalAccess(customer) : null;
  const portalHref = portalCustomer
    ? `/portal?customer=${encodeURIComponent(portalCustomer.id)}&token=${encodeURIComponent(portalCustomer.portalAccessToken)}`
    : "/growth-audit";

  return (
    <main className="siteShell checkoutPage">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
      </header>

      <section className="checkoutResult">
        <CheckCircle2 size={42} />
        <p className="siteEyebrow">Subscription Started</p>
        <h1>Your VIDSLOOM production queue is ready for onboarding.</h1>
        <p>
          Payment was accepted. The next step is to complete the business brief so VIDSLOOM can prepare your first
          AI-generated videos, captions, thumbnails, CTAs, posting windows, and approval queue.
        </p>
        {sessionId ? <span className="checkoutReference">Checkout reference: {sessionId}</span> : null}
        <div className="checkoutResultActions">
          <Link className="siteButton primarySiteButton" href={portalHref}>
            <ClipboardList size={18} />
            Complete onboarding brief
          </Link>
          <Link className="siteButton lightSiteButton" href={portalHref}>
            <Sparkles size={18} />
            Open portal
          </Link>
          <Link className="siteButton lightSiteButton" href="/">
            Home
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
