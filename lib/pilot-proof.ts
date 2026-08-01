export type PilotProofItem = {
  id: string;
  industry: string;
  buyer: string;
  brief: string;
  trendFormula: string;
  generatedOutput: string;
  videoUrl: string;
  posterUrl: string;
  caption: string;
  cta: string;
  schedule: string;
  proofStatus: string;
  nextMetric: string;
};

export const pilotProofLibrary: PilotProofItem[] = [
  {
    id: "restaurant-bookings",
    industry: "Restaurant",
    buyer: "Owner or manager",
    brief: "Turn a signature menu item, lunch rush, and pickup offer into a short reel that moves viewers toward an order.",
    trendFormula: "Food close-up + preparation motion + fast lunch decision",
    generatedOutput: "Beat-the-lunch-rush salmon bowl final assembly with pickup CTA",
    videoUrl: "/samples/restaurant-reel-sample.mp4",
    posterUrl: "/samples/restaurant-reel-poster.png",
    caption: "A 10-minute salmon bowl built for the lunch rush.",
    cta: "Order the bowl",
    schedule: "Thu or Fri, 4:30-6:30 PM local time",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach booking or enquiry screenshots.",
    nextMetric: "Bookings, WhatsApp enquiries, profile taps, and saved posts"
  },
  {
    id: "studio-trial",
    industry: "Clinic or wellness studio",
    buyer: "Studio owner",
    brief: "Turn a consultation offer and common buyer hesitation into a short reel that makes the first visit feel safe and easy.",
    trendFormula: "Problem-first hook + calm service visual + low-friction booking CTA",
    generatedOutput: "Trust-building consultation final assembly with booking CTA",
    videoUrl: "/samples/service-proof-sample.mp4",
    posterUrl: "/samples/service-proof-poster.png",
    caption: "Trust starts before the first enquiry.",
    cta: "Book a quick call",
    schedule: "Tue or Wed, 11:00 AM-1:00 PM local time",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach consultation bookings or enquiry proof.",
    nextMetric: "Consultation bookings, qualified enquiries, watch retention, and saves"
  },
  {
    id: "ecommerce-bundle",
    industry: "Ecommerce",
    buyer: "Founder or growth lead",
    brief: "Turn a product bundle into a clean routine demo, caption, and checkout CTA without unsafe product claims.",
    trendFormula: "Routine demo + product handling + travel-ready bundle framing",
    generatedOutput: "Skincare routine final assembly with sales CTA",
    videoUrl: "/samples/ecommerce-launch-sample.mp4",
    posterUrl: "/samples/ecommerce-launch-poster.png",
    caption: "Your next buyer decides in seconds.",
    cta: "Shop now",
    schedule: "Sun or Mon, 7:00-9:00 PM local time",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach product page or cart movement.",
    nextMetric: "Product clicks, add-to-cart rate, coupon use, and retargeting audience size"
  },
  {
    id: "coach-authority",
    industry: "Coach or consultant",
    buyer: "Solo expert",
    brief: "Convert one client objection into an authority-building short that drives replies or call bookings.",
    trendFormula: "Contrarian hook + mistake breakdown + one decision rule",
    generatedOutput: "Authority clip with comment or booking CTA",
    videoUrl: "/samples/service-proof-sample.mp4",
    posterUrl: "/samples/service-proof-poster.png",
    caption: "A better question creates a better buying decision.",
    cta: "Message READY",
    schedule: "Tue or Thu, 8:00-10:00 AM local time",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach reply quality or booked-call proof.",
    nextMetric: "Qualified replies, booked calls, profile visits, and lead quality"
  },
  {
    id: "local-service-proof",
    industry: "Local service",
    buyer: "Service business owner",
    brief: "Turn before-after proof, customer FAQ, and local urgency into a short that creates service enquiries.",
    trendFormula: "Problem-first hook + before-after proof + local CTA",
    generatedOutput: "Trust-building service proof video",
    videoUrl: "/samples/service-proof-sample.mp4",
    posterUrl: "/samples/service-proof-poster.png",
    caption: "See what changes before you book the first visit.",
    cta: "Request a quote",
    schedule: "Mon or Wed, 6:00-8:00 PM local time",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach enquiry or quote-request screenshots.",
    nextMetric: "Quote requests, calls, direct messages, and cost per qualified enquiry"
  },
  {
    id: "agency-client-queue",
    industry: "Agency",
    buyer: "Agency owner or marketing manager",
    brief: "Show how one client brief becomes videos, captions, approvals, and a posting queue the agency can manage.",
    trendFormula: "Workflow reveal + proof checklist + approval queue walkthrough",
    generatedOutput: "Client-ready campaign queue demo",
    videoUrl: "/samples/vidsloom-demo-loop.mp4",
    posterUrl: "/samples/vidsloom-demo-poster.png",
    caption: "From brief to approval-ready video queue without another editing bottleneck.",
    cta: "Book an agency demo",
    schedule: "LinkedIn midweek morning, Reels evening test",
    proofStatus: "VIDSLOOM-generated sample. Real pilot should attach client approval speed and retained-service value.",
    nextMetric: "Client approval time, production margin, retained revenue, and content throughput"
  }
];
