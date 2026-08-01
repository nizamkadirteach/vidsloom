# VIDSLOOM Build with Gemini XPRIZE Submission Package - 2026-08-01

## Devpost Status

- Devpost status: submitted on 2026-08-01.
- Devpost manage URL: `https://devpost.com/submit-to/29541-build-with-gemini-xprize/manage/submissions/1049517-vidsloom/finalization`
- Current public project slug shown by Devpost preview: `https://devpost.com/software/vidloom`
- Category: Small Business Services
- Production site: `https://vidsloom.com`
- Production app/workspace: `https://vidsloom.com/app`
- Production health: `https://vidsloom.com/api/health`
- Demo video URL currently available: `https://youtu.be/lzBbxcgUmSo`
- GitHub repo: `https://github.com/nizamkadirteach/vidsloom`
- Product evidence folder: `Product_Evidence/`
- Interim P&L uploaded: `Product_Evidence/vidsloom_profit_and_loss_2026-08-01.xlsx`

## Current Submission Position

VIDSLOOM is an AI-operated short-form video marketing business for small businesses. It turns a business offer,
target audience, proof points, brand voice, assets, approval rules, notification channels, and social-account readiness
into trend-aware videos, captions, thumbnails, CTAs, posting schedules, approval queues, manual posting kits, optional
direct posting, and performance-learning evidence.

## Competition Fit

- Business category: Small Business Services.
- Google Cloud use: Cloud Run, Firestore, Cloud Storage, Cloud Tasks, Cloud Scheduler, Cloud Logging, Secret Manager,
  and Vertex/Gemini configuration.
- Gemini use: campaign planning, trend intelligence, scripts, captions, shot planning, quality checks, and media
  generation adapters.
- AI-native operations: lead capture, customer brief structuring, trend scouting, campaign generation, approval queue,
  publishing queue, proof capture, newsletter/follow-up automation, and ops-alert monitoring.

## Public Devpost Project Story

```markdown
## Inspiration

Small businesses need short-form video to win attention, but most owners do not have the time, team, or production
rhythm to keep up with fast-moving social platforms. VIDSLOOM was built for that gap: a practical AI-operated video
growth engine that turns a business offer, proof, target audience, brand voice, and approval rules into campaign assets
that can be reviewed, posted, measured, and improved.

## What it does

VIDSLOOM helps businesses produce short-form marketing campaigns without asking the owner to become a video editor. A
customer provides the business context: what they sell, who they serve, proof points, brand voice, assets, target
platforms, preferred video length, quality settings, notification rules, and social-account readiness. VIDSLOOM then
creates trend-aware campaign concepts, hooks, scripts, captions, thumbnails, CTAs, video samples, posting windows,
approval queues, and manual or direct-posting workflows.

The product is built around approval-first operations. Direct social posting is permission-gated: customers do not give
VIDSLOOM social passwords, and auto-posting only starts after a customer connects the relevant platform account and
approves publishing rules. Where direct posting is not available, VIDSLOOM still gives the customer a posting-ready kit.

## How we built it

VIDSLOOM is a Next.js and TypeScript application deployed on Google Cloud Run. Production storage uses Firestore and
Cloud Storage, async work is routed through Cloud Tasks and Cloud Scheduler, and operational evidence is exposed through
health checks, publishing queues, media-generation jobs, and ops-alert endpoints. The AI layer uses Gemini through
Google Cloud to support trend intelligence, campaign planning, scripts, creative direction, quality gates, and media
generation workflows.

The product also includes SendGrid-backed follow-up, a VIDSLOOM-native newsletter/autoresponder system, Stripe
Checkout, customer onboarding, customer asset intake, OAuth-aware social posting, YouTube Shorts upload support, and
visual QA scripts for the public landing videos and pages.

## AI-native operations

VIDSLOOM is not only an app that calls AI. The business workflow itself is operated through AI-assisted systems:

- Offer and audience intake turns messy owner inputs into structured campaign briefs.
- Trend intelligence maps current short-form patterns to the customer's category.
- Script and creative agents produce hooks, scripts, captions, shot lists, thumbnails, CTAs, and schedule windows.
- Quality gates check proof usage, claims, safe-zone readability, duration, and customer approval state.
- Publishing automation decides whether each post is ready, blocked, scheduled, manually postable, or waiting for
  account permissions.
- Follow-up automation notifies the owner and keeps opted-in prospects in a warm-market newsletter sequence.
- Evidence workflows capture live posts, screenshots, views, enquiries, bookings, sales notes, and next-test decisions.

Humans still handle customer relationships, final business judgment, compliance decisions, and final approval. AI
handles the repeatable work that normally prevents small businesses from producing consistent video marketing.

## Challenges we ran into

The hard part was making VIDSLOOM feel like a real business system instead of a demo generator. Short-form video
marketing has many failure modes: fake-looking visuals, unreadable overlays, hallucinated proof, unsupported claims,
unsafe social posting, weak customer follow-up, and unclear revenue evidence. We solved this with a hybrid pipeline:
Gemini plans and generates creative assets, while deterministic rendering and QA systems keep exact text, proof, claims,
logos, CTAs, and posting state controlled.

Social auto-posting was another constraint. Direct posting requires customer OAuth and platform approvals. VIDSLOOM
therefore ships both direct posting where available and manual posting kits everywhere else, so the customer still gets a
hands-off production workflow without unsafe credential handling.

## Accomplishments

- Production site deployed at `https://vidsloom.com`.
- Cloud Run production service deployed in `business-heroes-infinity`.
- Customer-facing landing page, pricing, audit form, pilot flow, newsletter, checkout, policy pages, and mobile-first UI.
- Internal campaign workspace with trend intelligence, campaign generation, video assets, approval queue, publishing
  queue, calendar, evidence capture, lead follow-up, newsletter operations, and ops alerts.
- AI media-generation pipeline with duration selection, quality mode, prompt compilation, reference-frame/video/TTS
  adapters, media QA, and final assembly.
- Public sample videos with automated and AI-assisted visual QA.
- YouTube Shorts OAuth/upload path implemented for approved customer accounts.
- Stripe checkout and SendGrid follow-up configured.

## What we learned

Small businesses do not want another content tool. They want reliable business outcomes: more enquiries, bookings,
appointments, product sales, warm follow-up, and clear proof of what was posted. VIDSLOOM therefore needs to behave like
a video growth operator: collect the right business inputs, generate the campaign, manage approvals, post or prepare the
post, notify the customer, and record evidence for the next cycle.

## What's next

Before the final deadline, VIDSLOOM should replace the current OAuth-focused demo video with a stronger full XPRIZE demo
showing the production workflow end to end: lead capture, customer intake, Gemini trend intelligence, generated videos,
approval queue, posting kit/direct posting, evidence capture, follow-up automation, Stripe checkout, and revenue/customer
proof. The final submission should also update verified arms-length revenue, expenses, customer evidence, and corporate
ID if available.
```

## Built With

Gemini, Google Cloud, Vertex AI, Cloud Run, Firestore, Cloud Storage, Cloud Tasks, Cloud Scheduler, Cloud Logging,
Secret Manager, Stripe, SendGrid, YouTube Data API, Next.js, React, TypeScript, Node.js, FFmpeg, Sharp, Zod.

## Private Judge Notes

Testing credentials must be entered only into Devpost private testing fields, not committed to Git.

Recommended private testing text:

```text
Production URL: https://vidsloom.com
Workspace URL: https://vidsloom.com/app
Testing account:
Username: [enter current VIDSLOOM QA username in Devpost only]
Password: [enter current VIDSLOOM QA password in Devpost only]

Suggested test flow:
1. Open https://vidsloom.com and inspect the customer-facing funnel.
2. Open /growth-audit and submit a test lead only if permitted by judging instructions.
3. Log in at /app with the QA account.
4. Use a quick-start business template, select video length/quality, confirm publishing/notification rules, and generate
   a campaign.
5. Inspect Trends, Videos, Publish, Calendar, and Proof + ROI tabs.
6. Check /api/health for production configuration.

Do not enter real customer social credentials. Direct posting requires customer OAuth and platform permissions; YouTube
upload support is implemented, while other direct posting paths remain permission-gated.
```

## Current Evidence Status

- Demo video: submitted but OAuth-focused; should be replaced with a stronger end-to-end XPRIZE video before final lock.
- Revenue: USD 0 verified arms-length revenue was submitted as of 2026-08-01. Update only if real revenue is booked.
- Expenses: an interim USD 0 P&L was submitted because final invoice exports were not verified during this submission pass.
  Replace it with Google Cloud, AI/API, SendGrid, Stripe, domain/hosting, contractor or labour, and marketing/CAC evidence
  if verified before final lock.
- Customer evidence: add consented customer names/contact info/testimonials in Devpost private fields or a redacted
  evidence package.
- Product evidence: production health, Cloud Run revision, visual QA reports, AI visual QA reports, campaign IDs, agent
  logs, Cloud usage screenshots, and Stripe/SendGrid/Firestore evidence.
