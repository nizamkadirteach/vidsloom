import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Film,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Video
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { pilotProofLibrary } from "@/lib/pilot-proof";

export const dynamic = "force-dynamic";

const workflowSteps = [
  {
    icon: ClipboardList,
    title: "1. Business brief",
    text: "Offer, buyer, proof, platforms, brand voice, video length, quality level, approval rules, and notification channel."
  },
  {
    icon: UploadCloud,
    title: "2. Proof and assets",
    text: "Product photos, reviews, menu shots, result screenshots, FAQs, website links, and topics to avoid."
  },
  {
    icon: Sparkles,
    title: "3. AI campaign build",
    text: "Trend-aware hooks, scripts, captions, thumbnail frames, CTAs, posting windows, and proof-safe storyboards."
  },
  {
    icon: Video,
    title: "4. Video previews",
    text: "Generated MP4 previews are assembled for review with subtitles, proof overlays, safe zones, and CTA direction."
  },
  {
    icon: ShieldCheck,
    title: "5. Approval queue",
    text: "The customer approves, requests edits, pauses, or asks for a stronger variant before anything is published."
  },
  {
    icon: CalendarCheck,
    title: "6. Posting and follow-up",
    text: "VIDSLOOM prepares schedules, manual posting kits, notifications, and direct posting where permissions are connected."
  }
];

const reviewRows = pilotProofLibrary.slice(0, 3).map((item, index) => ({
  ...item,
  status: index === 0 ? "ready-for-approval" : index === 1 ? "needs-review" : "scheduled",
  proof: index === 0 ? "Proof overlay ready" : index === 1 ? "Awaiting proof note" : "CTA and schedule ready"
}));

const postingRows = [
  {
    platform: "YouTube Shorts",
    status: "Direct post ready after account permission",
    action: "Approve video and schedule window"
  },
  {
    platform: "Instagram Reels",
    status: "Manual posting kit until platform permission is approved",
    action: "Download caption, MP4, thumbnail, and checklist"
  },
  {
    platform: "TikTok",
    status: "Manual kit now; direct posting after platform approval",
    action: "Use the recommended posting window and CTA"
  }
];

export default function WorkspaceDemoPage() {
  return (
    <main className="siteShell workspaceDemoPage">
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
          <Link className="navAction" href="/growth-audit">
            <Sparkles size={17} />
            Get audit
          </Link>
        </nav>
      </header>

      <section className="pilotHero">
        <div className="pilotHeroText">
          <p className="siteEyebrow">Workspace Demo</p>
          <h1>See how VIDSLOOM turns a business brief into videos and a posting queue.</h1>
          <p>
            This is a public preview of the customer workflow: video settings, campaign build, generated MP4 previews,
            approval controls, posting kits, and optional direct posting after account permissions are connected.
          </p>
          <div className="pilotMeta">
            <span>
              <PlayCircle size={18} />
              Real sample MP4s
            </span>
            <span>
              <LockKeyhole size={18} />
              No social passwords
            </span>
          </div>
          <div className="heroActions">
            <Link className="siteButton primarySiteButton" href="/pilot">
              Start your free pilot
              <ArrowRight size={18} />
            </Link>
            <a className="siteButton secondaryDarkButton" href="#demo-videos">
              Watch output
              <Film size={18} />
            </a>
          </div>
        </div>
        <div className="heroDemo" aria-label="VIDSLOOM workspace demo preview">
          <div className="heroDemoHeader">
            <span>Generated output</span>
            <strong>Playable sample reel</strong>
          </div>
          <video autoPlay muted loop playsInline preload="metadata" poster="/samples/service-proof-poster.png">
            <source src="/samples/service-proof-sample.mp4" type="video/mp4" />
          </video>
          <p className="heroDemoNote">A finished MP4 preview appears inside the approval workflow.</p>
        </div>
      </section>

      <section className="proofBand">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Step-By-Step Workflow</p>
              <h2>The customer does not need to write prompts, edit videos, or manage posting details.</h2>
              <p>
                VIDSLOOM keeps the workflow simple for business owners while keeping enough controls for teams,
                regulated businesses, agencies, and multi-platform campaigns.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/growth-audit">
              Request audit
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="proofGrid">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="proofCard">
                  <Icon size={22} />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sampleBand" id="demo-videos">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Generated Video Review</p>
              <h2>Review videos, captions, CTAs, and next actions.</h2>
              <p>
                These are generated VIDSLOOM samples. Real customer campaigns are regenerated from the customer&apos;s own
                offer, proof, assets, brand rules, and approval preferences.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/pilot">
              Start pilot
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="videoReviewList">
            {reviewRows.map((row) => (
              <article key={row.id} className="videoReviewCard">
                <video autoPlay muted loop playsInline preload="metadata" poster={row.posterUrl}>
                  <source src={row.videoUrl} type="video/mp4" />
                </video>
                <div className="videoReviewBody">
                  <div className="videoReviewTop">
                    <span>{row.industry}</span>
                    <div className="videoReviewPills">
                      <strong className={`reviewStatusPill ${row.status}`}>{row.status.replaceAll("-", " ")}</strong>
                      <strong className="reviewStatusPill approved">MP4 preview</strong>
                    </div>
                  </div>
                  <h4>{row.generatedOutput}</h4>
                  <dl>
                    <div>
                      <dt>Business goal</dt>
                      <dd>{row.brief}</dd>
                    </div>
                    <div>
                      <dt>Trend formula</dt>
                      <dd>{row.trendFormula}</dd>
                    </div>
                    <div>
                      <dt>Caption and CTA</dt>
                      <dd>
                        {row.caption} {row.cta}
                      </dd>
                    </div>
                    <div>
                      <dt>Proof status</dt>
                      <dd>{row.proof}</dd>
                    </div>
                    <div>
                      <dt>Schedule</dt>
                      <dd>{row.schedule}</dd>
                    </div>
                  </dl>
                  <div className="portalAssetPipeline">
                    <span>Video preview</span>
                    <span>Poster frame</span>
                    <span>Caption</span>
                    <span>CTA</span>
                    <span>Approval check</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trustBand">
        <div className="sectionInner">
          <div className="sectionLead">
            <p className="siteEyebrow">Posting Control</p>
            <h2>Hands-off posting is available when the account is ready. Manual kits are always available.</h2>
            <p>
              VIDSLOOM can prepare posts, schedule windows, captions, thumbnails, and reminders immediately. Direct
              posting only starts after the customer connects each social account through its permission flow.
            </p>
          </div>
          <div className="trustGrid">
            {postingRows.map((row) => (
              <article key={row.platform} className="trustCard">
                <Bell size={21} />
                <h3>{row.platform}</h3>
                <p>{row.status}</p>
                <p>
                  <BadgeCheck size={16} /> {row.action}
                </p>
              </article>
            ))}
          </div>
          <div className="pricingAssurance">
            <ShieldCheck size={20} />
            <p>
              VIDSLOOM never asks for social passwords. If a platform is not connected or direct posting is not approved
              yet, the workspace produces a manual posting kit: MP4, poster, caption, hashtags, CTA, timing, and
              approval checklist.
            </p>
          </div>
        </div>
      </section>

      <section className="pilotBand">
        <div className="sectionInner pilotLayout">
          <div>
            <p className="siteEyebrow">Next Step</p>
            <h2>Start with a free pilot and receive your first campaign direction.</h2>
            <p>
              Share the business offer, target customer, proof points, and priority platform. VIDSLOOM will map the
              first videos and posting workflow before you choose a paid plan.
            </p>
          </div>
          <div className="pilotPanel">
            <div className="pilotRow">
              <CheckCircle2 size={20} />
              <span>Video length and quality settings captured before production</span>
            </div>
            <div className="pilotRow">
              <Film size={20} />
              <span>Generated MP4 previews, captions, CTAs, and poster frames</span>
            </div>
            <div className="pilotRow">
              <CalendarCheck size={20} />
              <span>Posting queue, manual kit, and optional direct posting after permission</span>
            </div>
            <Link className="siteButton primarySiteButton fullWidthButton" href="/growth-audit">
              Request free audit
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
