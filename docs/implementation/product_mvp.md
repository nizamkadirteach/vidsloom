# VIDSLOOM Product MVP

## Current Product Surface

The repo now includes a working Next.js MVP:

- Customer-facing public site at `/`.
- Campaign workbench at `/app`.
- Token-protected customer portal at `/portal`.
- Customer intake form.
- Customer asset library for logos, product/service visuals, source clips, proof assets, offer sheets, brand rules, compliance notes, and reference links.
- Asset quality gate that scores readiness, flags missing assets/usage rights, and guides customers toward better video inputs before generation.
- Campaign proof graph that maps customer intake, asset library items, proof notes, offer facts, usage rights, and compliance notes into claim-safe generation inputs.
- Per-concept claim review, shot-level storyboard, generation routing status, and production QA gate before approval, posting kits, scheduling, or direct publishing.
- Platform and cadence selection.
- Automation setup for publishing mode, approval policy, social account readiness, notification channels, posting timezone, quiet hours, asset source, and budget preference.
- Server-side campaign generation route.
- Gemini integration through `@google/genai`.
- Search-grounded `ZeitgeistScout` trend intelligence with remix formulas, organic plays, paid variants, cost levels, and freshness caveats.
- Deterministic fallback when no Gemini key is configured.
- Reviewable campaign pack: brief, positioning, trend intelligence, trend angles, video concepts, publishing queue, publishing calendar, experiments, KPI plan, risks, and next actions.
- Publishing queue with captions, hashtags, asset checklists, approval checklists, cost-control guidance, and platform permission requirements.
- Generated 9:16 MP4 preview assets and poster frames persisted through Cloud Storage in production.
- Hybrid AI media-generation foundation under `lib/media-generation/`: asset intelligence, duration segmentation, shot-level production plans, prompt packets, deterministic QA/regeneration, render composition specs, feature-flagged Gemini image/video/TTS adapters, and secured `/api/media/jobs` dry-run/execution endpoint.
- Stripe subscription checkout with customer portal handoff after payment.
- VIDSLOOM-native newsletter capture, segmentation, broadcast sending, unsubscribe tokens, and lifecycle automation.
- OAuth start/callback routes for social account connections where platform credentials and app approvals are available.
- Direct YouTube Shorts upload path for approved customer accounts, with private visibility as the current production default.
- Manual-assisted posting kit for any platform or customer that is not ready for direct publishing.
- Cloud Tasks-backed planning, rendering, and publishing jobs.
- Cloud Scheduler production publishing sweep every 15 minutes, plus staging dry-run publishing sweep every 30 minutes.
- Customer-facing publishing activity timeline in `/portal` that summarizes generated, queued, posted, blocked, and proof-captured states.
- QA/automation-protected ops alerts endpoint for stale planning/rendering, failed publishing, overdue approved posts, billing issues, social account renewal, and failed email events.
- Production Ops Alert Center in `/app` for active alert counts, suppressed-alert auditing, critical notification checks, and one-click acknowledgement.
- Alert acknowledgement/suppression for known operational warnings, stored in `vidsloom_<env>_ops_alert_suppressions`.
- Cloud Monitoring uptime and alert policies for production and staging health, Cloud Run 5xx, Cloud Run latency, Cloud Tasks failures, and Cloud Tasks backlog.
- Cloud Scheduler jobs `vidsloom-production-ops-alerts` and `vidsloom-staging-ops-alerts` that check `/api/ops/alerts` and send internal email only when active critical alerts exist.
- Agent evidence records for OfferProfiler, ZeitgeistScout, TrendScout, ScriptForge, CreativeDirector, PublisherAssist, and RevenueAnalyst.
- Local evidence persistence in `.vidsloom-data/`, ignored by Git.
- Evidence feed at `/api/evidence`.
- Mobile-first responsive workbench with single-column phone layout, touch-sized controls, sticky generate action, and card-style mobile calendar rendering.
- Staging primary URL: https://staging.vidsloom.com
- Production primary URL: https://vidsloom.com
- Staging Cloud Run URL: https://vidsloom-staging-feiefrrvkq-as.a.run.app
- Production Cloud Run URL: https://vidsloom-production-feiefrrvkq-as.a.run.app

## Production Configuration

Current production AI operation:

- Cloud Run staging service: `vidsloom-staging`.
- Cloud Run production service: `vidsloom-production`.
- Runtime service account: `vidsloom-runner@business-heroes-infinity.iam.gserviceaccount.com`.
- Vertex/Gemini through ADC with `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT=business-heroes-infinity`, and `GOOGLE_CLOUD_LOCATION=us-central1`.
- Gemini response controls: Search grounding is isolated to `ZeitgeistScout`; the full campaign pack uses controlled JSON generation. `VIDSLOOM_TREND_TIMEOUT_MS` and `VIDSLOOM_PACK_TIMEOUT_MS` bound slow model calls.
- Gemini resilience: deployed environments use `GEMINI_MODEL` as the primary model and `GEMINI_FALLBACK_MODEL` before deterministic fallback. As of 2026-06-17, the primary model returned Vertex `429 RESOURCE_EXHAUSTED` during staging QA, and `gemini-2.5-flash-lite` successfully produced the paid-customer campaign pack.
- Persistent production datastore: Firestore, with staging and production separated by `VIDSLOOM_ENV`.
- Generated asset storage: production GCS bucket `vidsloom-generated-assets-business-heroes-infinity`.
- Customer asset storage: protected portal uploads use the configured VIDSLOOM asset bucket when available, falling back to the generated-asset bucket or local `.vidsloom-data/customer-assets` in development. Uploaded files are served through token-checked customer routes, not public bucket URLs.
- Production gates: every generated campaign pack stores `proofGraph`, `generationRouting`, per-concept `claimReview`, `storyboard`, and `qualityGate`. Review and publishing APIs reject approvals/scheduling when a concept is blocked or below the publish threshold.
- Planning queue: `vidsloom-planning-production`.
- Render queue: `vidsloom-render-production`.
- Publishing queue: `vidsloom-publishing-production`.
- Media generation queue contract: `VIDSLOOM_MEDIA_QUEUE` with worker URL `/api/media/jobs`; production feature flags should stay disabled until staging reference-frame/video QA passes.
- Cloud Tasks worker URLs: `/api/planning/jobs`, `/api/render/jobs`, and `/api/publishing/jobs` on the active public environment domain.
- Production publishing scheduler: `vidsloom-production-publishing-sweep`, every 15 minutes, POSTing to `https://vidsloom.com/api/publishing/jobs`.
- Staging publishing scheduler: `vidsloom-staging-publishing-sweep`, every 30 minutes, POSTing to `https://staging.vidsloom.com/api/publishing/jobs` with `dryRun: true`.
- Ops alert scheduler: `vidsloom-production-ops-alerts`, every 15 minutes, POSTing to `https://vidsloom.com/api/ops/alerts` with critical-only email notification enabled.
- Staging ops alert scheduler: `vidsloom-staging-ops-alerts`, every 30 minutes, POSTing to `https://staging.vidsloom.com/api/ops/alerts` with critical-only email notification enabled.
- Monitoring script: `scripts/configure-ops-monitoring.sh` creates/updates the production uptime check and Cloud Monitoring alert policies; run `ENVIRONMENT=staging scripts/configure-ops-monitoring.sh` for staging.
- Monitoring notification routing: both environments currently attach to the available verified GCP email channel; set `NOTIFICATION_CHANNELS` when a separate staging or production channel is created.
- Stripe subscription flow connected to customer records and checkout success portal handoff.
- Staging Stripe status as of 2026-06-17: test-mode key, Starter/Growth recurring prices, and staging webhook are configured in Secret Manager. Final staging smoke test completed from Stripe Checkout to `/checkout/success` to active paid customer portal.
- Public redirect base URL: `scripts/deploy-cloud-run.sh` sets `VIDSLOOM_PUBLIC_BASE_URL` to `https://staging.vidsloom.com` or `https://vidsloom.com` so Stripe, OAuth, onboarding notifications, and portal links do not resolve to Cloud Run internals.
- Paid-customer staging smoke test as of 2026-06-17: active test subscription submitted onboarding, generated an AI campaign pack, rendered five customer-specific 20-second highest-quality MP4 assets, saved review approvals, created a manual posting kit, and verified direct auto-posting blocks cleanly until customer OAuth is connected.
- SendGrid transactional delivery plus VIDSLOOM-native newsletter list capture and automations.
- Privacy and consent workflow for customer names, testimonials, screenshots, and metrics.
- Google OAuth app status as of 2026-06-17: production app is published and sensitive-data access verification is under review.
- Direct auto-posting requires customer social OAuth and platform-approved posting permissions. YouTube Shorts is configured for approved accounts; TikTok, Instagram Reels, and LinkedIn remain disabled until their platform app credentials/scopes are approved; X and Facebook Reels use manual posting kits in this build.

## API Endpoints

- `GET /api/health` - service, queue, AI, newsletter, billing, and social posting configuration status.
- `GET /api/campaigns` - list captured campaign packs.
- `POST /api/campaigns` - create a new campaign pack from validated customer intake.
- `GET /api/campaigns/:id` - fetch one campaign pack.
- `GET /api/evidence` - summarize campaign and agent-run evidence.
- `POST /api/customer/onboarding` - store paid customer onboarding details from `/portal`.
- `GET /api/customer/assets` - list a paid customer's asset library and readiness score.
- `POST /api/customer/assets` - upload or link a customer asset, score its quality, and store consent/usage-right metadata.
- `DELETE /api/customer/assets/:id` - archive a customer asset so it is no longer used for new generation.
- `GET /api/customer/assets/:id/file` - serve or redirect to an asset only after customer portal authorization.
- `POST /api/customer/campaign` - generate the first paid-customer campaign pack.
- `POST /api/customer/review` - store approval decisions and enqueue approved publishing tasks.
- `POST /api/customer/publish` - prepare manual posting kits or attempt direct publishing for customer-approved rows.
- `GET /api/social/oauth/start` - start a platform OAuth connection for authenticated QA or portal users.
- `GET /api/social/oauth/callback` - complete the platform OAuth flow and store encrypted tokens.
- `POST /api/planning/jobs` - process queued planning jobs.
- `POST /api/media/jobs` - QA/automation-protected hybrid media-generation worker. In dry-run mode it returns asset analysis, shot plans, prompt packets, QA reports, regeneration requests, and render composition specs; with feature flags enabled it can execute Gemini reference-frame, video-clip, and TTS generation.
- `POST /api/render/jobs` - process queued render jobs.
- `POST /api/publishing/jobs` - process publishing jobs, publishing sweeps, and proof follow-ups.
- `GET /api/ops/alerts` - QA/automation-protected operational alert report. Use `includeSuppressed=true` to include temporarily acknowledged alerts.
- `POST /api/ops/alerts` - optionally send a one-off internal alert email for matching operational issues, and/or acknowledge alert IDs for temporary suppression.
- `POST /api/newsletter` - capture newsletter subscribers.
- `POST /api/newsletter/send` - QA-protected newsletter broadcast/test-send.
- `POST /api/newsletter/automations/run` - run due newsletter/autoresponder lifecycle steps.
- `POST /api/stripe/checkout` - create subscription checkout sessions.
- `POST /api/stripe/webhook` - activate billing records and onboarding handoff after Stripe events.

## Immediate Next Build Priorities

1. Monitor and respond to Google OAuth verification until YouTube direct posting is available beyond approved testers.
2. Create and verify platform apps for Meta/Instagram, TikTok, and LinkedIn, then enable each direct-posting path only after scopes and review approvals are granted.
3. Add quota monitoring and model-budget controls for Vertex/Gemini so primary-model quota exhaustion is surfaced before customer jobs fall back to the secondary Gemini model.
4. Extend performance capture beyond YouTube: manual proof uploads, screenshot capture, post URL validation, and platform-specific metrics once API access exists.
5. Upgrade customer asset ingestion for larger raw clips with signed browser-to-storage uploads, thumbnail extraction, duration probing, and optional managed intake for drive folders.
6. Upgrade production gates with multimodal asset analysis so logos, screenshots, product/service visuals, and raw clips receive visual confidence scores instead of heuristic-only checks.
7. Connect asset selection more deeply into render composition so logos, proofs, offer sheets, and customer visuals are chosen per shot instead of only summarized for planning.
8. Add premium AI video generation routing for final media while keeping FFmpeg/Sharp as the assembly, subtitle, poster, and fallback renderer.
9. Produce real customer case studies: before/after content output, approval speed, published links, first 24/48-hour metrics, lead/revenue notes, and permissioned screenshots.
10. Decide whether to add a paid WhatsApp/SMS provider; until then keep WhatsApp/SMS as user-initiated links and use SendGrid for automated communications.
11. Prepare the billing migration plan from Dr Zam's Enterprises Pte Ltd to the incorporated VIDSLOOM entity once incorporation and banking are complete.
