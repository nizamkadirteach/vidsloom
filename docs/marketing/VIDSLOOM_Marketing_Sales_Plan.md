# VIDSLOOM Marketing and Sales Plan

## Objective

Convert small business owners from first visit to paid pilot with the least possible friction: one short form, immediate email follow-up, optional one-tap WhatsApp/SMS handoff, direct paid checkout for ready buyers, and a clear path into a sample campaign pack.

## Target Customer

- Local service businesses, clinics, studios, restaurants, ecommerce brands, coaches, and small agencies.
- Owners who know short-form video matters but do not have a repeatable weekly content process.
- Teams with an existing offer and at least some usable raw material: product photos, founder clips, customer reviews, demos, or social links.

## Funnel

1. Awareness: organic short-form content, founder LinkedIn posts, direct outreach, partner referrals, and local business communities.
2. Landing page: `/` explains the customer outcome and pushes the free video growth audit.
3. Capture: `/growth-audit` collects business details, preferred contact channel, social links, budget range, timing, and newsletter opt-in.
4. Immediate response: `/api/leads` stores the lead, sends the internal sales notification, sends the prospect autoresponder, and adds opted-in prospects to the VIDSLOOM-native newsletter list.
5. Qualification: prioritize leads by urgency, budget, platform fit, and asset readiness.
6. Conversion: Starter and Growth buyers can go directly to `/checkout?plan=starter` or `/checkout?plan=growth`; Managed buyers go through `/growth-audit`.
7. Activation: Stripe webhook completion creates an active billing customer record, marks any linked lead as won, and moves the customer into onboarding and approval-first weekly queues.

## Landing Page Strategy

The public page must sell business outcomes, not hackathon proof. The first viewport should answer:

- What is this? A short-form video marketing engine for busy businesses.
- What does the owner get? Weekly ideas, scripts, captions, hashtags, shot lists, schedule windows, and approval queues.
- Why now? The owner saves time and tests organic content before paying to boost winners.
- What is the next step? Request a free growth audit or generate a sample campaign.

## Contact and Follow-Up Channels

SendGrid is the only paid automated communication channel in the current plan.

Free or owned channels:

- WhatsApp: use `wa.me` click-to-chat links with prefilled text. This starts a user-initiated conversation and does not require a paid messaging API.
- SMS: use `sms:` links with prefilled text. This opens the user's phone messaging app and does not send from the server.
- Email: use SendGrid for immediate transactional follow-up, owner notification, autoresponder, and newsletter enrollment.
- Phone: capture preferred contact and phone number for manual close.

Automated WhatsApp/SMS from the server should stay out of scope while the communication budget is limited to SendGrid, because true automated sending requires a provider such as Meta WhatsApp Cloud API, Twilio, Vonage, Plivo, or similar plus consent/compliance handling. Use WhatsApp/SMS as one-tap user-initiated handoff links for now.

## Paid Activation

Starter and Growth now support direct Stripe Checkout from the public pricing section.

Environment variables:

- `STRIPE_SECRET_KEY`: server-side Stripe API key, mounted from Secret Manager in Cloud Run.
- `STRIPE_WEBHOOK_SECRET`: server-side webhook signing secret.
- `STRIPE_PRICE_STARTER`: Stripe recurring monthly price ID for Starter.
- `STRIPE_PRICE_GROWTH`: Stripe recurring monthly price ID for Growth.

Routes:

- `/checkout?plan=starter`: direct Starter checkout.
- `/checkout?plan=growth`: direct Growth checkout.
- `/api/stripe/checkout`: validates customer details, creates a subscription-mode Checkout Session, and stores a `checkout-started` billing record.
- `/api/stripe/webhook`: verifies the raw Stripe signature, stores processed event IDs for idempotency, activates billing records on completed checkout, updates failed/cancelled subscriptions, and marks linked leads as `won`.
- `/checkout/success`: post-payment activation next step.
- `/checkout/cancel`: retry or free-audit fallback.
- `/portal`: token-protected customer portal for paid onboarding, approval preferences, social account readiness, and first campaign-pack generation.
- `/api/customer/onboarding`: validates the customer portal token, stores the paid onboarding brief, updates billing onboarding status, and sends customer/internal onboarding emails.
- `/api/customer/campaign`: validates the customer portal token and active billing status, then generates the first campaign pack from the onboarding brief.

Managed service remains consultative because custom volume, multi-location setup, and agency workflows need a scoped plan before payment.

Operational note as of 2026-06-14: no usable Stripe test-mode key was found in local/GCP env files. Staging now enforces `STRIPE_REQUIRE_TEST_MODE=true`, so checkout will not start there if the mounted secret is a live key. Add a dedicated test key to `STRIPE_SECRET_KEY_STAGING` plus staging test prices before running staging payment tests.

Paid customer onboarding:

- Checkout-created billing records include a portal access token.
- The checkout success page resolves the checkout session and sends the customer into `/portal`.
- Customers submit website/social links, offer, target audience, proof points, asset links, brand voice, platforms, cadence, approval contact, notification channel, posting timezone, and OAuth acknowledgement.
- VIDSLOOM records onboarding in `vidsloom_<env>_customer_onboarding` and moves billing onboarding status from `needs-intake` to `in-progress`.
- Active customers can generate their first campaign pack from the portal. The campaign is tagged `source=customer-portal` and linked to the billing customer ID.
- The portal is customer-facing and separate from the internal QA `/app` workbench.

## SendGrid Automation

Environment variables:

- `SENDGRID_API_KEY`: server-side API key, preferably from GCP Secret Manager.
- `SENDGRID_FROM_EMAIL`: verified sender email.
- `SENDGRID_FROM_NAME`: sender name, default `VIDSLOOM`.
- `SENDGRID_REPLY_TO_EMAIL`: reply-to address.
- `VIDSLOOM_SALES_EMAIL` or `SENDGRID_NOTIFY_EMAIL`: owner/sales notification recipient.
- `SENDGRID_LEAD_AUTORESPONDER_TEMPLATE_ID`: optional dynamic template for prospect autoresponder.
- `SENDGRID_OWNER_LEAD_TEMPLATE_ID`: optional dynamic template for owner notification.
- `SENDGRID_MARKETING_LIST_IDS`: optional comma-separated SendGrid Marketing Contacts list IDs for external sync.
- `SENDGRID_CONTACTDB_LIST_IDS`: optional comma-separated SendGrid ContactDB list IDs for external sync while the newer Marketing Contacts API is blocked.
- VIDSLOOM owns the primary mailing list in Firestore through `vidsloom_<env>_newsletter_subscribers`; SendGrid is used as the delivery transport, not as the source of truth.

Immediate jobs on lead submission:

- Owner alert: send lead summary, preferred channel, urgency, budget range, goal, and one-tap reply links.
- Prospect autoresponder: confirm the audit request and ask for 2-3 current social/profile links.
- Native subscriber enrollment: every opted-in lead and `/newsletter` signup is stored in the VIDSLOOM subscriber list with consent text, source, tags, active/unsubscribed status, and an unsubscribe token.
- Marketing contact sync: attempt to add to the configured SendGrid ContactDB or Marketing Contacts list only when `newsletterOptIn` is true. This is secondary and does not block capture.
- Warm-market sending: use the QA-protected `/app` newsletter panel to test-send or broadcast through SendGrid mail send to active VIDSLOOM subscribers.

SendGrid Marketing Contacts switch-over:

- The current SendGrid key can send mail and create/read ContactDB lists, but SendGrid rejects `/v3/marketing/lists` with `403` because Marketing Campaigns scopes are not available on the key/account.
- ContactDB recipient creation currently returns a contact-limit/upgrade error even though ContactDB recipient count is `0`; this indicates marketing contact capacity is disabled or unavailable on the SendGrid plan.
- Current ContactDB lists: staging `31152277`, production `31152278`.
- Once SendGrid Marketing Campaigns access is enabled, create a production list and a staging test list, then set `SENDGRID_MARKETING_LIST_IDS` separately on each Cloud Run service and retire `SENDGRID_CONTACTDB_LIST_IDS`.
- Required capability: Marketing Campaigns contact/list read and write permissions, plus `mail.send`.

VIDSLOOM-native newsletter specs:

- Public subscription form: `/newsletter`.
- Admin list/export: QA-protected `/api/newsletter` and CSV export.
- Segments: active contacts can be targeted by source/list-style segments such as all active, growth-audit opt-ins, pilot opt-ins, trend-notes subscribers, and sample-app users.
- Broadcast/test-send: QA-protected `/api/newsletter/send` and `/app` Warm Market panel. Each send creates a broadcast record with attempted/sent/skipped/failed counts.
- Lifecycle sequences: newsletter signups enter the Trend Notes Welcome sequence; opted-in audit leads enter the Audit Request Nurture sequence; opted-in pilot leads enter the Pilot Fast Follow-Up sequence.
- Automation runner: QA-protected `/api/newsletter/automations/run` sends due sequence steps. This can later be called by Cloud Scheduler.
- Send history: VIDSLOOM records newsletter, sequence, transactional, and internal notification send events so operations can see what happened even without SendGrid Marketing Campaigns.
- Unsubscribe: every newsletter email includes a personal `/api/newsletter/unsubscribe?token=...` link plus `List-Unsubscribe` headers.

## Autoresponder Sequence

Transactional lead confirmation, immediate:

- Subject: Your VIDSLOOM video growth audit request
- Purpose: confirm the requested audit, ask for links/assets, encourage direct reply. This uses contact consent, not marketing consent.

Newsletter welcome sequence, immediate:

- Subject: You are on the VIDSLOOM trend notes list
- Purpose: welcome the subscriber, explain what they will receive, and invite them to reply with their website or social profile.

Audit nurture sequence, Day 0, 2 hours:

- Subject: What VIDSLOOM checks before recommending video ideas
- Purpose: explain the offer/proof/audience inputs used before turning trends into video ideas.

Audit nurture sequence, Day 1:

- Subject: The first VIDSLOOM batch should usually be simple
- Purpose: educate on starter video queues: problem-first, proof/before-after, and offer explainer.

Audit nurture sequence, Day 3:

- Subject: How approval works before anything is posted
- Purpose: reduce friction by clarifying approvals, scheduling, and optional social OAuth permissions.

Pilot fast follow-up:

- Day 0, 1 hour: ask for website, proof, reviews, and available assets.
- Day 1: explain how the pilot should become a repeatable posting system.

Weekly newsletter:

- Trend-of-week explained in plain business language.
- Three remix formulas for local/services/ecommerce.
- One filming prompt using assets the owner already has.
- CTA: request audit, reply with links, or generate sample campaign.

## Lead Scoring

High priority:

- Urgency is `this-week`.
- Budget is `1500-5000` or `5000-plus`.
- Business has a clear offer and existing social/website links.
- Preferred channel is WhatsApp, SMS, or Phone and phone is present.

Medium priority:

- Urgency is `this-month`.
- Budget is `500-1500` or `not-sure`.
- Goal is concrete but assets are unclear.

Nurture:

- Urgency is `exploring`.
- No phone/social link.

Operational pipeline in `/app`:

- Every lead is scored on capture and assigned `hot`, `warm`, or `nurture`.
- The sales status path is `new -> contacted -> qualified -> proposal -> won` or `lost`; lower-intent contacts can move to `nurture`.
- The workspace shows due follow-ups, contact links, score reasons, status, notes, next follow-up time, task, and recent sales activity.
- Quick actions are available for email, WhatsApp, and SMS when the lead supplied the required contact data.
- Follow-up tasks should focus on the fastest conversion action: ask for website/social links, proof points, menu/product/service page, existing videos, reviews, and preferred pilot timing.
- Budget is `under-500`.

## Sales Motion

1. Reply within 5 minutes for high-priority leads.
2. Ask for links/assets if missing.
3. Prepare one sharp sample angle before the first call.
4. Sell the pilot as a low-friction operational setup: audit, first campaign pack, weekly queue, approval workflow.
5. Avoid guaranteeing virality, revenue, or platform reach. Promise speed, consistency, trend awareness, lower creative waste, and measurable learning.

## KPIs

- Landing page to audit request: target 8-15 percent for warm traffic.
- Audit request to reply: target 30-50 percent.
- Reply to call/booked review: target 25-40 percent.
- Audit to paid pilot: target 10-25 percent after offer/pricing validation.
- Newsletter open rate: target 30 percent or better for early warm list.
- Time to first human follow-up: under 5 minutes for high-priority leads.

## Implementation Notes

- Keep SendGrid keys server-side only.
- Store leads in Firestore for staging/production and local JSON for development.
- Keep newsletter opt-in separate from required audit contact consent.
- Use SendGrid Marketing Contacts only for opted-in leads.
- Keep WhatsApp/SMS as user-initiated links until a paid messaging provider is approved.
- As of 2026-06-17, production uses `https://vidsloom.com` and staging uses `https://staging.vidsloom.com`.
- Production publishing automation runs every 15 minutes through Cloud Scheduler and `/api/publishing/jobs`.
- Staging publishing automation runs every 30 minutes in dry-run mode so the worker path is exercised without posting test content.
- Sales copy may promise approval queues, posting schedules, manual posting kits, and optional direct auto-posting after customer OAuth/platform permissions are connected.
- Do not market TikTok, Instagram Reels, LinkedIn, X, or Facebook Reels as live direct-auto-posting channels until their platform credentials, scopes, and approvals are configured.
- YouTube Shorts direct posting is configured for approved OAuth users, but Google sensitive-data access verification is still under review as of 2026-06-17.
