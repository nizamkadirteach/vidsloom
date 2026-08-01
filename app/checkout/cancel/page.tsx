import { ArrowLeft, ClipboardList, CreditCard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutCancelPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const plan = params.plan === "growth" ? "growth" : "starter";

  return (
    <main className="siteShell checkoutPage">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
      </header>

      <section className="checkoutResult">
        <p className="siteEyebrow">Checkout Paused</p>
        <h1>No payment was taken.</h1>
        <p>
          You can restart checkout, or request the free audit first if you want VIDSLOOM to confirm the best first video
          queue before you subscribe.
        </p>
        <div className="checkoutResultActions">
          <Link className="siteButton primarySiteButton" href={`/checkout?plan=${plan}`}>
            <CreditCard size={18} />
            Restart checkout
          </Link>
          <Link className="siteButton lightSiteButton" href="/growth-audit">
            <ClipboardList size={18} />
            Request audit first
          </Link>
          <Link className="siteButton lightSiteButton" href="/#pricing">
            <ArrowLeft size={18} />
            Back to pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
