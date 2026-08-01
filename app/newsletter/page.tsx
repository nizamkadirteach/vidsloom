import { ArrowLeft, Mail, Sparkles, TrendingUp, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { NewsletterSignupForm } from "@/app/components/newsletter-signup-form";

export const dynamic = "force-dynamic";

const notes = [
  "Short-form video angles businesses can use without filming from scratch",
  "Trend-aware content ideas translated into offers, proof, CTAs, and posting windows",
  "Practical examples for restaurants, clinics, ecommerce, coaches, agencies, and local services"
];

export default function NewsletterPage() {
  return (
    <main className="siteShell funnelPage newsletterPage">
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
            Workspace
          </Link>
        </nav>
      </header>

      <section className="newsletterHero">
        <div className="newsletterIntro">
          <p className="siteEyebrow">VIDSLOOM Trend Notes</p>
          <h1>Video ideas your business can use now.</h1>
          <p>
            Get practical short-form video angles, campaign notes, and trend translations for businesses that want more
            enquiries, bookings, sales, and warm follow-up without producing every video themselves.
          </p>
          <div className="heroActions newsletterHeroActions">
            <a className="siteButton primarySiteButton" href="#newsletter-form">
              <Sparkles size={18} />
              Join trend notes
            </a>
          </div>
          <div className="newsletterPromise">
            {notes.map((note, index) => {
              const Icon = index === 0 ? Video : index === 1 ? TrendingUp : Mail;
              return (
                <span key={note}>
                  <Icon size={18} />
                  {note}
                </span>
              );
            })}
          </div>
        </div>
        <div id="newsletter-form">
          <NewsletterSignupForm />
        </div>
      </section>
    </main>
  );
}
