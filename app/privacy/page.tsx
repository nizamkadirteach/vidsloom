import { ArrowLeft, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
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
            <ShieldCheck size={17} />
            Free audit
          </Link>
        </nav>
      </header>

      <article className="policyArticle">
        <p className="siteEyebrow">Privacy Policy</p>
        <h1>How VIDSLOOM handles business inputs, contact details, and campaign assets.</h1>
        <p className="policyUpdated">Last updated: June 14, 2026</p>

        <section>
          <h2>What we collect</h2>
          <p>
            VIDSLOOM collects the information needed to provide audits, onboarding, video campaign planning, customer
            support, billing, and follow-up. This can include your name, business name, email, phone or WhatsApp number,
            website, social profiles, industry, offers, target audience, brand voice, proof points, asset links,
            approval preferences, and campaign instructions.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to prepare audits, generate campaign drafts, create captions and schedules, manage
            approvals, send service notifications, process subscriptions, and improve VIDSLOOM. We do not sell customer
            contact details or business briefs.
          </p>
        </section>

        <section>
          <h2>Marketing messages</h2>
          <p>
            If you request an audit, join the newsletter, or opt in to trend notes, VIDSLOOM may send follow-up emails
            about your request, campaign ideas, product updates, and relevant offers. You can unsubscribe from newsletter
            messages. Transactional service emails may still be sent for billing, onboarding, approvals, and account
            activity.
          </p>
        </section>

        <section>
          <h2>Social account permissions</h2>
          <p>
            Direct posting requires you to connect the relevant social account through that platform&apos;s permission
            flow. VIDSLOOM does not need your social passwords. Approval-first campaign queues and manual upload
            workflows remain available if you do not connect an account.
          </p>
        </section>

        <section>
          <h2>Security and access</h2>
          <p>
            VIDSLOOM limits access to customer briefs, assets, campaign records, and contact details to operational use:
            audits, production, support, billing, and account administration. We use hosted infrastructure and service
            providers that support encrypted transport. Customer-facing workflows are designed so social passwords are
            not collected by VIDSLOOM.
          </p>
        </section>

        <section>
          <h2>Regional privacy and clinic-sensitive data</h2>
          <p>
            VIDSLOOM is operated for business marketing workflows and aims to handle personal information consistently
            with applicable privacy principles, including Singapore PDPA-style notice, consent, access, correction, and
            retention practices where they apply. Customers serving EU/UK individuals or regulated healthcare audiences
            should avoid submitting patient-identifiable information unless a separate written data-processing or
            regulated-use arrangement is in place. Clinic and wellness campaigns should use approved claims, anonymized
            proof, and customer-permissioned testimonials only.
          </p>
        </section>

        <section>
          <h2>Service providers</h2>
          <p>
            VIDSLOOM may use trusted providers for payments, email delivery, hosting, analytics, file handling, and AI
            processing. These providers receive only the information reasonably needed to deliver the service.
          </p>
        </section>

        <section>
          <h2>Retention and requests</h2>
          <p>
            We keep business and account records for as long as needed to provide the service, meet operational needs,
            resolve disputes, support billing records, measure campaign quality, and comply with applicable obligations.
            We may retain limited transaction, consent, and support records even after an account is closed where needed
            for legal, accounting, security, or dispute-resolution purposes. You may request correction, export, or
            deletion of personal information where legally available by contacting VIDSLOOM through the support channel
            used for your account or audit.
          </p>
        </section>
      </article>
    </main>
  );
}
