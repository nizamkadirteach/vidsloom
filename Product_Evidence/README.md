# VIDSLOOM Product Evidence

Submission date: 2026-08-01

## Production URLs

- Production site: https://vidsloom.com
- Workspace: https://vidsloom.com/app
- Health check: https://vidsloom.com/api/health
- Public code repository: https://github.com/nizamkadirteach/vidsloom
- Demo video: https://youtu.be/lzBbxcgUmSo

## Current Production Configuration

The live health endpoint returned `ok=true`, `env=production`, and confirmed configured production storage, generated-asset rendering, planning queues, media-generation queues, publishing automation, AI configuration, authentication, SendGrid follow-up, native newsletter capture, Stripe checkout readiness, and YouTube Shorts direct posting.

The production health check also reports:

- Cloud/AI project: `business-heroes-infinity`
- Media generation enabled: reference frames, video clips, and TTS
- Queue-backed operations: planning, media generation, render jobs, and publishing jobs
- Social posting: YouTube Shorts direct upload enabled; other platforms are implemented or gated behind required customer OAuth/platform approval
- Billing: Stripe checkout ready with subscription fallback prices
- Follow-up: SendGrid sender configured, owner notification configured, inline autoresponder configured, native newsletter list enabled

## Included Evidence Files

- `vidsloom-production-home.png`: production customer-facing homepage screenshot
- `vidsloom-workspace.png`: production workspace/workflow screenshot
- `vidsloom-youtube-upload-proof.png`: YouTube upload/OAuth proof screenshot
- `vidsloom-evidence-metrics.png`: evidence/metrics proof screenshot
- `vidsloom_profit_and_loss_2026-08-01.csv`: interim P&L evidence for the Devpost draft

## Judge Notes

This package is an interim evidence package prepared on 2026-08-01 so the Devpost submission can be completed before the final hackathon deadline. Before the final lock on 2026-08-17, replace or supplement this folder with exported Google Cloud billing invoices/cost tables, Gemini/Vertex usage dashboards, Stripe revenue exports, SendGrid usage evidence, and customer evidence if new verified activity is recorded.

