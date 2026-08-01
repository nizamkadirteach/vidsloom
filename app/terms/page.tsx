import { ArrowLeft, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="siteShell policyPage">
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
          <Link className="navAction" href="/growth-audit">
            <FileText size={17} />
            Free audit
          </Link>
        </nav>
      </header>

      <article className="policyArticle">
        <p className="siteEyebrow">Terms Of Service</p>
        <h1>VIDSLOOM provides AI-powered video marketing workflows for business use.</h1>
        <p className="policyUpdated">Last updated: June 14, 2026</p>

        <section>
          <h2>Service scope</h2>
          <p>
            VIDSLOOM helps businesses turn offers, proof, products, services, audience information, and brand guidance
            into short-form video campaign assets. Depending on your plan, this may include video drafts, captions,
            thumbnails, CTAs, schedules, approval queues, notifications, and publishing support.
          </p>
        </section>

        <section>
          <h2>Customer responsibilities</h2>
          <p>
            You are responsible for providing accurate business information, reviewing campaign assets before use,
            confirming that claims are truthful, and ensuring your offers, regulated statements, testimonials, and
            advertising comply with the rules that apply to your business and platforms.
          </p>
        </section>

        <section>
          <h2>Regulated and sensitive industries</h2>
          <p>
            Customers in medical, wellness, financial, legal, or other regulated categories must review every claim,
            disclosure, testimonial, and before-after statement before use. VIDSLOOM can help structure content and
            approval queues, but the customer remains responsible for professional, regulatory, advertising, and
            platform compliance.
          </p>
        </section>

        <section>
          <h2>Approvals and publishing</h2>
          <p>
            VIDSLOOM is approval-first by default. Direct auto-posting is optional and requires you to connect each
            social account through that platform&apos;s permission flow and approve publishing rules. VIDSLOOM does not
            ask for social passwords and does not publish directly until the required permissions and approvals are in
            place.
          </p>
        </section>

        <section>
          <h2>Subscriptions and billing</h2>
          <p>
            Starter and Growth plans are recurring monthly subscriptions. The checkout page shows the selected plan,
            billing cadence, and price before payment. You may cancel before the next renewal to stop future billing.
            You should review your plan details before subscribing.
          </p>
        </section>

        <section>
          <h2>Agency and white-label use</h2>
          <p>
            Agencies may use VIDSLOOM for client campaign planning and production only under an agreed plan that covers
            client volume, approval responsibility, content rights, account access, and support expectations. White-label
            delivery, client resale, custom integrations, and multi-client workflows require written approval or a
            managed-service agreement.
          </p>
        </section>

        <section>
          <h2>No guaranteed results</h2>
          <p>
            VIDSLOOM aims to improve video marketing speed, consistency, and campaign quality, but does not guarantee
            viral reach, revenue, bookings, leads, ad performance, platform approval, or any specific commercial result.
          </p>
        </section>

        <section>
          <h2>Content rights</h2>
          <p>
            You must have the rights to submit the business assets, reviews, photos, clips, logos, and claims you
            provide. Subject to successful payment and applicable law, campaign assets prepared for your business may be
            used by your business for its marketing. VIDSLOOM may retain operational records needed to provide support,
            billing, compliance, and service improvement.
          </p>
        </section>

        <section>
          <h2>Service limitations</h2>
          <p>
            VIDSLOOM may depend on customer-supplied assets, third-party social platforms, payment providers, email
            providers, hosting providers, and platform APIs. Availability, posting permissions, review delays, ad
            account policies, and platform changes can affect delivery timelines or publishing options.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            VIDSLOOM may update these terms as the product, plans, and workflows evolve. Material changes will be
            reflected on this page or communicated through appropriate customer channels.
          </p>
        </section>
      </article>
    </main>
  );
}
