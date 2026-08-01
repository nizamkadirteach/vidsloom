# VIDSLOOM World-Class AI Video Pipeline Consolidation

Last updated: 2026-06-18

## Operating Thesis

VIDSLOOM should not ask AI video models to produce finished marketing videos with exact business facts baked into the footage. The reliable, commercial-grade architecture is hybrid:

1. AI plans the campaign, trend formula, scripts, shot roles, reference frames, and short cinematic motion clips.
2. Deterministic post-production adds everything that must be exact: subtitles, captions, logos, offers, prices, reviews, proof screenshots, CTAs, disclosures, thumbnails, and final platform exports.
3. QA blocks publishing until proof, claims, safe zones, generated footage, and social permissions are review-safe.

This keeps the product promise strong while avoiding the main failure mode of AI video products: impressive clips that contain warped logos, fake text, fake proof, or unsupported claims.

## Consolidated Expert Recommendations

- Treat final 10s, 15s, 20s, 30s, 45s, and 60s videos as assembled timelines made from 4s, 6s, or 8s AI clips.
- Store trend intelligence as reusable creative formulas, not one-off memes or copyrighted-audio dependencies.
- Score every trend for organic fit, paid fit, transferability, business safety, compliance risk, and decay risk.
- Use customer assets and reference frames where visual consistency matters.
- Keep all readable text, exact logos, proof, pricing, captions, testimonials, ratings, claims, and CTAs out of generated footage.
- Add deterministic safe-zone-aware overlays in final assembly.
- QA every generated clip for metadata, first-three-second impact, motion coherence, artifact risk, text/logo leakage, proof risk, and claim risk.
- Limit regeneration attempts, then fall back to still-motion, programmatic proof cards, or customer asset requests.
- Keep production media execution behind feature flags until staging QA proves the route.

## Implemented In This Pass

- Expanded trend signal schema with `formulaSummary`, hook/shot/CTA/audio patterns, funnel stage, fit scores, risk scores, source URLs, recommended/avoid lists, and transferability.
- Updated trend prompting and normalization so partial AI responses cannot break campaign generation.
- Expanded media shot plans with creative formulas, visual goals, camera language, motion goals, safe-zone requirements, and clean overlay zones.
- Added prompt-packet quality profiles: target duration, clip duration, resolution, generation lane, final assembly requirement, regeneration cap, and best-practice notes.
- Added prompt-packet post-production plans: exact overlays, safe-zone policy, subtitle style, proof policy, CTA policy, and logo policy.
- Strengthened AI media prompts to explicitly forbid readable text, words, logos, labels, signage, fake UI, fake proof, prices, dashboards, and generated claims.
- Made the media adapter use the compiled prompt packet's clip duration and resolution.
- Expanded deterministic QA with metadata checks, semantic checks, verdicts, failure reasons, and regeneration recipes.
- Expanded regeneration requests with attempts, max attempts, retain/change fields, prompt deltas, updated negative prompts, and fallback escalation.
- Expanded render compositions with assembly strategy, safe-zone specs, thumbnail specs, CTA specs, and loudness targets.
- Added promoted-asset AI QA metadata and media-run summaries.
- Updated the workbench UI to show trend fit scores, risk scores, formula details, QA summaries, and deterministic assembly notes.
- Updated customer/operator duration and quality labels so video length and quality are explicit product choices.
- Updated default video quality instructions to enforce premium 9:16 framing, subtitles, safe zones, and deterministic post-production for exact facts.
- Added final review-video assembly from generated AI motion clips with deterministic hook, proof, subtitle, brand, and CTA overlays.
- Added poster-frame extraction and deterministic final MP4 QA metadata: playability, target duration, resolution, file size, checks, warnings, and verdict.
- Updated the media job promotion path so assembled final videos are promoted first, with generated shot clips retained as fallback assets.
- Added a workbench action for final assembly and visible final-video QA badges/warnings.
- Refreshed all three public sample videos with real 15-second final-assembled AI videos and updated sample provenance metadata.
- Rebuilt the homepage hero loop from the refreshed final-assembled restaurant, service, and ecommerce samples.

## Current Deployment Policy

- Staging may run reference-frame and limited video-clip generation for QA.
- Production serves refreshed AI-generated landing samples, but production media execution remains disabled by feature flags until the generation QA loop is reliable enough for paid customer workloads.
- Public UI remains vendor-neutral. It says AI, VIDSLOOM AI, AI media pipeline, and quality gate. It must not disclose model names, provider names, cloud-provider names, backend architecture, or infrastructure details.

## Remaining Next Phase

- Add actual multimodal frame/video QA after generation, using sampled frames plus deterministic ffprobe/OCR checks.
- Extend final timeline assembly with voiceover/music mix, platform-specific thumbnail variants, and export variants.
- Add customer-uploaded reference image routing into image-to-video requests.
- Add per-campaign budget accounting and generation-cost caps.
- Add performance learning from published results into future trend/formula ranking.
- Add C2PA/provenance manifest support for final rendered videos where feasible.
- Keep platform direct posting gated by customer OAuth and platform-approved scopes.
