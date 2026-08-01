# VIDSLOOM

VIDSLOOM is an AI-powered short-form video marketing engine for businesses. It turns a business offer, proof points, target audience, brand voice, approval rules, and social account readiness into trend-aware videos, captions, thumbnails, CTAs, posting schedules, approval queues, and follow-up-ready campaign assets.

The current internal milestone is the Build with Gemini XPRIZE: launch a real customer-facing business with production AI operations, customer proof, and revenue before the hackathon deadline.

## Deadline

The Build with Gemini XPRIZE submission period ends on August 17, 2026 at 1:00 PM Pacific Time.

## Workspace Map

- `app/` - production MVP web app and API routes.
- `assets/brand/` - logo and brand assets.
- `docs/business/` - source business plan and strategy documents.
- `docs/implementation/` - implementation plans and generated delivery documents.
- `docs/marketing/` - customer acquisition, sales funnel, lead follow-up, and autoresponder plans.
- `docs/research/` - hackathon requirements, source notes, and market evidence.
- `docs/submission/` - Devpost narrative drafts and submission copy.
- `evidence/` - proof needed for judging: revenue, customers, expenses, and production AI operation.
- `lib/` - campaign engine, AI integration, validation schemas, evidence persistence, queues, and social posting helpers.
- `scripts/docs/` - reproducible document generation scripts.
- `submissions/devpost/` - final Devpost-ready packaging, screenshots, and exports.

## Operating Rule

Every build decision should support business viability, customer proof, reliable AI-native operations, and category impact.

## Run the MVP

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the customer-facing site. The internal QA campaign workbench runs at `http://localhost:3000/app`.

For Gemini-backed generation, set `GEMINI_API_KEY` or `GOOGLE_API_KEY`, or use Vertex/Gemini with `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`. Without Gemini configuration, the app uses a deterministic fallback so the workflow remains testable, but production evidence should use Gemini-backed runs.

The current app includes:

- Public front-facing site at `/`.
- Lead capture and sales funnel pages at `/growth-audit` and `/pilot`.
- QA-protected campaign engine at `/app`.
- Token-protected paid customer portal at `/portal`.
- Customer asset library in `/portal` for logos, product/service visuals, source clips, proof, offer sheets, brand rules, compliance notes, and reference links.
- Asset quality gate that scores customer assets, identifies missing proof/visuals/rights, and feeds a structured asset brief into campaign generation.
- Proof graph, claim review, storyboard, and production QA gates on every campaign concept before approval, scheduling, posting kits, or direct publishing.
- Direct Stripe Checkout at `/checkout?plan=starter` and `/checkout?plan=growth`.
- SendGrid-backed lead follow-up hooks for owner notifications, prospect autoresponders, and opted-in newsletter enrollment.
- VIDSLOOM-native newsletter list, segmentation, broadcasts, unsubscribe links, and lifecycle automations.
- Free/owned WhatsApp, SMS, and email contact links through `VIDSLOOM_WHATSAPP_NUMBER`, `VIDSLOOM_SMS_NUMBER`, and `VIDSLOOM_SALES_EMAIL`.
- Search-grounded `ZeitgeistScout` trend intelligence.
- Gemini campaign packs with hooks, scripts, captions, shot lists, calendars, experiments, and KPI plans.
- Generated 9:16 MP4 preview assets and poster frames for campaign concepts, persisted through `/api/generated-assets/...`.
- Automation setup for approval policy, notification channels, social account status, publishing mode, and budget preference.
- Cloud Tasks queues for planning, rendering, and publishing work.
- Customer portal publishing activity timeline that summarizes generated, queued, posted, blocked, and proof-captured states.
- Publishing queue that identifies whether each post is ready to schedule, waiting for assets/approval, already queued, published, or blocked by missing customer OAuth/platform permissions.
- Internal hybrid AI media-generation pipeline with asset analysis, duration segmentation, shot-level prompt compilation, deterministic QA/regeneration decisions, render composition specs, and feature-flagged Gemini image/video/TTS media adapters.
- YouTube Shorts OAuth/upload path for approved customer accounts. Other direct platform paths stay disabled until their platform credentials and app approvals are configured.
- Manual posting kits for any platform that is not ready for direct auto-posting.
- QA/automation-protected ops alerts endpoint at `/api/ops/alerts` for stale planning/render jobs, failed or blocked publishing attempts, overdue approved posts, billing failures, social account renewal, and failed email sends.

## Generated Video Rendering

Campaign creation can render customer-specific preview MP4s with the bundled FFmpeg binary and Sharp-generated frames. Local development writes assets to `.vidsloom-data/generated-assets`. Production uses `gs://vidsloom-generated-assets-business-heroes-infinity` and serves private bucket objects through `/api/generated-assets/...`.

Customer-provided assets are stored separately from generated MP4s. The portal accepts protected uploads and URL references through `/api/customer/assets`, serves uploaded files only after customer portal authorization, and adds a structured asset-readiness summary to the AI campaign brief so outputs use real business proof and visuals where available.

Every generated campaign pack now carries a proof graph, per-concept claim review, shot-level storyboard, generation routing status, and production quality gate. Publishing actions are blocked server-side until the concept passes the proof, claim, storyboard, and QA checks, so missing assets or unsupported claims cannot be bypassed from the portal UI.

The AI media pipeline lives under `lib/media-generation/`. It follows the consolidated implementation plan in `docs/implementation/ai_video_generation_pipeline_plan.md`: AI plans and generates clean reference frames/clips, while exact logos, proof, text, prices, subtitles, and CTAs remain deterministic post-production overlays. The secured `/api/media/jobs` route can run a dry-run production plan, enqueue media work, or execute feature-flagged reference-frame/video/TTS generation.

Renderer controls:

- `VIDSLOOM_RENDER_DYNAMIC_ASSETS=true`
- `VIDSLOOM_RENDER_MAX_ASSETS=5`
- `VIDSLOOM_RENDER_CONCURRENCY=2`

AI media-generation controls:

- `VIDSLOOM_MEDIA_GENERATION_ENABLED=false`
- `VIDSLOOM_REFERENCE_FRAME_GENERATION_ENABLED=false`
- `VIDSLOOM_VIDEO_CLIP_GENERATION_ENABLED=false`
- `VIDSLOOM_TTS_ENABLED=false`
- `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image`
- `GEMINI_VIDEO_MODEL=veo-3.1-generate-001`
- `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview`
- `VIDSLOOM_MEDIA_QUEUE=vidsloom-media-production`
- `VIDSLOOM_MEDIA_BUDGET_PER_CAMPAIGN_CENTS=0`

Cloud Tasks rendering is configured in staging and production. The app can process render jobs through `/api/render/jobs`, and the new media-generation worker contract is exposed at `/api/media/jobs`, so customers do not need to keep the page open once jobs are queued.

## Publishing Automation

Production and staging have Cloud Scheduler sweeps for publishing jobs:

- Production job: `vidsloom-production-publishing-sweep`, every 15 minutes, POSTing to `https://vidsloom.com/api/publishing/jobs` with `{"limit":50}`.
- Staging job: `vidsloom-staging-publishing-sweep`, every 30 minutes, POSTing to `https://staging.vidsloom.com/api/publishing/jobs` with `{"limit":50,"dryRun":true}`.

Use this script to create or update the scheduler without printing sensitive headers:

```bash
scripts/configure-publishing-scheduler.sh production
scripts/configure-publishing-scheduler.sh staging
```

Direct posting is deliberately permission-gated:

- YouTube Shorts: implemented and enabled when the customer connects the approved channel through OAuth. Production uploads currently use the configured private visibility setting.
- TikTok, Instagram Reels, and LinkedIn: implementation paths exist, but production marks them disabled until their platform app credentials, scopes, and approvals are present.
- X and Facebook Reels: not enabled in this build; use the manual posting kit until API/media upload access is configured.

## Operational Alerts

Use the secured ops endpoint for production readiness checks:

```bash
GET /api/ops/alerts
POST /api/ops/alerts
```

Both methods require the QA session or the automation bearer secret. `GET` returns the current alert report. `POST` accepts:

- `{"notify":true,"minSeverity":"critical"}` to send a one-off internal SendGrid alert summary when matching issues exist.
- `{"acknowledgeIds":["alert-id"],"suppressHours":72,"note":"Known OAuth review state"}` to suppress known alerts temporarily.
- `?includeSuppressed=true` on `GET` to audit suppressed alerts.

The protected `/app` workspace includes a Production Ops Alert Center with active counts, suppressed-alert auditing, critical notification checks, and one-click acknowledgement for known alerts.

GCP monitoring setup is repeatable:

```bash
scripts/configure-ops-monitoring.sh
ENVIRONMENT=staging scripts/configure-ops-monitoring.sh
```

The script configures:

- Cloud Scheduler jobs `vidsloom-production-ops-alerts` and `vidsloom-staging-ops-alerts`, POSTing critical alert checks to each environment's `/api/ops/alerts`.
- Uptime checks `VIDSLOOM production health` and `VIDSLOOM staging health`.
- Environment-scoped alert policies for health uptime, Cloud Run 5xx, Cloud Run latency, Cloud Tasks failed attempts, and Cloud Tasks backlog.

By default, the script attaches policies to the first enabled GCP email notification channel. Set `NOTIFICATION_CHANNELS=projects/.../notificationChannels/...` to route staging or production to a different verified channel.

## Live Environments

- Production primary: https://vidsloom.com
- Staging primary: https://staging.vidsloom.com
- Production Cloud Run fallback: https://vidsloom-production-feiefrrvkq-as.a.run.app
- Staging Cloud Run fallback: https://vidsloom-staging-feiefrrvkq-as.a.run.app

Cloud Run deploys default to Google Cloud project `business-heroes-infinity`, using Vertex/Gemini, Firestore evidence storage with separate `VIDSLOOM_ENV` values, and the `vidsloom_sendgrid_api_key` Secret Manager secret for lead follow-up.

Deploys also set `VIDSLOOM_PUBLIC_BASE_URL` per environment so third-party redirects and customer portal links use the public domains instead of Cloud Run internal localhost URLs. Staging Stripe uses test-mode Secret Manager values and has been smoke-tested through Checkout, webhook activation, and the paid customer portal. Production Stripe remains live-mode only.

The deployed Gemini path uses `GEMINI_MODEL` first and `GEMINI_FALLBACK_MODEL` before deterministic fallback. The 2026-06-17 staging paid-customer smoke test verified checkout, onboarding, AI campaign planning, five dynamic 20-second MP4 renders, review scheduling, manual posting kit generation, and direct-post blocking when OAuth is not connected.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
