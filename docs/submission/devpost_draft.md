# VIDSLOOM Devpost Draft

## Devpost Draft Status

- Draft URL: https://devpost.com/submit-to/29541-build-with-gemini-xprize/manage/submissions/1049517-vidsloom/edit
- Current saved Devpost status: Draft, 2/5 steps done.
- Saved on Devpost: project name and elevator pitch.
- Not saved on Devpost yet: project details, additional info, final submission.
- Blocker: Devpost requires a real demo video URL for the project details step. Do not use a placeholder video link.
- Live staging URL: https://vidsloom-staging-feiefrrvkq-as.a.run.app
- Live production URL: https://vidsloom-production-feiefrrvkq-as.a.run.app

## Project Name

VIDSLOOM

## Tagline

Weaving the Fabric of Viral Content

## Category

Small Business Services

## Short Description

VIDSLOOM is an AI-native marketing engine that helps small businesses create, publish, test, and optimize short-form video campaigns with Gemini-powered agents running the workflow from trend discovery to performance learning.

## Longer Draft Narrative

VIDSLOOM helps small businesses compete with enterprise marketing teams by turning social video marketing into an AI-operated workflow. A business enters its brand information, product offer, customer audience, assets, approval rules, notification preferences, and social account readiness. VIDSLOOM's agents then monitor trends, generate campaign concepts and scripts, prepare captions and shot lists, build a publishing queue, flag account-permission blockers, and feed performance learning back into the next campaign cycle.

The product is designed for the Build with Gemini XPRIZE requirement that the business operate with AI, not merely use AI as a feature. Gemini is the planning and reasoning layer for trend analysis, script generation, brand voice adaptation, creative QA, and weekly performance recommendations. Google Cloud provides the production backbone through Cloud Run, Firestore, Pub/Sub, Cloud Scheduler, Cloud Storage, Cloud Logging, and Vertex AI integrations.

For the hackathon deadline, the MVP will focus on a narrower, revenue-ready workflow: onboarding a real small business, generating a weekly batch of campaign scripts and creative briefs, producing ready-to-post short-form videos or assisted video drafts, logging every AI decision, and proving customer value through revenue, leads, bookings, or measurable engagement improvements.

## Evidence Still Needed

- GitHub repository URL.
- Demo video URL.
- Revenue evidence.
- Expense evidence.
- Customer contacts and testimonials.
- Production agent logs and Google Cloud usage screenshots.

## Current Technical Evidence

- Production URL: https://vidsloom-production-feiefrrvkq-as.a.run.app
- Production health: `/api/health` returns `env=production`, `storage=firestore`, and Vertex/Gemini configured for `business-heroes-infinity`.
- Product split: `/` is the customer-facing site and `/app` is the campaign workbench.
- Production smoke campaign after trend/automation update: `campaign_65f1f1f756c5403ba1`, mode `gemini`, 5 concepts, 4 Search-grounded trend signals, 5 publishing-queue tasks, and 7 agent runs.
- Staging smoke campaign after trend/automation update: `campaign_cd4132b5a28b4ad1a5`, mode `gemini`, 5 concepts, 5 Search-grounded trend signals, 5 publishing-queue tasks, and 7 agent runs.
- Local Gemini smoke campaign after trend/automation update: `campaign_513ca6b4e51949888b`, mode `gemini`, 5 concepts, 4 Search-grounded trend signals, 5 publishing-queue tasks, and 7 agent runs.

## Project Details Copy

Use this for the Devpost "About the project" field once the demo video URL is ready.

```markdown
Inspiration

Small businesses need short-form video, but most do not have the time, team, or production rhythm to keep up with fast-moving social trends. VIDSLOOM is built for that gap. It gives small businesses an AI-operated marketing engine that turns their offer, audience, brand voice, and assets into weekly campaign packs.

What it does

VIDSLOOM uses Gemini-powered agents to create campaign concepts, hooks, scripts, captions, shot lists, trend remix formulas, posting queues, and performance reports. The current version includes a Search-grounded trend agent, customer automation setup, and an OAuth-aware publishing queue. Direct multi-platform auto-publishing activates only after each customer connects the required social account permissions; until then VIDSLOOM gives customers an approval-first queue with captions, hashtags, timing, asset checks, and manual-upload fallback.

AI operations

OfferProfiler structures each customer brief. ZeitgeistScout uses Gemini with Search grounding to identify current short-form trend formulas. TrendScout maps those formulas to the customer's audience and offer. ScriptForge writes scripts and captions. CreativeDirector prepares visual direction. PublisherAssist builds the OAuth-aware publishing queue. RevenueAnalyst summarizes campaign performance and recommends the next iteration. Humans handle sales, customer relationships, compliance judgment, account authorization, and final approval.

Built for XPRIZE

VIDSLOOM is being launched as a service-assisted SaaS business during the hackathon window. The final submission will include revenue evidence, expense disclosure, customer evidence, and production AI logs once those numbers are finalized.
```

## Built With Draft

Gemini, Google Cloud, Vertex AI, Cloud Run, Firestore, Cloud Storage, Pub/Sub, Cloud Scheduler, Cloud Logging, Stripe, Next.js, TypeScript
