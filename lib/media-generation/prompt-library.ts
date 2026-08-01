import type { CompiledPromptPacket } from "@/lib/media-generation/schemas";

export const MEDIA_PROMPT_VERSION = "media-pipeline-v1.1";

export type PromptTemplate = {
  id: string;
  version: string;
  type:
    | "master-video-brief"
    | "storyboard"
    | "per-shot-video"
    | "reference-image"
    | "product-scene"
    | "service-scene"
    | "broll"
    | "voiceover"
    | "subtitles"
    | "thumbnail"
    | "qa"
    | "regeneration";
  publicSummary: string;
  template: string;
};

export const mediaPromptTemplates: PromptTemplate[] = [
  {
    id: "master-video-brief",
    version: MEDIA_PROMPT_VERSION,
    type: "master-video-brief",
    publicSummary: "Creates proof-first short-form campaign angles from the approved business brief.",
    template:
      "Create a premium, platform-native, proof-first short-form video plan for a real business. Prioritize customer assets, real proof, and reusable trend formulas. Never invent testimonials, reviews, outcomes, awards, customers, revenue, medical results, financial results, or guarantees."
  },
  {
    id: "storyboard",
    version: MEDIA_PROMPT_VERSION,
    type: "storyboard",
    publicSummary: "Breaks the chosen concept into timed shots with source, proof, overlay, and CTA roles.",
    template:
      "Convert the chosen concept into a vertical short-form ad assembled from short motion shots. For each shot specify formula, goal, source type, proof requirement, visual style, camera language, motion goal, safe-zone needs, overlay text, and CTA role. Avoid generic montage pacing."
  },
  {
    id: "per-shot-video",
    version: MEDIA_PROMPT_VERSION,
    type: "per-shot-video",
    publicSummary: "Creates the motion prompt for one generated clip while keeping exact text and proof in post-production.",
    template:
      "Use the invariant business block plus one shot block. Focus on realistic motion, camera energy, lighting, physical scene detail, and business-specific visuals. Critical text, logos, proof, prices, captions, and CTAs will be added in post-production."
  },
  {
    id: "reference-image",
    version: MEDIA_PROMPT_VERSION,
    type: "reference-image",
    publicSummary: "Creates a clean reference frame, thumbnail plate, or first-frame anchor.",
    template:
      "Create a clean, high-fidelity 9:16 reference frame preserving the approved product, service, location, or person reference. No typography, no extra logos, no signage, no labels, no invented proof, and no unsupported details. Leave clean overlay space."
  },
  {
    id: "product-scene",
    version: MEDIA_PROMPT_VERSION,
    type: "product-scene",
    publicSummary: "Creates product-use scenes anchored to customer product references.",
    template:
      "Create a realistic product-use scene anchored to uploaded product references. Product color, form factor, label placement, and materials remain consistent, but readable label text is not generated. Show one believable use action only."
  },
  {
    id: "service-scene",
    version: MEDIA_PROMPT_VERSION,
    type: "service-scene",
    publicSummary: "Creates believable service-delivery shots without implying unapproved outcomes.",
    template:
      "Create a believable service-delivery moment using real environment cues. Show process, tools, staff, or context without implying unapproved results or guarantees."
  },
  {
    id: "broll",
    version: MEDIA_PROMPT_VERSION,
    type: "broll",
    publicSummary: "Creates non-proof supporting b-roll for the customer's category.",
    template:
      "Create premium supporting b-roll for the industry. This shot is non-proof support only. No fabricated results, testimonials, certificates, awards, reviews, or dashboards."
  },
  {
    id: "voiceover",
    version: MEDIA_PROMPT_VERSION,
    type: "voiceover",
    publicSummary: "Writes fast mobile voiceover from approved claims only.",
    template:
      "Write a short-form voiceover using only approved claims and proof. Open strong, keep sentences short, match the selected duration, and end with one clear CTA."
  },
  {
    id: "subtitles",
    version: MEDIA_PROMPT_VERSION,
    type: "subtitles",
    publicSummary: "Turns the approved script into mobile-native subtitle chunks.",
    template:
      "Create timestamped subtitle chunks with 2 lines max and 3-6 words per line where possible. Front-load keywords and avoid platform UI overlap."
  },
  {
    id: "thumbnail",
    version: MEDIA_PROMPT_VERSION,
    type: "thumbnail",
    publicSummary: "Creates short thumbnail text options and composition notes.",
    template:
      "Generate concise thumbnail options. Maximum four words, specific to the offer or pain point, not clickbait, with one proof-led and one curiosity-led option."
  },
  {
    id: "qa",
    version: MEDIA_PROMPT_VERSION,
    type: "qa",
    publicSummary: "Scores generated media for creative, technical, brand, proof, and claim safety.",
    template:
      "Review the generated media against the brief. Score metadata, first-frame impact, 3-second retention, motion coherence, artifact risk, absence of text/logos/signage, proof credibility, realism, brand fit, platform fit, CTA clarity, claim safety, and fake-proof risk."
  },
  {
    id: "regeneration",
    version: MEDIA_PROMPT_VERSION,
    type: "regeneration",
    publicSummary: "Regenerates only the failing part while preserving approved invariants.",
    template:
      "Regenerate only the failing shot. Keep business identity, proof policy, product appearance, brand palette, and lighting logic unchanged. Fix only the listed issues, expand the negative prompt with the failure reason, and simplify motion if needed."
  }
];

export const universalNegativeConstraints = [
  "low-resolution look",
  "blurry footage",
  "black bars",
  "letterboxing",
  "landscape video inside portrait frame",
  "bordered frame",
  "temporal flicker",
  "identity drift",
  "warped anatomy",
  "extra fingers",
  "extra limbs",
  "unstable hands",
  "malformed hands",
  "distorted faces",
  "floating objects",
  "inconsistent product shape",
  "readable words",
  "letters",
  "signage",
  "labels",
  "watermark",
  "unreadable generated text",
  "distorted logo",
  "logo-like marks",
  "random foreground props",
  "cropped partial faces",
  "off-brand colors",
  "cheap stock-ad feeling",
  "random background activity",
  "duplicate objects"
];

export const fakeProofConstraints = [
  "fabricated review screenshots",
  "invented star ratings",
  "fake awards",
  "fake certificates",
  "fake analytics dashboards",
  "fake before-after evidence",
  "fake customers",
  "fake patient results",
  "fake revenue",
  "fake testimonials"
];

export function publicPromptPacketSummary(packet: CompiledPromptPacket) {
  return {
    id: packet.id,
    shotId: packet.shotId,
    conceptTitle: packet.conceptTitle,
    costTier: packet.costTier,
    publicSummary: packet.publicSummary,
    qaConstraints: packet.qaConstraints,
    safetyConstraints: packet.safetyConstraints
  };
}
