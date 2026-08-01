import { ArrowLeft, RefreshCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RefundPage() {
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
            <RefreshCcw size={17} />
            Free audit
          </Link>
        </nav>
      </header>

      <article className="policyArticle">
        <p className="siteEyebrow">Refund And Cancellation Policy</p>
        <h1>Clear subscription expectations before you start VIDSLOOM.</h1>
        <p className="policyUpdated">Last updated: June 14, 2026</p>

        <section>
          <h2>Free audit</h2>
          <p>
            The video growth audit is free and does not require a credit card. Paid work begins only after you choose a
            paid plan and complete checkout.
          </p>
        </section>

        <section>
          <h2>Monthly subscriptions</h2>
          <p>
            Starter and Growth are monthly subscriptions billed in advance. You may request cancellation before the next
            renewal. Cancellation stops future renewals but does not automatically refund work already started or
            delivered in the current billing period.
          </p>
        </section>

        <section>
          <h2>First-cycle quality review</h2>
          <p>
            If the first paid production cycle does not meet the agreed brief after a reasonable revision attempt, you
            may request a first-cycle quality review within seven days of delivery. Depending on the delivery history and
            issue, VIDSLOOM may remake the affected asset, issue account credit, provide a partial refund, or issue a
            full refund for the first cycle. If no production work has started, a cancellation request can be reviewed
            for a full refund.
          </p>
        </section>

        <section>
          <h2>Managed plans</h2>
          <p>
            Managed-service plans may have custom scopes, commitments, and cancellation terms. Those terms will be
            confirmed before the managed plan starts.
          </p>
        </section>

        <section>
          <h2>How to request help</h2>
          <p>
            Use the support contact in your onboarding or checkout confirmation and include your business name, account
            email, plan, and reason for the request. VIDSLOOM will review the account history and respond with the next
            steps.
          </p>
        </section>
      </article>
    </main>
  );
}
