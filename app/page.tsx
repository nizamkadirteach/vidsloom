import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Film,
  Mail,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Video,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { RoiCalculator } from "@/app/components/roi-calculator";
import { getPublicContactActions } from "@/lib/contact-actions";
import { pilotProofLibrary } from "@/lib/pilot-proof";

export const dynamic = "force-dynamic";

const outcomes = [
  "A monthly queue of ready-to-review short videos, captions, thumbnail frames, CTAs, and posting times",
  "Campaigns built from your offers, customer proof, product details, reviews, and current market trends",
  "Approvals, edit requests, scheduling, and notifications in one operating rhythm",
  "Organic content tests first, then reuse the strongest winners for paid campaigns",
  "Performance capture for views, enquiries, bookings, sales notes, and next-cycle improvements"
];

const heroProofStats = [
  {
    value: "No card",
    label: "free video plan request"
  },
  {
    value: "48h",
    label: "first campaign direction after audit"
  },
  {
    value: "Approval",
    label: "approval-first posting"
  }
];

const proofStrip = [
  {
    title: "Your first plan before payment",
    text: "Request a free video plan so you can see the campaign direction, sample angles, and proof gaps before choosing a package."
  },
  {
    title: "Start without filming",
    text: "VIDSLOOM can begin from your website, offer, proof, product details, reviews, screenshots, and optional existing assets."
  },
  {
    title: "Approval-first by default",
    text: "Customers review the queue before publishing. Direct auto-posting only starts after account permissions are connected."
  }
];

const workflow = [
  {
    icon: ClipboardList,
    label: "1. Give the business context",
    text: "Add the offer, target customer, proof points, brand voice, locations, platforms, and approval rules."
  },
  {
    icon: UploadCloud,
    label: "2. Drop in optional assets",
    text: "Upload product photos, menu shots, reviews, staff photos, testimonials, or existing clips when available."
  },
  {
    icon: Bot,
    label: "3. AI builds the campaign",
    text: "The intelligence layer turns trends, proof, and offers into finished video drafts and platform variants."
  },
  {
    icon: Video,
    label: "4. Videos are generated",
    text: "VIDSLOOM creates short-form videos, captions, thumbnails, hooks, CTAs, and posting windows."
  },
  {
    icon: ShieldCheck,
    label: "5. Approve once",
    text: "Owners review the queue, request edits, approve, pause, or mark videos for paid boosts."
  },
  {
    icon: Bell,
    label: "6. Post and notify",
    text: "With connected account permissions, posts can be scheduled or auto-posted while customers get status alerts."
  }
];

const bestFit = [
  "Local services, clinics, studios, restaurants, ecommerce brands, coaches, and small agencies",
  "Businesses with a real offer, a clear customer, and any usable proof: reviews, results, photos, demos, or stories",
  "Owners who want done-for-you video output without hiring a full creative team or editing videos themselves",
  "Agencies and teams that need client approvals, repeatable reports, and reusable winning creatives"
];

const sampleVideos = [
  {
    title: "Restaurant growth video",
    src: "/samples/vidsloom-restaurant-growth-sample.mp4",
    poster: "/samples/vidsloom-restaurant-growth-poster.png",
    text: "A menu offer becomes a booking-focused vertical video with caption, CTA, and posting window.",
    hook: "Turn today’s menu into tomorrow’s bookings.",
    caption: "Show the dish, the offer, and the next step before the scroll moves on.",
    cta: "Get a free restaurant video plan"
  },
  {
    title: "Clinic growth video",
    src: "/samples/vidsloom-clinic-growth-sample.mp4",
    poster: "/samples/vidsloom-clinic-growth-poster.png",
    text: "A service offer becomes a claim-safe trust video that reduces hesitation and drives enquiries.",
    hook: "Turn trust into booked consultations.",
    caption: "Make the first visit feel clear, safe, and easy to book.",
    cta: "Get a free clinic video plan"
  },
  {
    title: "Ecommerce growth video",
    src: "/samples/vidsloom-ecommerce-growth-sample.mp4",
    poster: "/samples/vidsloom-ecommerce-growth-poster.png",
    text: "A product page becomes a scroll-stopping short with proof, checkout cue, and launch CTA.",
    hook: "Turn product pages into scroll-stopping shorts.",
    caption: "Show the product, proof, and checkout step in one mobile-first flow.",
    cta: "Get a free product video plan"
  },
  {
    title: "Coach and consultant video",
    src: "/samples/vidsloom-coach-growth-sample.mp4",
    poster: "/samples/vidsloom-coach-growth-poster.png",
    text: "A client objection becomes an authority-building video that moves viewers toward qualified calls.",
    hook: "Turn one client objection into booked calls.",
    caption: "Turn expertise, proof, and a common question into a clear next step.",
    cta: "Get a free expert video plan"
  },
  {
    title: "Agency growth video",
    src: "/samples/vidsloom-agency-growth-sample.mp4",
    poster: "/samples/vidsloom-agency-growth-poster.png",
    text: "A client brief becomes an approval-ready campaign queue with video, caption, CTA, and schedule.",
    hook: "Turn one client brief into a video campaign queue.",
    caption: "Give clients the creative, caption, and posting plan together.",
    cta: "Book an agency demo"
  }
];

const proofCaptureExamples = [
  {
    persona: "Restaurant owner",
    promise: "Menu photos, reviews, and event offers become weekly reels for pickup, bookings, and seasonal promos.",
    proof: "Pilot tracks post URL, views, saves, enquiries, booking links, and offer redemptions."
  },
  {
    persona: "Clinic or wellness owner",
    promise: "Claim-safe educational clips, first-visit explainers, and approved testimonials without risky medical promises.",
    proof: "Pilot tracks approved claims, consultation enquiries, booking clicks, and compliance notes."
  },
  {
    persona: "Ecommerce founder",
    promise: "Product demos, bundle launches, objection-handling clips, and retargeting-ready creative variants.",
    proof: "Pilot tracks product-page clicks, add-to-cart notes, post engagement, and winning hook variants."
  },
  {
    persona: "Agency or multi-location team",
    promise: "Repeatable client briefs, approval queues, localized captions, and reporting-ready campaign rows.",
    proof: "Pilot tracks approval speed, client feedback, published links, and performance summaries per account."
  }
];

const trustAndCompliance = [
  {
    title: "Customer owns the final videos",
    text: "Paid customers can use the final rendered MP4s, captions, thumbnails, and campaign assets across their approved organic or paid channels."
  },
  {
    title: "Claims stay approval-safe",
    text: "Prices, testimonials, metrics, regulated claims, before/after statements, and guarantees require customer-approved proof before publishing."
  },
  {
    title: "Secure social permissions",
    text: "Auto-posting uses official account permission flows where available. VIDSLOOM does not ask for social passwords."
  },
  {
    title: "Private business inputs",
    text: "Business briefs, proof points, assets, approval rules, account status, and performance notes stay inside the workspace and are not public samples."
  }
];

const selfMarketingProof = [
  {
    icon: Sparkles,
    title: "VIDSLOOM briefs itself",
    text: "We use the same offer, audience, proof, brand voice, approval, and posting workflow that customers use."
  },
  {
    icon: Video,
    title: "VIDSLOOM makes its own assets",
    text: "Landing-page samples, campaign angles, captions, thumbnails, and demo clips are treated as VIDSLOOM campaign output."
  },
  {
    icon: CalendarCheck,
    title: "VIDSLOOM posts and follows up",
    text: "The growth loop is built for public posts, lead capture, email follow-ups, WhatsApp/SMS handoff, and approval-first scheduling."
  },
  {
    icon: BarChart3,
    title: "VIDSLOOM measures the proof",
    text: "Published links, views, enquiries, bookings, sales notes, and next-test decisions become the evidence trail."
  }
];

const trendProof = [
  {
    title: "Restaurant sample",
    businessName: "VIDSLOOM for Restaurants",
    videoSrc: "/samples/vidsloom-restaurant-growth-sample.mp4",
    poster: "/samples/vidsloom-restaurant-growth-poster.png",
    source: "VIDSLOOM trend intelligence",
    scoutSignal: "Food close-up, menu urgency, and fast local decision framing",
    remix: "Open with a booking-focused hook, show the dish and offer, then move to a simple plan request CTA.",
    output: "Turn Today’s Menu Into Tomorrow’s Bookings"
  },
  {
    title: "Clinic sample",
    businessName: "VIDSLOOM for Clinics",
    videoSrc: "/samples/vidsloom-clinic-growth-sample.mp4",
    poster: "/samples/vidsloom-clinic-growth-poster.png",
    source: "VIDSLOOM trend intelligence",
    scoutSignal: "Trust-first education, first-visit clarity, and low-pressure consultation CTA",
    remix: "Open with buyer anxiety, keep claims safe, then make the consultation step feel clear.",
    output: "Turn Trust Into Booked Consultations"
  },
  {
    title: "Ecommerce sample",
    businessName: "VIDSLOOM for Ecommerce",
    videoSrc: "/samples/vidsloom-ecommerce-growth-sample.mp4",
    poster: "/samples/vidsloom-ecommerce-growth-poster.png",
    source: "VIDSLOOM trend intelligence",
    scoutSignal: "Product proof, routine demo rhythm, and checkout cue framing",
    remix: "Open with the product-page promise, show proof and objection handling, then move to checkout.",
    output: "Turn Product Pages Into Scroll-Stopping Shorts"
  },
  {
    title: "Coach sample",
    businessName: "VIDSLOOM for Experts",
    videoSrc: "/samples/vidsloom-coach-growth-sample.mp4",
    poster: "/samples/vidsloom-coach-growth-poster.png",
    source: "VIDSLOOM trend intelligence",
    scoutSignal: "Objection-first expert POV, proof-led authority, and call-booking CTA",
    remix: "Turn a common client objection into a concise authority clip with one booking path.",
    output: "Turn One Client Objection Into Booked Calls"
  },
  {
    title: "Agency sample",
    businessName: "VIDSLOOM for Agencies",
    videoSrc: "/samples/vidsloom-agency-growth-sample.mp4",
    poster: "/samples/vidsloom-agency-growth-poster.png",
    source: "VIDSLOOM trend intelligence",
    scoutSignal: "Brief-to-queue workflow, client approval clarity, and campaign operations framing",
    remix: "Show how one client brief becomes video, caption, CTA, schedule, and approval queue.",
    output: "Turn One Client Brief Into a Campaign Queue"
  }
];

const workspaceTrace = [
  {
    icon: ClipboardList,
    step: "01",
    title: "Business intake",
    panel: "Offer, audience, proof, brand voice, platforms, cadence, approval rules",
    text: "The customer gives business context in a normal workspace form. They do not have to write prompts or film everything themselves."
  },
  {
    icon: TrendingUp,
    step: "02",
    title: "Trend intelligence",
    panel: "VIDSLOOM studies current short-form formulas and category fit",
    text: "The intelligence layer maps trend patterns to the customer category and chooses low-cost formats first."
  },
  {
    icon: Bot,
    step: "03",
    title: "Campaign pack",
    panel: "Hooks, scripts, shot lists, captions, hashtags, CTAs",
    text: "The AI-native engine creates a complete campaign pack, not just a single idea."
  },
  {
    icon: Video,
    step: "04",
    title: "Video generation",
    panel: "MP4 samples, posters, captions, and platform variants",
    text: "Selected concepts are rendered into reviewable short-form video samples and reusable creative assets."
  },
  {
    icon: ShieldCheck,
    step: "05",
    title: "Approval queue",
    panel: "Approve, request edits, pause, or mark for paid test",
    text: "Nothing posts automatically until the customer approves and the required social account permissions are connected."
  },
  {
    icon: CalendarCheck,
    step: "06",
    title: "Schedule and learn",
    panel: "Posting windows, reminders, status alerts, next-week improvements",
    text: "The queue becomes a repeatable operating rhythm for organic content and later paid campaign reuse."
  }
];

const proofFormats = [
  "Reviews and testimonials repackaged as proof-led short videos",
  "Before/after, problem/result, and transformation stories structured for quick trust",
  "Founder, team, or expert authority clips generated from talking points and brand facts",
  "Product, service, menu, or offer demos adapted into platform-specific video cuts",
  "Seasonal, local, and urgency angles turned into campaign variants",
  "Response signals used to improve the next queue instead of guessing again"
];

const qualityStandards = [
  {
    title: "Choose the video length",
    text: "Customers can pick 10, 15, 20, 30, 45, or 60 seconds. VIDSLOOM recommends the shortest length that can still prove the offer clearly."
  },
  {
    title: "Built for mobile first",
    text: "Every production brief is planned for vertical 9:16 viewing, strong first-three-second hooks, readable subtitles, safe zones, and one clear CTA."
  },
  {
    title: "Premium mode for hero clips",
    text: "Use fast previews for early review, balanced production for normal campaigns, and premium production when the video needs stronger motion and polish."
  },
  {
    title: "Claims and proof stay controlled",
    text: "Reviews, prices, logos, metrics, and guarantees are added only as approved overlays or customer proof, not invented inside generated footage."
  },
  {
    title: "Hands-off posting when ready",
    text: "VIDSLOOM can prepare schedules, notifications, manual posting kits, and direct posting where the customer has connected account permissions."
  },
  {
    title: "Business owners keep approval control",
    text: "The default workflow is approve, request changes, schedule, or pause. No public post is sent without the customer's rules and permissions."
  }
];

const formatChoices = ["10s proof preview", "15s offer clip", "20s demo", "30s proof + objection", "45s story", "60s deep short"];

const visualProof = [
  "Restaurants: offers, dishes, events, bookings",
  "Clinics and studios: trust, proof, enquiries",
  "Ecommerce: demos, launches, bundles, retargeting",
  "Service companies: reviews, FAQs, lead magnets"
];

const personaProof = [
  {
    persona: "Restaurants",
    result: "Turn menu highlights, events, chef POVs, and reviews into booking-focused reels.",
    sample: "Signature dish reveal, last-table urgency, private dining walkthrough"
  },
  {
    persona: "Clinics and studios",
    result: "Explain the first visit, reduce buyer anxiety, and turn expert answers into trust-led videos.",
    sample: "Consultation walkthrough, myth-vs-fact, client proof story"
  },
  {
    persona: "Ecommerce",
    result: "Package product demos, bundles, objection handling, and retargeting hooks into repeatable launches.",
    sample: "Unboxing, routine demo, product comparison, founder pick"
  },
  {
    persona: "Services and coaches",
    result: "Convert FAQs, proof points, customer outcomes, and authority content into regular lead-generation videos.",
    sample: "Problem-first hook, checklist explainer, before-after proof"
  },
  {
    persona: "Regulated advisors",
    result: "Use safer educational videos, clear disclaimers, and approval checkpoints for real estate, insurance, finance, and legal services.",
    sample: "Myth explainer, consultation guide, compliance-approved CTA"
  },
  {
    persona: "Franchise teams",
    result: "Keep central brand control while localizing offers, locations, captions, and posting windows for each outlet.",
    sample: "Local offer variant, outlet launch, regional campaign calendar"
  },
  {
    persona: "Agencies",
    result: "Create client-ready campaigns, approval queues, proof notes, and reporting rows without rebuilding the process every time.",
    sample: "Client campaign pack, white-label report, approval workflow"
  }
];

const pricingTiers = [
  {
    name: "Starter",
    price: "S$390/month intro",
    summary: "For one owner-led business that needs reliable monthly videos without hiring an editor.",
    points: [
      "4 finished short-form videos per month",
      "1 priority platform",
      "Captions, thumbnail frames, CTAs, and schedule windows",
      "Manual posting kit or connected-account posting where supported",
      "Approval-first queue and first-cycle quality review"
    ],
    cta: "Start on Starter",
    href: "/checkout?plan=starter"
  },
  {
    name: "Growth",
    price: "S$790/month intro",
    summary: "For businesses that want faster testing, more formats, and a stronger monthly content rhythm.",
    points: [
      "10 finished short-form videos per month",
      "2 priority platforms",
      "Trend refresh, performance summary, and monthly strategy call",
      "Organic winners prepared for paid reuse"
    ],
    cta: "Start on Growth",
    href: "/checkout?plan=growth",
    featured: true
  },
  {
    name: "Managed",
    price: "From S$1,500/month",
    summary: "For agencies, multi-location operators, and teams that want a higher-touch video growth system.",
    points: [
      "Custom video volume",
      "Multi-brand or multi-location workflows",
      "Managed approval and campaign planning",
      "Reporting and next-cycle recommendations",
      "Agency and white-label workflow options"
    ],
    cta: "Request managed plan",
    href: "/growth-audit"
  }
];

const pricingFaq = [
  {
    question: "What do I need to provide?",
    answer:
      "A clear offer, target customer, proof points, website or product links, and any useful photos, reviews, FAQs, or existing clips. VIDSLOOM can start without you filming new videos."
  },
  {
    question: "Can VIDSLOOM post for me?",
    answer:
      "Yes where direct posting is available and the customer connects the relevant account permissions. Until then, VIDSLOOM prepares the MP4, caption, thumbnail, CTA, and manual posting kit."
  },
  {
    question: "Who owns the videos?",
    answer:
      "Paid customers can reuse the final rendered videos, captions, thumbnails, and campaign assets for their own approved organic or paid marketing channels."
  },
  {
    question: "What if the first videos miss the brief?",
    answer:
      "The first paid cycle includes a quality review. If output misses the agreed brief after revision, VIDSLOOM reviews it for remake, credit, or refund."
  },
  {
    question: "Do you guarantee viral reach or revenue?",
    answer:
      "No honest marketing system can guarantee virality. VIDSLOOM focuses on trend-aware creative, fast testing, approval control, and reusable winners for organic or paid campaigns."
  }
];

const trustSignals = [
  {
    title: "Real review queue",
    text: "Customers approve, request changes, pause, or schedule. Nothing posts automatically until the required account permissions are connected."
  },
  {
    title: "Proof capture built in",
    text: "Campaign rows capture published links, direct-post status, views, enquiries, booking notes, screenshots, and follow-up timing."
  },
  {
    title: "Compliance-aware guardrails",
    text: "Regulated or sensitive categories can require stricter claim review, disclaimer notes, approved proof, and manual approval before posting."
  },
  {
    title: "First-cycle quality review",
    text: "If the first paid cycle misses the agreed brief after revision, VIDSLOOM reviews the account for remake, credit, or refund."
  },
  {
    title: "Security and ownership clarity",
    text: "VIDSLOOM does not need social passwords, separates private business inputs from public samples, and documents usage rights for final assets."
  }
];

export default function PublicHome() {
  const contactActions = getPublicContactActions();
  const hasInstantContact = Boolean(contactActions.whatsappUrl || contactActions.smsUrl || contactActions.mailtoUrl);

  return (
    <main className="siteShell">
      <header className="siteNav" aria-label="Primary navigation">
        <Link className="siteBrand" href="/">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={36} height={36} priority unoptimized />
          <span>VIDSLOOM</span>
        </Link>
        <nav>
          <a href="#outcome">What you get</a>
          <a href="#samples">Samples</a>
          <a href="#workspace">Workspace</a>
          <a href="#workflow">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/newsletter">Trend notes</Link>
          <Link href="/pilot">Free pilot</Link>
          <Link className="navAction" href="/growth-audit">
            <Zap size={17} />
            Get audit
          </Link>
        </nav>
      </header>

      <section className="siteHero">
        <Image
          src="/images/vidsloom-business-montage.webp"
          alt=""
          fill
          priority
          className="heroBackdropImage"
          sizes="100vw"
          unoptimized
        />
        <div className="heroShade" />
        <div className="heroStage">
          <div className="heroContent">
            <p className="siteEyebrow">AI short-form video marketing</p>
            <h1>Done-for-you AI videos for more bookings, appointments, and sales.</h1>
            <p className="heroCopy">
              Explain your offer, audience, proof, and brand voice once. VIDSLOOM builds trend-aware campaigns,
              generates ready-to-review videos, captions, CTAs, thumbnails, and posting windows, then posts only when
              you approve.
            </p>
            <div className="heroActions">
              <Link className="siteButton primarySiteButton" href="/growth-audit">
                <Sparkles size={18} />
                Get free video plan
              </Link>
              <a className="siteButton secondarySiteButton" href="#samples">
                <PlayCircle size={18} />
                See real examples
              </a>
            </div>
            <p className="heroCtaNote">No card required. Get your first campaign direction and proof checklist before choosing a plan.</p>
            <div className="heroVideoRail" aria-label="Generated video examples">
              {sampleVideos.map((sample) => (
                <a key={sample.title} className="heroVideoTile" href="#samples">
                  <video autoPlay muted loop playsInline preload="metadata" poster={sample.poster}>
                    <source src={sample.src} type="video/mp4" />
                  </video>
                  <span>{sample.title}</span>
                </a>
              ))}
            </div>
            <div className="heroProofStats" aria-label="VIDSLOOM proof points">
              {heroProofStats.map((item) => (
                <div key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            {hasInstantContact ? (
              <div className="instantContactBar" aria-label="Fast contact options">
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
            <div className="heroTrustLine">
              <span>No filming required to start</span>
              <span>Videos generated for you</span>
              <span>Secure permissions for optional auto-posting</span>
            </div>
          </div>
          <div className="heroDemo" aria-label="VIDSLOOM generated video sample">
            <div className="heroDemoHeader">
              <span>Generated sample</span>
              <strong>Ready-to-approve reel</strong>
            </div>
            <video autoPlay muted loop playsInline preload="metadata" poster="/samples/vidsloom-restaurant-growth-poster.png">
              <source src="/samples/vidsloom-restaurant-growth-sample.mp4" type="video/mp4" />
            </video>
            <p className="heroDemoNote">Video, caption, CTA, and posting window prepared together.</p>
          </div>
        </div>
      </section>

      <section className="proofStripBand" aria-label="Proof before buying">
        <div className="sectionInner proofStripGrid">
          {proofStrip.map((item) => (
            <article key={item.title} className="proofStripCard">
              <CheckCircle2 size={19} />
              <div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="proofCaptureBand" aria-label="Pilot proof and performance capture">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Proof Before Scale</p>
              <h2>Every pilot should leave a measurable trail, not just a nice-looking video.</h2>
              <p>
                VIDSLOOM does not invent testimonials, bookings, or sales results. Each pilot is designed to capture the
                evidence needed for a real case study: published links, approved claims, screenshots, views, enquiries,
                bookings, sales notes, and what to test next.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/growth-audit">
              Get proof plan
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="proofCaptureGrid">
            {proofCaptureExamples.map((item) => (
              <article key={item.persona} className="proofCaptureCard">
                <span>{item.persona}</span>
                <h3>{item.promise}</h3>
                <p>{item.proof}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="visualProofBand" aria-label="VIDSLOOM visual operating model">
        <div className="sectionInner visualProofLayout">
          <div className="visualProofMedia">
            <Image
              src="/images/vidsloom-business-montage.webp"
              alt="Business owners reviewing AI-generated social videos, campaign calendars, and short-form video assets across restaurant, clinic, ecommerce, and scheduling workflows."
              width={1800}
              height={1013}
              sizes="(max-width: 900px) 100vw, 58vw"
              unoptimized
            />
            <div className="visualProofBadge">
              <Sparkles size={18} />
              <span>Business input becomes ready-to-post video campaigns</span>
            </div>
          </div>
          <div className="visualProofCopy">
            <p className="siteEyebrow">The Operating Model</p>
            <h2>From business context to video campaigns your team can actually approve.</h2>
            <p>
              The customer does not need to become a video editor or content producer. VIDSLOOM uses business inputs,
              available proof, and optional assets to create short-form videos, captions, calendars, and campaign queues
              for real commercial workflows.
            </p>
            <div className="visualProofList">
              {visualProof.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="personaProofBand" aria-label="Industry-specific video use cases">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Industry Fit</p>
              <h2>Built for real business offers, not generic content prompts.</h2>
              <p>
                VIDSLOOM adapts the campaign formula to the business type, buyer intent, available proof, and platform.
                These are sample campaign directions that can be produced from normal business inputs, with stricter
                controls for regulated or multi-location teams.
              </p>
            </div>
            <a className="siteButton lightSiteButton" href="#samples">
              View samples
              <PlayCircle size={18} />
            </a>
          </div>
          <div className="personaProofGrid">
            {personaProof.map((item) => (
              <article key={item.persona} className="personaProofCard">
                <span>{item.persona}</span>
                <h3>{item.result}</h3>
                <p>{item.sample}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="offerBand" id="outcome">
        <div className="sectionInner splitSection">
          <div className="sectionLead">
            <p className="siteEyebrow">What You Get</p>
            <h2>A done-for-you AI video engine, not another content task.</h2>
            <p>
              Built for business owners, businesses, and companies that need video output without managing freelancers,
              editors, trend research, captions, and posting calendars separately.
            </p>
          </div>
          <div className="outcomePanel">
            {outcomes.map((item) => (
              <div key={item} className="outcomeRow">
                <CheckCircle2 size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sampleBand" id="samples">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Example Campaign Outputs</p>
              <h2>See what VIDSLOOM can make.</h2>
              <p>
                The goal is usable creative: videos, captions, hooks, CTAs, thumbnails, and schedule windows that move
                buyers toward bookings, enquiries, sales, or follow-up conversations.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/workspace-demo">
              View demo
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="sampleGrid">
            {sampleVideos.map((sample) => (
              <article key={sample.title} className="sampleCard">
                <video autoPlay muted loop playsInline preload="metadata" poster={sample.poster}>
                  <source src={sample.src} type="video/mp4" />
                </video>
                <div>
                  <h3>{sample.title}</h3>
                  <p>{sample.text}</p>
                  <dl className="sampleMeta">
                    <div>
                      <dt>Hook</dt>
                      <dd>{sample.hook}</dd>
                    </div>
                    <div>
                      <dt>Caption</dt>
                      <dd>{sample.caption}</dd>
                    </div>
                    <div>
                      <dt>CTA</dt>
                      <dd>{sample.cta}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
          <div className="trendTracePanel" aria-label="How the sample videos were generated">
            <div className="trendTraceIntro">
              <p className="siteEyebrow">Trend-To-Video Proof</p>
              <h3>These samples came from VIDSLOOM campaign runs, not random placeholder clips.</h3>
              <p>
                Each sample started with a VIDSLOOM campaign run. The intelligence layer identified repeatable
                short-form patterns, then the VIDSLOOM renderer turned the selected concept, hook, CTA, and source
                visuals into the resulting MP4.
              </p>
            </div>
            <div className="trendTraceGrid">
              {trendProof.map((proof) => (
                <article key={proof.title} className="trendTraceCard">
                  <div className="trendResultVideo">
                    <video autoPlay muted loop playsInline preload="metadata" poster={proof.poster}>
                      <source src={proof.videoSrc} type="video/mp4" />
                    </video>
                  </div>
                  <div className="traceCardTop">
                    <span>{proof.title}</span>
                    <strong>AI-generated</strong>
                  </div>
                  <h4>{proof.businessName}</h4>
                  <dl>
                    <div>
                      <dt>Trend source</dt>
                      <dd>{proof.source}</dd>
                    </div>
                    <div>
                      <dt>Trend idea</dt>
                      <dd>{proof.scoutSignal}</dd>
                    </div>
                    <div>
                      <dt>Remix formula</dt>
                      <dd>{proof.remix}</dd>
                    </div>
                    <div>
                      <dt>Generated output</dt>
                      <dd>{proof.output}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <p className="trendTraceNote">
              Transparent boundary: VIDSLOOM uses AI to research trend patterns and generate concepts. These public
              MP4s are rendered samples from VIDSLOOM campaign outputs and generated source visuals. Customer videos are
              regenerated from the customer&apos;s own offer, proof, assets, brand rules, and approvals.
            </p>
          </div>
        </div>
      </section>

      <section className="selfProofBand" aria-label="VIDSLOOM uses VIDSLOOM to market itself">
        <div className="sectionInner selfProofLayout">
          <div className="sectionLead">
            <p className="siteEyebrow">VIDSLOOM Uses VIDSLOOM</p>
            <h2>Our first proof loop is our own growth engine.</h2>
            <p>
              VIDSLOOM is being run as its own first customer. The same workspace that creates customer campaigns is
              used to generate VIDSLOOM videos, outreach angles, landing-page proof, follow-up assets, and posting
              queues. We show real assets now and attach public links and performance snapshots as they go live.
            </p>
          </div>
          <div className="selfProofGrid">
            {selfMarketingProof.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="selfProofCard">
                  <Icon size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pilotProofLibraryBand" aria-label="VIDSLOOM pilot proof library">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Pilot Proof Library</p>
              <h2>Six business use cases with generated output and the real metric we would capture next.</h2>
              <p>
                These are VIDSLOOM-generated sample campaigns, not fabricated client testimonials. Each card shows the
                video format, caption, CTA, posting window, and the exact pilot evidence needed to turn it into a
                verified case study.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/pilot">
              Start a pilot
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="pilotProofLibraryGrid">
            {pilotProofLibrary.map((item) => (
              <article key={item.id} className="pilotProofLibraryCard">
                <video autoPlay muted loop playsInline preload="metadata" poster={item.posterUrl}>
                  <source src={item.videoUrl} type="video/mp4" />
                </video>
                <div className="pilotProofLibraryBody">
                  <div className="traceCardTop">
                    <span>{item.industry}</span>
                    <strong>{item.buyer}</strong>
                  </div>
                  <h3>{item.generatedOutput}</h3>
                  <p>{item.brief}</p>
                  <dl>
                    <div>
                      <dt>Trend formula</dt>
                      <dd>{item.trendFormula}</dd>
                    </div>
                    <div>
                      <dt>Caption and CTA</dt>
                      <dd>
                        {item.caption} {item.cta}
                      </dd>
                    </div>
                    <div>
                      <dt>Schedule</dt>
                      <dd>{item.schedule}</dd>
                    </div>
                    <div>
                      <dt>Proof status</dt>
                      <dd>{item.proofStatus}</dd>
                    </div>
                    <div>
                      <dt>Next metric</dt>
                      <dd>{item.nextMetric}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workspaceBand">
        <div className="sectionInner workspaceLayout" id="workspace">
          <div className="workspaceLead">
            <p className="siteEyebrow">AI Workspace Walkthrough</p>
            <h2>See the workspace that turns a brief into videos and a posting queue.</h2>
            <p>
              Enter the business context, let VIDSLOOM study trends and build campaigns, review videos and captions,
              then approve the publishing queue.
            </p>
            <div className="workspaceActions">
              <Link className="siteButton primarySiteButton" href="/workspace-demo">
                Open demo
                <ArrowRight size={18} />
              </Link>
              <a className="siteButton secondaryDarkButton" href="#samples">
                See samples
                <PlayCircle size={18} />
              </a>
            </div>
          </div>
          <div className="workspaceBoard" aria-label="VIDSLOOM workspace workflow">
            <div className="workspaceScreen">
              <div className="workspaceScreenHeader">
                <span>VIDSLOOM workspace</span>
                <strong>Live AI flow</strong>
              </div>
              <div className="workspaceScreenGrid">
                {workspaceTrace.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.step} className="workspaceStepCard">
                      <div className="workspaceStepTop">
                        <span>{item.step}</span>
                        <Icon size={19} />
                      </div>
                      <h3>{item.title}</h3>
                      <strong>{item.panel}</strong>
                      <p>{item.text}</p>
                    </article>
                  );
                })}
              </div>
              <div className="workspaceOutputStrip">
                <video autoPlay muted loop playsInline preload="metadata" poster="/samples/vidsloom-demo-poster.png">
                  <source src="/samples/vidsloom-demo-loop.mp4" type="video/mp4" />
                </video>
                <div>
                  <span>Output proof</span>
                  <strong>Trend intelligence + campaign pack + rendered video samples + approval queue</strong>
                  <p>Live AI flow: trend signals, campaign concepts, videos, captions, and review queue.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proofBand" id="workflow">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">How It Works</p>
              <h2>Share context once. Review the campaign. Approve the queue.</h2>
              <p>
                Tell VIDSLOOM the offer, audience, proof, and brand style. The workspace drafts hooks, scripts, videos,
                captions, CTAs, and posting windows. You approve, request changes, schedule, or connect accounts for
                optional auto-posting.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/growth-audit">
              Request audit
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="proofGrid">
            {workflow.map((point) => {
              const Icon = point.icon;
              return (
                <article key={point.label} className="proofCard">
                  <Icon size={22} />
                  <h3>{point.label}</h3>
                  <p>{point.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="proofAssetsBand">
        <div className="sectionInner proofAssetsLayout">
          <div>
            <p className="siteEyebrow">Social Proof Engine</p>
            <h2>Your business already has proof. VIDSLOOM turns it into video assets.</h2>
            <p>
              Reviews, results, product details, team expertise, customer questions, and repeatable outcomes become
              the raw material for campaigns that feel specific to the business instead of generic AI content.
            </p>
          </div>
          <div className="proofAssetGrid">
            {proofFormats.map((item) => (
              <p key={item}>
                <BadgeCheck size={18} />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="trustBand" aria-label="Security, compliance, and ownership">
        <div className="sectionInner">
          <div className="sectionLead">
            <p className="siteEyebrow">Security, Compliance, Ownership</p>
            <h2>Built to save time without creating brand, claim, or account risk.</h2>
            <p>
              Serious buyers need to know who owns the output, how claims are controlled, and what happens when social
              accounts are connected. VIDSLOOM keeps these choices explicit in the workflow.
            </p>
          </div>
          <div className="trustGrid">
            {trustAndCompliance.map((item) => (
              <article key={item.title} className="trustCard">
                <ShieldCheck size={21} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="proofBand" aria-label="Video quality, length, and posting controls">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Production Standard</p>
              <h2>Pick the length and quality. VIDSLOOM handles the production workflow.</h2>
              <p>
                Buyers do not need to understand prompts or editing. The customer chooses the business goal, approval
                mode, video length, and quality level; VIDSLOOM turns those settings into mobile-first video campaigns.
              </p>
              <div className="formatRail" aria-label="Available video lengths">
                {formatChoices.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <Link className="siteButton lightSiteButton" href="/pilot">
              Start with pilot
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="proofGrid">
            {qualityStandards.map((item) => (
              <article key={item.title} className="proofCard">
                <BadgeCheck size={22} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="pricingAssurance">
            <ShieldCheck size={20} />
            <p>
              Practical default: start with 15-20 second vertical videos, approval-first scheduling, large subtitles,
              clean safe zones, customer-approved proof, and one measurable CTA. Longer formats are reserved for proof,
              objection handling, education, or higher-consideration offers.
            </p>
          </div>
        </div>
      </section>

      <section className="fitBand">
        <div className="sectionInner fitLayout">
          <div>
            <p className="siteEyebrow">Best Fit</p>
            <h2>For teams that need video output, not another task on the to-do list.</h2>
            <p>
              VIDSLOOM is strongest when your business already has a real offer, a clear customer, and proof that can be
              converted into video. The customer does not need to edit videos; the system produces the queue and the
              customer approves it.
            </p>
          </div>
          <div className="fitList">
            {bestFit.map((item) => (
              <p key={item}>
                <BadgeCheck size={18} />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="pricingBand" id="pricing">
        <div className="sectionInner">
          <div className="proofHeader">
            <div>
              <p className="siteEyebrow">Pricing Guide</p>
              <h2>Start with a free plan, then choose a monthly video rhythm.</h2>
              <p>
                The free audit gives you a campaign direction before payment. Paid plans include done-for-you ideation,
                video production, captions, thumbnail frames, approval queues, and optional posting support after
                permissions are connected. Annual plans can be discounted by 15%.
              </p>
            </div>
            <Link className="siteButton lightSiteButton" href="/growth-audit">
              Request audit
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="pricingGrid">
            {pricingTiers.map((tier) => (
              <article key={tier.name} className={tier.featured ? "pricingCard featured" : "pricingCard"}>
                <div>
                  <span>{tier.featured ? "Most useful pilot" : "Pilot package"}</span>
                  <h3>{tier.name}</h3>
                  <strong className="pricingPrice">{tier.price}</strong>
                  <p>{tier.summary}</p>
                </div>
                <div className="pricingList">
                  {tier.points.map((point) => (
                    <p key={point}>
                      <CheckCircle2 size={17} />
                      {point}
                    </p>
                  ))}
                </div>
                <Link className={tier.featured ? "siteButton primarySiteButton pricingCta" : "siteButton lightSiteButton pricingCta"} href={tier.href}>
                  {tier.cta}
                  <ArrowRight size={18} />
                </Link>
              </article>
            ))}
          </div>
          <RoiCalculator />
          <div className="pricingAssurance">
            <ShieldCheck size={20} />
            <p>
              Auto-posting is optional. VIDSLOOM never needs your social passwords and does not publish directly until
              you connect each platform through its account permission flow and approve the publishing rules. Manual
              upload remains available for any platform or campaign. If your first paid cycle does not meet the agreed
              brief after revision, we review it for remake, credit, or refund. Secure payment is handled by the
              checkout provider; VIDSLOOM does not store card details.
            </p>
          </div>
          <div className="pricingFaqGrid" aria-label="Pricing questions">
            {pricingFaq.map((item) => (
              <article key={item.question} className="pricingFaqCard">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trustBand" aria-label="Customer trust and operating proof">
        <div className="sectionInner">
          <div className="sectionLead">
            <p className="siteEyebrow">Trust And Control</p>
            <h2>Clear enough for owners. Controlled enough for teams.</h2>
            <p>
              The system is designed to save time without taking risky actions on behalf of the business. Customers
              stay in control of brand approvals, platform connections, and publish rules.
            </p>
          </div>
          <div className="trustGrid">
            {trustSignals.map((item) => (
              <article key={item.title} className="trustCard">
                <ShieldCheck size={21} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pilotBand" id="plan">
        <div className="sectionInner pilotLayout">
          <div>
            <p className="siteEyebrow">Pilot Offer</p>
            <h2>Start with a free pilot. Leave with your first video campaign direction.</h2>
            <p>
              The pilot is built for speed: audit your offer, proof, platforms, and current content, produce a first
              video direction, then move into a monthly approval-first production rhythm only if the fit is clear.
            </p>
          </div>
          <div className="pilotPanel">
            <div className="pilotRow">
              <MessageSquareText size={20} />
              <span>Personalized business and proof audit</span>
            </div>
            <div className="pilotRow">
              <CalendarCheck size={20} />
              <span>Approval-ready generated video queue</span>
            </div>
            <div className="pilotRow">
              <Film size={20} />
              <span>Videos, captions, thumbnails, CTAs, and posting windows</span>
            </div>
            <div className="pilotRow">
              <Rocket size={20} />
              <span>Organic tests first, paid campaign reuse after winners emerge</span>
            </div>
            <div className="pilotRow">
              <BarChart3 size={20} />
              <span>Response signals feed the next monthly campaign queue</span>
            </div>
            <Link className="siteButton primarySiteButton fullWidthButton" href="/growth-audit">
              Request free audit
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <Link className="mobileStickyCta" href="/growth-audit">
        See my free video plan
        <ArrowRight size={18} />
      </Link>
      <footer className="siteFooter">
        <div>
          <Link className="siteBrand" href="/">
            <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={32} height={32} unoptimized />
            <span>VIDSLOOM</span>
          </Link>
          <p>AI-powered short-form video marketing for businesses that need output, approvals, and follow-up.</p>
        </div>
        <nav aria-label="Legal and support links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund policy</Link>
          <Link href="/growth-audit">Free audit</Link>
        </nav>
      </footer>
    </main>
  );
}
