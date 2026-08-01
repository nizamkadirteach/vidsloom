"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { PublicCampaign } from "@/lib/public-campaign";
import type {
  BillingCustomer,
  CustomerAsset,
  CustomerAssetKind,
  CustomerAssetUsageRights,
  CustomerCampaignReview,
  CustomerOnboarding,
  CustomerPublishingPerformance,
  CustomerReviewStatus,
  GeneratedVideoAsset,
  Platform,
  PublishingAttempt,
  PublishingMethod,
  SocialConnection
} from "@/lib/schemas";
import {
  customerAssetKindGuidance,
  customerAssetKindLabels,
  summarizeCustomerAssetReadiness,
  type CustomerAssetReadiness
} from "@/lib/customer-assets";

const platformOptions: Platform[] = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "LinkedIn",
  "X",
  "Facebook Reels"
];

const channelOptions = ["Email", "WhatsApp", "SMS", "Slack"] as const;

const assetKindOptions: CustomerAssetKind[] = [
  "logo",
  "product-photo",
  "service-photo",
  "raw-video",
  "testimonial-proof",
  "review-screenshot",
  "menu-pricing",
  "brand-guide",
  "website-screenshot",
  "social-reference",
  "compliance-note",
  "other"
];

const usageRightsOptions: Array<{ value: CustomerAssetUsageRights; label: string }> = [
  { value: "owned-or-licensed", label: "Owned or licensed" },
  { value: "public-reference-only", label: "Reference only" },
  { value: "needs-review", label: "Needs review" }
];

const defaultQualityInstructions =
  "Use a strong first-three-second hook, premium 9:16 mobile framing, visible product/service context, realistic motion, large readable subtitles, claim-safe proof overlays, clean safe zones, and one clear CTA. Keep exact text, logos, prices, captions, reviews, metrics, and proof in deterministic post-production; never generate them inside AI footage.";

const previewAssets = [
  {
    label: "Local offer final preview",
    src: "/samples/restaurant-reel-sample.mp4",
    poster: "/samples/restaurant-reel-poster.png"
  },
  {
    label: "Service booking final preview",
    src: "/samples/service-proof-sample.mp4",
    poster: "/samples/service-proof-poster.png"
  },
  {
    label: "Product sales final preview",
    src: "/samples/ecommerce-launch-sample.mp4",
    poster: "/samples/ecommerce-launch-poster.png"
  }
];

const videoReviewActions: Array<{ status: CustomerReviewStatus; label: string }> = [
  { status: "approved", label: "Approve" },
  { status: "changes-requested", label: "Request edits" },
  { status: "regenerate", label: "Regenerate" }
];

const publishingReviewActions: Array<{ status: CustomerReviewStatus; label: string }> = [
  { status: "ready-to-schedule", label: "Ready" },
  { status: "scheduled", label: "Scheduled" },
  { status: "blocked", label: "Blocked" }
];

const performanceMetricFields: Array<{
  key: keyof Pick<
    CustomerPublishingPerformance,
    "views" | "likes" | "comments" | "shares" | "saves" | "clicks" | "directMessages" | "bookings" | "salesValue"
  >;
  label: string;
}> = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "clicks", label: "Clicks" },
  { key: "directMessages", label: "DMs" },
  { key: "bookings", label: "Bookings" },
  { key: "salesValue", label: "Sales value" }
];

type CustomerView = Pick<
  BillingCustomer,
  | "id"
  | "businessName"
  | "contactName"
  | "email"
  | "phone"
  | "plan"
  | "status"
  | "onboardingStatus"
  | "amountTotal"
  | "currency"
  | "createdAt"
>;

type PlanProfile = {
  label: string;
  videosPerMonth: number;
  platforms: number;
  cadence: "3 posts/week" | "5 posts/week" | "Daily" | "Launch sprint";
  reviewRhythm: string;
};

type PortalCampaign = {
  id: string;
  campaign: PublicCampaign;
};

type SocialConnectionView = Pick<
  SocialConnection,
  "id" | "platform" | "status" | "handle" | "accountName" | "autoPublish" | "scopes" | "expiresAt" | "updatedAt"
>;

type ApiIssue = {
  path?: Array<string | number>;
  message: string;
};

type OnboardingDraft = Omit<
  CustomerOnboarding,
  "id" | "createdAt" | "updatedAt" | "submittedAt" | "status" | "generatedCampaignIds"
>;

type ReviewDraft = Omit<CustomerCampaignReview, "id" | "createdAt" | "updatedAt" | "overallStatus">;
type PublishingReviewRow = ReviewDraft["publishingReviews"][number];
type PublishingQueueTask = PublicCampaign["pack"]["publishingQueue"][number];

type AssetDraft = {
  kind: CustomerAssetKind;
  label: string;
  notes: string;
  sourceUrl: string;
  usageRights: CustomerAssetUsageRights;
  usageConsent: boolean;
};

export function CustomerPortal({
  customer,
  accessToken,
  initialOnboarding,
  initialCampaigns,
  initialReviews,
  initialAssets,
  initialSocialConnections,
  planProfile
}: {
  customer: CustomerView;
  accessToken: string;
  initialOnboarding: CustomerOnboarding | null;
  initialCampaigns: PortalCampaign[];
  initialReviews: CustomerCampaignReview[];
  initialAssets: CustomerAsset[];
  initialSocialConnections: SocialConnectionView[];
  planProfile: PlanProfile;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => buildInitialDraft(customer, initialOnboarding, planProfile));
  const [onboarding, setOnboarding] = useState<CustomerOnboarding | null>(initialOnboarding);
  const [campaigns, setCampaigns] = useState<PortalCampaign[]>(initialCampaigns);
  const [reviews, setReviews] = useState<Record<string, CustomerCampaignReview>>(() =>
    Object.fromEntries(initialReviews.map((review) => [review.campaignId, review]))
  );
  const [assets, setAssets] = useState<CustomerAsset[]>(initialAssets);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCampaign = campaigns[0] ?? null;
  const canGenerate = Boolean(onboarding && ["active", "trialing", "manual-review"].includes(customer.status));
  const planPrice = useMemo(() => {
    if (!customer.amountTotal) return "";
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: customer.currency.toUpperCase()
    }).format(customer.amountTotal / 100);
  }, [customer.amountTotal, customer.currency]);

  const workflowSteps = buildWorkflowSteps({
    customer,
    onboarding,
    campaigns,
    review: activeCampaign ? reviews[activeCampaign.id] : undefined
  });
  const assetReadiness = useMemo(() => summarizeCustomerAssetReadiness(assets), [assets]);
  const campaignPollKey = campaigns.map((item) => campaignRenderKey(item.campaign)).join("|");
  const liveSocialConnections = useMemo(
    () =>
      new Map(
        initialSocialConnections
          .filter((connection) => connection.status === "connected")
          .map((connection) => [connection.platform, connection])
      ),
    [initialSocialConnections]
  );

  useEffect(() => {
    if (!campaigns.some((item) => isPlanningActive(item.campaign) || hasActiveRender(item.campaign))) return;

    let cancelled = false;
    const pollCampaigns = async () => {
      try {
        const params = new URLSearchParams({ customerId: customer.id, accessToken });
        const response = await fetch(`/api/customer/campaign?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json()) as {
          onboarding?: CustomerOnboarding | null;
          campaigns?: PortalCampaign[];
        };
        if (!response.ok || cancelled) return;
        if (data.onboarding) {
          setOnboarding(data.onboarding);
        }
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
      } catch {
        // Keep the current portal state visible; the next poll can recover.
      }
    };

    const timer = window.setInterval(pollCampaigns, 7000);
    void pollCampaigns();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [customer.id, accessToken, campaigns, campaignPollKey]);

  function update<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateVideoSetting<K extends keyof OnboardingDraft["videoSettings"]>(
    key: K,
    value: OnboardingDraft["videoSettings"][K]
  ) {
    setDraft((current) => ({
      ...current,
      videoSettings: {
        ...current.videoSettings,
        [key]: value
      }
    }));
  }

  function updateBrandKit<K extends keyof OnboardingDraft["brandKit"]>(key: K, value: OnboardingDraft["brandKit"][K]) {
    setDraft((current) => ({
      ...current,
      brandKit: {
        ...current.brandKit,
        [key]: value
      }
    }));
  }

  function updateCreativeSetting<K extends keyof OnboardingDraft["creativeSettings"]>(
    key: K,
    value: OnboardingDraft["creativeSettings"][K]
  ) {
    setDraft((current) => ({
      ...current,
      creativeSettings: {
        ...current.creativeSettings,
        [key]: value
      }
    }));
  }

  function togglePlatform(platform: Platform) {
    setDraft((current) => {
      const platforms = current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform];
      return {
        ...current,
        platforms: platforms.length ? platforms : [platform],
        connectedAccounts: platforms.map((item) => {
          const existing = current.connectedAccounts.find((account) => account.platform === item);
          return existing ?? { platform: item, handle: "", status: "not-connected", autoPublish: false };
        })
      };
    });
  }

  function toggleChannel(channel: (typeof channelOptions)[number]) {
    setDraft((current) => {
      const approvalChannels = current.approvalChannels.includes(channel)
        ? current.approvalChannels.filter((item) => item !== channel)
        : [...current.approvalChannels, channel];
      return { ...current, approvalChannels: approvalChannels.length ? approvalChannels : [channel] };
    });
  }

  function socialConnectUrl(platform: Platform) {
    const params = new URLSearchParams({
      platform,
      customerId: customer.id,
      accessToken,
      returnTo: `/portal?customer=${encodeURIComponent(customer.id)}&token=${encodeURIComponent(accessToken)}`
    });
    return `/api/social/oauth/start?${params.toString()}`;
  }

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/customer/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          customerId: customer.id,
          accessToken
        })
      });
      const data = (await response.json()) as { onboarding?: CustomerOnboarding; error?: string; issues?: ApiIssue[] };
      if (!response.ok || !data.onboarding) {
        throw new Error(formatApiError(data, "Onboarding could not be saved."));
      }
      setOnboarding(data.onboarding);
      setMessage("Onboarding saved. VIDSLOOM can now prepare the first campaign pack.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown onboarding error.");
    } finally {
      setSaving(false);
    }
  }

  async function generateCampaign() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/customer/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          accessToken
        })
      });
      const data = (await response.json()) as {
        onboarding?: CustomerOnboarding;
        campaign?: PublicCampaign;
        error?: string;
        issues?: ApiIssue[];
      };
      if (!response.ok || !data.campaign || !data.onboarding) {
        throw new Error(formatApiError(data, "Campaign generation could not start."));
      }
      const nextOnboarding = data.onboarding;
      const nextCampaign = data.campaign;
      const campaignId = nextOnboarding.generatedCampaignIds[0] ?? `campaign-${Date.now()}`;
      setOnboarding(nextOnboarding);
      setCampaigns((current) => [{ id: campaignId, campaign: nextCampaign }, ...current].slice(0, 3));
      setMessage(
        isPlanningActive(nextCampaign)
          ? "Campaign workspace created. VIDSLOOM is preparing trend intelligence, scripts, captions, schedule rows, and MP4 renders in the background."
          : hasActiveRender(nextCampaign)
          ? "Campaign pack created. Scripts, captions, and the schedule are ready while MP4 previews render automatically."
          : "First campaign pack generated. Review the videos, captions, and schedule below."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown campaign generation error.");
    } finally {
      setGenerating(false);
    }
  }

  function handleReviewSaved(review: CustomerCampaignReview) {
    setReviews((current) => ({ ...current, [review.campaignId]: review }));
  }

  return (
    <section className="portalShell">
      <div className="portalHero">
        <p className="siteEyebrow">Customer Portal</p>
        <h1>Your VIDSLOOM production setup</h1>
        <p>
          {customer.businessName} is on {planProfile.label}. Complete the brief once, generate the first campaign pack,
          then approve videos, request edits, capture proof, and prepare the schedule.
        </p>
      </div>

      <div className="portalStatusGrid">
        <article>
          <Sparkles size={20} />
          <span>Plan</span>
          <strong>{planProfile.label}</strong>
          <small>{planPrice || `${planProfile.videosPerMonth} videos/month`}</small>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Billing</span>
          <strong>{formatStatus(customer.status)}</strong>
          <small>{customer.status === "checkout-started" ? "Waiting for checkout confirmation" : "Ready for onboarding"}</small>
        </article>
        <article>
          <CalendarDays size={20} />
          <span>Monthly queue</span>
          <strong>{planProfile.videosPerMonth} videos</strong>
          <small>{planProfile.reviewRhythm}</small>
        </article>
        <article>
          <CheckCircle2 size={20} />
          <span>Review state</span>
          <strong>{formatStatus(activeCampaign ? reviews[activeCampaign.id]?.overallStatus ?? "needs-review" : onboarding?.status ?? "not-started")}</strong>
          <small>{activeCampaign ? "Campaign queue active" : "Brief required"}</small>
        </article>
      </div>

      <div className="portalWorkflowSteps" aria-label="VIDSLOOM production workflow">
        {workflowSteps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.label} className={`portalWorkflowStep ${step.state}`}>
              <Icon size={18} />
              <div>
                <strong>{step.label}</strong>
                <span>{step.text}</span>
              </div>
            </article>
          );
        })}
      </div>

      <CustomerAssetLibrary
        accessToken={accessToken}
        assets={assets}
        customerId={customer.id}
        onAssetsUpdated={setAssets}
        readiness={assetReadiness}
      />

      <div className="portalLayout">
        <form className="portalForm" onSubmit={saveOnboarding}>
          <div className="portalPanelHeader">
            <h2>Business brief</h2>
            <p>VIDSLOOM uses this to generate videos, captions, thumbnails, CTAs, schedules, and approval checks.</p>
          </div>

          <div className="portalFormSection">
            <h3>1. Business context</h3>
            <div className="portalFields">
              <label>
                <span>
                  Website, shop, or social profile <em aria-hidden="true">*</em>
                </span>
                <input value={draft.websiteSocial} onChange={(event) => update("websiteSocial", event.target.value)} required />
              </label>
              <label>
                <span>
                  Business type <em aria-hidden="true">*</em>
                </span>
                <input value={draft.industry} onChange={(event) => update("industry", event.target.value)} required />
              </label>
              <label>
                <span>Location or market <small>optional</small></span>
                <input value={draft.locations} onChange={(event) => update("locations", event.target.value)} />
              </label>
              <label>
                <span>
                  Brand voice <em aria-hidden="true">*</em>
                </span>
                <input value={draft.brandVoice} onChange={(event) => update("brandVoice", event.target.value)} required />
              </label>
              <label className="portalWide">
                <span>
                  Offer <em aria-hidden="true">*</em>
                </span>
                <textarea value={draft.offer} onChange={(event) => update("offer", event.target.value)} required />
              </label>
              <label className="portalWide">
                <span>
                  Target audience <em aria-hidden="true">*</em>
                </span>
                <textarea value={draft.targetAudience} onChange={(event) => update("targetAudience", event.target.value)} required />
              </label>
              <label className="portalWide">
                <span>
                  Primary goal <em aria-hidden="true">*</em>
                </span>
                <textarea value={draft.primaryGoal} onChange={(event) => update("primaryGoal", event.target.value)} required />
              </label>
            </div>
          </div>

          <div className="portalFormSection">
            <h3>2. Proof and assets</h3>
            <div className="portalFields">
              <label className="portalWide">
                <span>Proof points, reviews, results, FAQs <small>optional but recommended</small></span>
                <textarea value={draft.proofPoints} onChange={(event) => update("proofPoints", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Asset links <small>optional</small></span>
                <textarea value={draft.assetLinks} onChange={(event) => update("assetLinks", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Current content or reference accounts <small>optional</small></span>
                <textarea value={draft.currentContent} onChange={(event) => update("currentContent", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Claims, compliance limits, or topics to avoid <small>optional</small></span>
                <textarea value={draft.constraints} onChange={(event) => update("constraints", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="portalFormSection">
            <h3>3. Platforms and approvals</h3>
            <div className="portalChoiceBlock">
              <span>
                Platforms <em aria-hidden="true">*</em>
              </span>
              <div>
                {platformOptions.map((platform) => (
                  <label key={platform}>
                    <input checked={draft.platforms.includes(platform)} type="checkbox" onChange={() => togglePlatform(platform)} />
                    {platform}
                  </label>
                ))}
              </div>
            </div>

            <div className="portalFields">
              <label>
                <span>
                  Posting cadence <em aria-hidden="true">*</em>
                </span>
                <select value={draft.postingCadence} onChange={(event) => update("postingCadence", event.target.value as OnboardingDraft["postingCadence"])}>
                  <option value="3 posts/week">3 posts/week</option>
                  <option value="5 posts/week">5 posts/week</option>
                  <option value="Daily">Daily</option>
                  <option value="Launch sprint">Launch sprint</option>
                </select>
              </label>
              <label>
                <span>
                  Video length <em aria-hidden="true">*</em>
                </span>
                <select
                  value={draft.videoSettings.durationSeconds}
                  onChange={(event) =>
                    updateVideoSetting(
                      "durationSeconds",
                      Number.parseInt(event.target.value, 10) as OnboardingDraft["videoSettings"]["durationSeconds"]
                    )
                  }
                >
                  <option value={10}>10s quick proof preview</option>
                  <option value={15}>15s recommended offer clip</option>
                  <option value={20}>20s demo/explainer</option>
                  <option value={30}>30s proof + objection</option>
                  <option value={45}>45s story + proof</option>
                  <option value={60}>60s deep short</option>
                </select>
              </label>
              <label>
                <span>
                  Video quality <em aria-hidden="true">*</em>
                </span>
                <select
                  value={draft.videoSettings.qualityMode}
                  onChange={(event) => updateVideoSetting("qualityMode", event.target.value as OnboardingDraft["videoSettings"]["qualityMode"])}
                >
                  <option value="fast-preview">Fast preview: low-cost draft</option>
                  <option value="balanced">Balanced: recommended</option>
                  <option value="highest-quality">Highest quality: hero clips</option>
                </select>
              </label>
              <label className="portalWide">
                <span>Quality instructions <small>optional</small></span>
                <textarea
                  value={draft.videoSettings.qualityInstructions}
                  onChange={(event) => updateVideoSetting("qualityInstructions", event.target.value)}
                />
                <small className="fieldGuidance">
                  Best default: strong movement in the first second, vertical 9:16 framing, clean safe zones, large subtitles, and
                  exact proof or logos added only after review.
                </small>
              </label>
              <label>
                <span>Hook style</span>
                <select
                  value={draft.creativeSettings.hookStyle}
                  onChange={(event) =>
                    updateCreativeSetting("hookStyle", event.target.value as OnboardingDraft["creativeSettings"]["hookStyle"])
                  }
                >
                  <option value="proof-first">Proof first</option>
                  <option value="direct-problem">Direct problem</option>
                  <option value="before-after">Before-after</option>
                  <option value="founder-pov">Founder POV</option>
                  <option value="trend-remix">Trend remix</option>
                </select>
              </label>
              <label>
                <span>Visual style</span>
                <select
                  value={draft.creativeSettings.visualStyle}
                  onChange={(event) =>
                    updateCreativeSetting("visualStyle", event.target.value as OnboardingDraft["creativeSettings"]["visualStyle"])
                  }
                >
                  <option value="fast-cut">Fast cut</option>
                  <option value="premium-clean">Premium clean</option>
                  <option value="ugc-authentic">UGC authentic</option>
                  <option value="product-demo">Product demo</option>
                  <option value="testimonial-proof">Testimonial proof</option>
                </select>
              </label>
              <label>
                <span>CTA type</span>
                <select
                  value={draft.creativeSettings.ctaType}
                  onChange={(event) =>
                    updateCreativeSetting("ctaType", event.target.value as OnboardingDraft["creativeSettings"]["ctaType"])
                  }
                >
                  <option value="send-dm">Send DM</option>
                  <option value="book-call">Book call</option>
                  <option value="buy-now">Buy now</option>
                  <option value="claim-offer">Claim offer</option>
                  <option value="learn-more">Learn more</option>
                </select>
              </label>
              <label>
                <span>Caption style</span>
                <select
                  value={draft.creativeSettings.captionStyle}
                  onChange={(event) =>
                    updateCreativeSetting("captionStyle", event.target.value as OnboardingDraft["creativeSettings"]["captionStyle"])
                  }
                >
                  <option value="bold-subtitles">Bold subtitles</option>
                  <option value="clean-premium">Clean premium</option>
                  <option value="ugc-native">UGC native</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
              <label>
                <span>Primary brand color</span>
                <input value={draft.brandKit.primaryColor} onChange={(event) => updateBrandKit("primaryColor", event.target.value)} />
              </label>
              <label>
                <span>Secondary brand color</span>
                <input value={draft.brandKit.secondaryColor} onChange={(event) => updateBrandKit("secondaryColor", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Brand logo URL <small>optional</small></span>
                <input value={draft.brandKit.logoUrl} onChange={(event) => updateBrandKit("logoUrl", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Brand direction <small>optional</small></span>
                <textarea value={draft.brandKit.brandDo} onChange={(event) => updateBrandKit("brandDo", event.target.value)} />
              </label>
              <label className="portalWide">
                <span>Brand avoid list <small>optional</small></span>
                <textarea value={draft.brandKit.brandDont} onChange={(event) => updateBrandKit("brandDont", event.target.value)} />
              </label>
              <label>
                <span>
                  Approval contact <em aria-hidden="true">*</em>
                </span>
                <input value={draft.approvalContact} onChange={(event) => update("approvalContact", event.target.value)} required />
              </label>
              <label>
                <span>
                  Posting timezone <em aria-hidden="true">*</em>
                </span>
                <input value={draft.postingTimezone} onChange={(event) => update("postingTimezone", event.target.value)} required />
              </label>
              <label>
                <span>
                  Quiet hours <em aria-hidden="true">*</em>
                </span>
                <input value={draft.quietHours} onChange={(event) => update("quietHours", event.target.value)} required />
              </label>
              <label>
                <span>
                  Publishing mode <em aria-hidden="true">*</em>
                </span>
                <select value={draft.publishingMode} onChange={(event) => update("publishingMode", event.target.value as OnboardingDraft["publishingMode"])}>
                  <option value="approval-first">Approval-first</option>
                  <option value="auto-after-rules">Auto after rules</option>
                  <option value="manual-only">Manual only</option>
                </select>
              </label>
              <label>
                <span>
                  Budget sensitivity <em aria-hidden="true">*</em>
                </span>
                <select value={draft.budgetSensitivity} onChange={(event) => update("budgetSensitivity", event.target.value as OnboardingDraft["budgetSensitivity"])}>
                  <option value="lowest-cost">Lowest cost first</option>
                  <option value="balanced">Balanced</option>
                  <option value="maximum-impact">Maximum impact</option>
                </select>
              </label>
            </div>

            <div className="portalChoiceBlock">
              <span>
                Notification channels <em aria-hidden="true">*</em>
              </span>
              <div>
                {channelOptions.map((channel) => (
                  <label key={channel}>
                    <input checked={draft.approvalChannels.includes(channel)} type="checkbox" onChange={() => toggleChannel(channel)} />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="portalFormSection">
            <h3>4. Permissions</h3>
            <label className="portalConsent">
              <input checked={draft.autoPostingIntent} type="checkbox" onChange={(event) => update("autoPostingIntent", event.target.checked)} />
              <span>I want optional auto-posting later, after social accounts and platform permissions are connected.</span>
            </label>
            {draft.autoPostingIntent ? (
              <div className="socialConnectList" aria-label="Social account connections">
                {draft.platforms.map((platform) => {
                  const account = draft.connectedAccounts.find((item) => item.platform === platform);
                  const liveConnection = liveSocialConnections.get(platform);
                  return (
                    <a key={platform} href={socialConnectUrl(platform)}>
                      <ShieldCheck size={16} />
                      <span>
                        {liveConnection || account?.status === "connected" ? `Reconnect ${platform}` : `Connect ${platform}`}
                        {liveConnection ? (
                          <small className="socialConnectionStatus">
                            Connected{liveConnection.accountName ? `: ${liveConnection.accountName}` : ""}
                          </small>
                        ) : null}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
            <label className="portalConsent">
              <input checked={draft.consentToUseAssets} required type="checkbox" onChange={(event) => update("consentToUseAssets", event.target.checked)} />
              <span>
                VIDSLOOM may use the submitted business assets and links to prepare campaign drafts.{" "}
                <em aria-hidden="true">*</em>
              </span>
            </label>
            <label className="portalConsent">
              <input checked={draft.understandsOauth} required type="checkbox" onChange={(event) => update("understandsOauth", event.target.checked)} />
              <span>
                Direct auto-posting needs my social account OAuth and platform permissions; approval-first queues work
                before that. <em aria-hidden="true">*</em>
              </span>
            </label>
            <label className="portalConsent">
              <input checked={draft.consentToStart} required type="checkbox" onChange={(event) => update("consentToStart", event.target.checked)} />
              <span>
                Start the VIDSLOOM onboarding workflow from this brief. <em aria-hidden="true">*</em>
              </span>
            </label>
          </div>

          {error ? (
            <p className="leadError" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="portalMessage" aria-live="polite">
              {message}
            </p>
          ) : null}

          <div className="portalActions">
            <button className="siteButton primarySiteButton" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              {saving ? "Saving" : "Save onboarding"}
            </button>
            <button className="siteButton lightSiteButton" disabled={!canGenerate || generating} onClick={generateCampaign} type="button">
              {generating ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
              {generating ? "Generating" : "Generate first pack"}
            </button>
          </div>
          {!canGenerate ? (
            <p className="portalHelpText">
              Generate unlocks after checkout is active or the account is manually approved. You can still save the
              onboarding brief now.
            </p>
          ) : null}
        </form>

        <aside className="portalSummary">
          <div className="portalPanelHeader">
            <h2>Production workspace</h2>
            <p>Review generated concepts, approve schedule rows, and capture pilot proof in one place.</p>
          </div>
          {activeCampaign ? (
            <CampaignReviewWorkspace
              key={`${activeCampaign.id}-${campaignRenderKey(activeCampaign.campaign)}-${reviews[activeCampaign.id]?.updatedAt ?? "draft"}`}
              accessToken={accessToken}
              customerId={customer.id}
              item={activeCampaign}
              review={reviews[activeCampaign.id]}
              onReviewSaved={handleReviewSaved}
            />
          ) : (
            <div className="portalEmpty">
              <Sparkles size={22} />
              <p>Save the onboarding brief, then generate the first campaign pack.</p>
            </div>
          )}
          {campaigns.length > 1 ? (
            <div className="portalArchive">
              <h3>Recent packs</h3>
              {campaigns.slice(1).map((item) => (
                <CampaignPreview key={item.id} item={item} review={reviews[item.id]} />
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function CustomerAssetLibrary({
  assets,
  customerId,
  accessToken,
  readiness,
  onAssetsUpdated
}: {
  assets: CustomerAsset[];
  customerId: string;
  accessToken: string;
  readiness: CustomerAssetReadiness;
  onAssetsUpdated: (assets: CustomerAsset[]) => void;
}) {
  const [draft, setDraft] = useState<AssetDraft>(() => defaultAssetDraft());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const activeAssets = assets.filter((asset) => asset.status === "active");

  function update<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveAsset() {
    setUploading(true);
    setAssetMessage(null);
    setAssetError(null);

    try {
      const formData = new FormData();
      formData.append("customerId", customerId);
      formData.append("accessToken", accessToken);
      formData.append("kind", draft.kind);
      formData.append("label", draft.label);
      formData.append("notes", draft.notes);
      formData.append("sourceUrl", draft.sourceUrl);
      formData.append("usageRights", draft.usageRights);
      formData.append("usageConsent", String(draft.usageConsent));
      if (file) formData.append("file", file);

      const response = await fetch("/api/customer/assets", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { assets?: CustomerAsset[]; error?: string; issues?: ApiIssue[] };
      if (!response.ok || !data.assets) {
        throw new Error(formatApiError(data, "Asset could not be saved."));
      }
      onAssetsUpdated(data.assets);
      setDraft(defaultAssetDraft());
      setFile(null);
      setAssetMessage("Asset saved and included in the VIDSLOOM quality gate.");
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : "Asset could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  async function archiveAsset(assetId: string) {
    setAssetMessage(null);
    setAssetError(null);

    try {
      const params = new URLSearchParams({ customerId, accessToken });
      const response = await fetch(`/api/customer/assets/${assetId}?${params.toString()}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { assets?: CustomerAsset[]; error?: string };
      if (!response.ok || !data.assets) {
        throw new Error(data.error || "Asset could not be archived.");
      }
      onAssetsUpdated(data.assets);
      setAssetMessage("Asset archived. It will not be used for new video generation.");
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : "Asset could not be archived.");
    }
  }

  return (
    <section className={`portalAssetLibrary readiness-${readiness.status}`} aria-label="Customer asset library">
      <div className="portalAssetHeader">
        <div>
          <span className="siteEyebrow">Asset quality gate</span>
          <h2>Upload the assets VIDSLOOM should use</h2>
          <p>
            Add logos, product shots, service visuals, source clips, reviews, offers, and claim limits here. These assets
            are used to make customer-specific videos instead of generic drafts.
          </p>
        </div>
        <div className="assetReadinessMeter">
          <strong>{readiness.score}</strong>
          <span>/100</span>
          <small>{formatStatus(readiness.status)}</small>
        </div>
      </div>

      <div className="assetReadinessBar" aria-hidden="true">
        <span style={{ width: `${readiness.score}%` }} />
      </div>
      <div className="assetReadinessGrid">
        <article>
          <strong>{readiness.summary}</strong>
          {readiness.strengths.length ? (
            <p>{readiness.strengths.slice(0, 3).join(" ")}</p>
          ) : (
            <p>Start with real visuals and proof so VIDSLOOM can produce stronger first drafts.</p>
          )}
        </article>
        <article>
          <strong>Missing next</strong>
          <p>{readiness.missing.slice(0, 4).join(", ") || "No major asset gaps for the first pack."}</p>
        </article>
        <article>
          <strong>Next action</strong>
          <p>{readiness.nextActions[0] || "Generate the next pack with the current asset library."}</p>
        </article>
      </div>

      <div className="assetLibraryLayout">
        <div className="assetUploadPanel">
          <div className="assetUploadHeader">
            <UploadCloud size={20} />
            <div>
              <h3>Add file or link</h3>
              <p>{customerAssetKindGuidance[draft.kind]}</p>
            </div>
          </div>
          <div className="portalFields assetFields">
            <label>
              <span>Asset type</span>
              <select value={draft.kind} onChange={(event) => update("kind", event.target.value as CustomerAssetKind)}>
                {assetKindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {customerAssetKindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Usage rights</span>
              <select
                value={draft.usageRights}
                onChange={(event) => update("usageRights", event.target.value as CustomerAssetUsageRights)}
              >
                {usageRightsOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="portalWide">
              <span>Upload file</span>
              <input
                accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf,text/plain"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <label className="portalWide">
              <span>Or paste source URL</span>
              <input
                onChange={(event) => update("sourceUrl", event.target.value)}
                placeholder="Website, Drive, social reference, review, menu, or proof URL"
                value={draft.sourceUrl}
              />
            </label>
            <label className="portalWide">
              <span>Label</span>
              <input
                onChange={(event) => update("label", event.target.value)}
                placeholder="Example: Bestseller bowl hero photo, clinic review screenshot, June offer sheet"
                value={draft.label}
              />
            </label>
            <label className="portalWide">
              <span>Notes for VIDSLOOM</span>
              <textarea
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Where this should appear, what to avoid, proof context, offer details, or approval limits."
                value={draft.notes}
              />
            </label>
          </div>
          <label className="portalConsent assetConsent">
            <input
              checked={draft.usageConsent}
              onChange={(event) => update("usageConsent", event.target.checked)}
              type="checkbox"
            />
            <span>VIDSLOOM may use this asset in AI drafts, campaign previews, publishing kits, and approved videos.</span>
          </label>
          <div className="assetUploadActions">
            <button className="siteButton primarySiteButton" disabled={uploading} onClick={saveAsset} type="button">
              {uploading ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
              {uploading ? "Saving" : "Save asset"}
            </button>
          </div>
          {assetError ? (
            <p className="leadError" role="alert" aria-live="polite">
              {assetError}
            </p>
          ) : null}
          {assetMessage ? (
            <p className="portalMessage" aria-live="polite">
              {assetMessage}
            </p>
          ) : null}
        </div>

        <div className="assetListPanel">
          <div className="assetListHeader">
            <h3>{activeAssets.length} active asset{activeAssets.length === 1 ? "" : "s"}</h3>
            <p>Only active assets with confirmed rights are used directly in customer-specific video generation.</p>
          </div>
          {activeAssets.length ? (
            <div className="assetCardGrid">
              {activeAssets.map((asset) => (
                <article key={asset.id} className="assetCard">
                  <div className="assetPreview">
                    {asset.mimeType.startsWith("image/") && asset.storageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={assetFileUrl(asset, customerId, accessToken)} />
                    ) : asset.source === "url" ? (
                      <Link2 size={22} />
                    ) : asset.mimeType.startsWith("video/") ? (
                      <Film size={22} />
                    ) : asset.mimeType === "application/pdf" ? (
                      <FileText size={22} />
                    ) : (
                      <ImageIcon size={22} />
                    )}
                  </div>
                  <div className="assetCardBody">
                    <div className="assetCardTop">
                      <span>{customerAssetKindLabels[asset.kind]}</span>
                      <strong className={`assetQualityPill ${assetQualityClass(asset.qualityScore)}`}>
                        {asset.qualityScore}
                      </strong>
                    </div>
                    <h4>{asset.label}</h4>
                    <p>{assetStatusSummary(asset)}</p>
                    <div className="assetTags">
                      {asset.readinessTags.slice(0, 4).map((tag) => (
                        <span key={tag}>{formatStatus(tag)}</span>
                      ))}
                    </div>
                    {asset.qualityIssues.length ? (
                      <small className="assetIssue">{asset.qualityIssues[0]}</small>
                    ) : asset.qualityRecommendations.length ? (
                      <small>{asset.qualityRecommendations[0]}</small>
                    ) : null}
                    <div className="assetCardActions">
                      <a href={assetFileUrl(asset, customerId, accessToken)} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      <button onClick={() => archiveAsset(asset.id)} type="button">
                        <Trash2 size={14} />
                        Archive
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="portalEmpty">
              <UploadCloud size={22} />
              <p>Upload a logo, three real visuals, one proof asset, and the current offer to unlock stronger videos.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CampaignProductionGate({ campaign }: { campaign: PublicCampaign }) {
  const proofGraph = campaign.pack.proofGraph;
  const routing = campaign.pack.generationRouting;
  const gateCounts = campaign.pack.videoConcepts.reduce(
    (counts, concept) => ({
      pass: counts.pass + (concept.qualityGate.status === "pass" ? 1 : 0),
      review: counts.review + (concept.qualityGate.status === "needs-review" ? 1 : 0),
      blocked: counts.blocked + (concept.qualityGate.status === "blocked" ? 1 : 0)
    }),
    { pass: 0, review: 0, blocked: 0 }
  );
  const visibleProofItems = proofGraph.items.slice(0, 5);

  return (
    <section className="portalProductionGate" aria-label="Campaign production gate">
      <div className="productionGateHeader">
        <div>
          <span className="siteEyebrow">Production gate</span>
          <h4>Proof-first video readiness</h4>
        </div>
        <strong className={`productionGateScore ${proofGraph.readinessStatus}`}>
          {proofGraph.readinessScore}/100
        </strong>
      </div>
      <div className="productionGateGrid">
        <article>
          <span>Proof library</span>
          <strong>{formatStatus(proofGraph.readinessStatus)}</strong>
          <small>{proofGraph.missingProof[0] || "Core proof assets are available for review."}</small>
        </article>
        <article>
          <span>QA gates</span>
          <strong>
            {gateCounts.pass}/{campaign.pack.videoConcepts.length} pass
          </strong>
          <small>{gateCounts.blocked ? `${gateCounts.blocked} blocked before publishing` : `${gateCounts.review} need review`}</small>
        </article>
        <article>
          <span>AI route</span>
          <strong>{routing.degradedMode ? "Review route" : "Production route"}</strong>
          <small>{routing.customerVisibleStatus}</small>
        </article>
      </div>
      {proofGraph.missingProof.length ? (
        <div className="productionGateChips">
          {proofGraph.missingProof.slice(0, 5).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {visibleProofItems.length ? (
        <div className="proofGraphList">
          {visibleProofItems.map((item) => (
            <article key={item.id}>
              <strong>{item.summary}</strong>
              <span>{formatStatus(item.status)}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ConceptProductionGate({
  concept
}: {
  concept: PublicCampaign["pack"]["videoConcepts"][number];
}) {
  const gate = concept.qualityGate;
  const failedChecks = gate.checks.filter((check) => !check.passed).slice(0, 4);
  const storyboard = concept.storyboard.slice(0, 7);

  return (
    <details className={`conceptProductionGate ${gate.status}`} open={gate.status !== "pass"}>
      <summary>
        <span>Production gate</span>
        <strong>
          {formatStatus(gate.status)} · {gate.score}/{gate.minPublishScore}
        </strong>
      </summary>
      <div className="conceptGateBody">
        {gate.publishBlockers.length ? (
          <div className="conceptGatePanel blocked">
            <strong>Blocked before publishing</strong>
            {gate.publishBlockers.slice(0, 4).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}
        {gate.nextActions.length ? (
          <div className="conceptGatePanel">
            <strong>Next fixes</strong>
            {gate.nextActions.slice(0, 4).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}
        <div className="conceptGatePanel">
          <strong>Claim review</strong>
          <p>{formatStatus(concept.claimReview.status)}</p>
          {(concept.claimReview.unsupportedClaims.length
            ? concept.claimReview.unsupportedClaims
            : concept.claimReview.supportedClaims
          )
            .slice(0, 3)
            .map((item) => (
              <small key={item}>{item}</small>
            ))}
        </div>
        {failedChecks.length ? (
          <div className="qualityCheckGrid">
            {failedChecks.map((check) => (
              <article key={check.category}>
                <span>{check.category}</span>
                <strong>{Math.round(check.score)}</strong>
                <small>{check.action || check.issue}</small>
              </article>
            ))}
          </div>
        ) : null}
        {storyboard.length ? (
          <div className="storyboardStrip" aria-label={`Storyboard for ${concept.title}`}>
            {storyboard.map((shot) => (
              <article key={`${concept.title}-${shot.shotNumber}`}>
                <span>
                  {shot.startSecond}s-{shot.endSecond}s
                </span>
                <strong>{formatStatus(shot.purpose)}</strong>
                <p>{shot.onScreenText}</p>
                <small>{formatStatus(shot.visualSource)}</small>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function CampaignReviewWorkspace({
  item,
  customerId,
  accessToken,
  review,
  onReviewSaved
}: {
  item: PortalCampaign;
  customerId: string;
  accessToken: string;
  review?: CustomerCampaignReview;
  onReviewSaved: (review: CustomerCampaignReview) => void;
}) {
  const [draft, setDraft] = useState<ReviewDraft>(() => buildReviewDraft(customerId, item, review));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postingAttempts, setPostingAttempts] = useState<PublishingAttempt[]>([]);
  const [postingLoading, setPostingLoading] = useState<string | null>(null);
  const [postingRefreshing, setPostingRefreshing] = useState(false);
  const campaign = item.campaign;
  const stats = reviewStats(draft);
  const renderStatus = renderStatusSummary(campaign);
  const publishingPollActive = useMemo(
    () => shouldPollPublishing(draft, postingAttempts),
    [draft, postingAttempts]
  );
  const publishingTimeline = useMemo(
    () => buildPublishingTimeline(campaign, draft, postingAttempts),
    [campaign, draft, postingAttempts]
  );

  const refreshPostingAttempts = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const params = new URLSearchParams({
        customerId,
        accessToken,
        campaignId: campaign.id
      });

      if (!silent) setPostingRefreshing(true);
      try {
        const response = await fetch(`/api/customer/publish?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json()) as { attempts?: PublishingAttempt[] };
        if (response.ok) {
          setPostingAttempts(data.attempts ?? []);
        }
      } catch {
        // Keep review usable when publishing-attempt history is temporarily unavailable.
      } finally {
        if (!silent) setPostingRefreshing(false);
      }
    },
    [campaign.id, customerId, accessToken]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPostingAttempts({ silent: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshPostingAttempts]);

  useEffect(() => {
    if (!publishingPollActive) return;
    const timer = window.setInterval(() => {
      void refreshPostingAttempts({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [publishingPollActive, refreshPostingAttempts]);

  function updateVideo(conceptTitle: string, patch: Partial<ReviewDraft["videoReviews"][number]>) {
    const updatedAt = new Date().toISOString();
    setDraft((current) => ({
      ...current,
      videoReviews: current.videoReviews.map((row) =>
        row.conceptTitle === conceptTitle ? { ...row, ...patch, updatedAt } : row
      )
    }));
  }

  function updatePublish(taskKey: string, patch: Partial<ReviewDraft["publishingReviews"][number]>) {
    const updatedAt = new Date().toISOString();
    setDraft((current) => ({
      ...current,
      publishingReviews: current.publishingReviews.map((row) =>
        row.taskKey === taskKey ? { ...row, ...patch, updatedAt } : row
      )
    }));
  }

  function updatePublishPerformance(taskKey: string, patch: Partial<CustomerPublishingPerformance>) {
    const updatedAt = new Date().toISOString();
    setDraft((current) => ({
      ...current,
      publishingReviews: current.publishingReviews.map((row) =>
        row.taskKey === taskKey
          ? {
              ...row,
              performance: {
                ...row.performance,
                ...patch,
                capturedAt: new Date().toISOString()
              },
              updatedAt
            }
          : row
      )
    }));
  }

  async function saveReview() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/customer/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, accessToken })
      });
      const data = (await response.json()) as {
        review?: CustomerCampaignReview;
        publishingAutomation?: Array<{ queued?: boolean; reason?: string }>;
        error?: string;
        issues?: ApiIssue[];
      };
      if (!response.ok || !data.review) {
        throw new Error(formatApiError(data, "Review could not be saved."));
      }
      setDraft(buildReviewDraft(customerId, item, data.review));
      onReviewSaved(data.review);
      const queuedCount = data.publishingAutomation?.filter((result) => result.queued).length ?? 0;
      setMessage(
        queuedCount
          ? `Review saved: ${formatStatus(data.review.overallStatus)}. ${queuedCount} auto-publish job${queuedCount === 1 ? "" : "s"} queued.`
          : `Review saved: ${formatStatus(data.review.overallStatus)}.`
      );
      void refreshPostingAttempts({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown review error.");
    } finally {
      setSaving(false);
    }
  }

  function latestPostingAttempt(taskKey: string) {
    return postingAttempts
      .filter((attempt) => attempt.taskKey === taskKey)
      .sort((a, b) => timestampFor(b.updatedAt || b.createdAt) - timestampFor(a.updatedAt || a.createdAt))[0];
  }

  async function runCustomerPublishingAction(taskKey: string, method: PublishingMethod) {
    setPostingLoading(`${taskKey}-${method}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/customer/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          accessToken,
          campaignId: campaign.id,
          taskKey,
          method
        })
      });
      const data = (await response.json()) as { attempt?: PublishingAttempt; error?: string };
      if (!data.attempt && !response.ok) {
        throw new Error(data.error ?? "Publishing action failed.");
      }
      if (data.attempt) {
        setPostingAttempts((current) => [data.attempt!, ...current.filter((attempt) => attempt.id !== data.attempt!.id)]);
        void refreshPostingAttempts({ silent: true });
        setMessage(
          data.attempt.status === "manual-kit-ready"
            ? "Manual posting kit prepared."
            : data.attempt.status === "blocked"
              ? data.attempt.error || "Direct publishing is blocked until the account is connected."
              : `Publishing attempt status: ${formatStatus(data.attempt.status)}.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing action failed.");
    } finally {
      setPostingLoading(null);
    }
  }

  return (
    <div className="campaignReviewWorkspace">
      <div className="campaignReviewHero">
        <span>{campaign.generationStatus === "ai-generated" ? "AI-generated campaign pack" : "AI-assisted campaign pack"}</span>
        <h3>{campaign.pack.positioning}</h3>
        <p>{campaign.pack.executiveBrief}</p>
      </div>

      <div className="reviewMetricGrid">
        <article>
          <strong>{stats.approvedVideos}/{draft.videoReviews.length}</strong>
          <span>videos approved</span>
        </article>
        <article>
          <strong>{stats.changeRequests}</strong>
          <span>edits or regenerations</span>
        </article>
        <article>
          <strong>{stats.readyTasks}/{draft.publishingReviews.length}</strong>
          <span>schedule rows ready</span>
        </article>
      </div>

      <section className="portalActivitySection" aria-label="Publishing activity timeline">
        <div className="portalReviewSectionHeader">
          <Clock3 size={19} />
          <div>
            <h3>Publishing activity</h3>
            <p>Track what VIDSLOOM has generated, queued, posted, blocked, or needs from you next.</p>
          </div>
        </div>
        <div className="portalActivityTimeline">
          {publishingTimeline.map((item) => (
            <article key={item.id} className={`portalActivityItem ${item.state}`}>
              <span aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
                {item.meta ? <small>{item.meta}</small> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="portalReviewSection">
        <div className="portalReviewSectionHeader">
          <Film size={19} />
          <div>
            <h3>Generated videos</h3>
            <p>
              {isPlanningActive(campaign)
                ? "VIDSLOOM is preparing the full campaign pack. This page will update automatically."
                : hasActiveRender(campaign)
                ? "The campaign pack is ready to review while customer-specific MP4 previews finish rendering."
                : "Approve the concept, request edits, or ask VIDSLOOM to regenerate a stronger variant."}
            </p>
          </div>
        </div>
        <div className={`portalRenderStatus ${renderStatus.state}`}>
          <strong>{renderStatus.label}</strong>
          <span>{renderStatus.detail}</span>
        </div>
        <CampaignProductionGate campaign={campaign} />
        <div className="videoReviewList">
          {campaign.pack.videoConcepts.map((concept, index) => {
            const asset = getPortalVideoAsset(campaign, concept.title, index);
            const row = draft.videoReviews.find((entry) => entry.conceptTitle === concept.title);
            const approvalBlocked = concept.qualityGate.status === "blocked";
            return (
              <article key={concept.title} className="videoReviewCard">
                <video autoPlay muted loop playsInline preload="metadata" poster={asset.posterUrl}>
                  <source src={asset.videoUrl} type="video/mp4" />
                </video>
                <div className="videoReviewBody">
                  <div className="videoReviewTop">
                    <span>{asset.title}</span>
                    <div className="videoReviewPills">
                      <strong className={`reviewStatusPill ${asset.status}`}>{formatStatus(asset.status)}</strong>
                      <strong className={`reviewStatusPill ${row?.status ?? "needs-review"}`}>
                        {formatStatus(row?.status ?? "needs-review")}
                      </strong>
                    </div>
                  </div>
                  <h4>{concept.title}</h4>
                  <dl>
                    <div>
                      <dt>Hook</dt>
                      <dd>{concept.hook}</dd>
                    </div>
                    <div>
                      <dt>CTA</dt>
                      <dd>{concept.cta}</dd>
                    </div>
                    <div>
                      <dt>Caption</dt>
                      <dd>{concept.caption}</dd>
                    </div>
                    <div>
                      <dt>Render proof</dt>
                      <dd>
                        {formatStatus(asset.status)} | {formatStatus(asset.renderMode)} | {asset.storageProvider} |{" "}
                        {asset.aspectRatio} | {asset.resolution} | {asset.durationSeconds}s | {formatStatus(asset.qualityMode)}
                      </dd>
                    </div>
                    <div>
                      <dt>Quality brief</dt>
                      <dd>{asset.qualityInstructions}</dd>
                    </div>
                    {asset.renderError ? (
                      <div>
                        <dt>Render issue</dt>
                        <dd>{asset.renderError}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Boundary</dt>
                      <dd>{asset.usageBoundary}</dd>
                    </div>
                  </dl>
	                  <div className="portalAssetPipeline">
	                    {asset.pipelineSteps.map((step) => (
	                      <span key={step}>{step}</span>
	                    ))}
	                  </div>
                  <ConceptProductionGate concept={concept} />
	                  <div className="portalReviewActions" aria-label={`Review controls for ${concept.title}`}>
	                    {videoReviewActions.map((action) => (
	                      <button
	                        key={action.status}
	                        className={row?.status === action.status ? "active" : ""}
                        disabled={action.status === "approved" && approvalBlocked}
	                        onClick={() => updateVideo(concept.title, { status: action.status })}
                        title={
                          action.status === "approved" && approvalBlocked
                            ? "Resolve blocked proof, claim, or QA items before approving."
                            : undefined
                        }
	                        type="button"
	                      >
	                        {action.label}
                      </button>
                    ))}
                  </div>
                  <label className="portalReviewNote">
                    <span>Edit notes</span>
                    <textarea
                      onChange={(event) => updateVideo(concept.title, { note: event.target.value })}
                      placeholder="Example: make this more premium, use clinic-safe wording, stronger opening hook..."
                      value={row?.note ?? ""}
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="portalReviewSection">
        <div className="portalReviewSectionHeader">
          <CalendarDays size={19} />
          <div>
            <h3>Publishing queue</h3>
            <p>Mark rows ready only when the concept, caption, assets, and platform permissions are clear.</p>
          </div>
          <div className="portalReviewSectionHeaderActions">
            <button disabled={postingRefreshing} onClick={() => refreshPostingAttempts()} type="button">
              {postingRefreshing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
              Refresh
            </button>
          </div>
        </div>
        <div className="publishReviewList">
	          {campaign.pack.publishingQueue.map((task) => {
	            const key = publishingTaskKey(task);
	            const row = draft.publishingReviews.find((entry) => entry.taskKey === key);
	            const attempt = latestPostingAttempt(key);
	            const publishStatus = publishingStatusSummary(row, attempt, task);
	            const performance = row?.performance ?? defaultPortalPerformance();
	            const manualBusy = postingLoading === `${key}-manual-assisted`;
	            const directBusy = postingLoading === `${key}-direct-api`;
            const concept = campaign.pack.videoConcepts.find((item) => item.title === task.conceptTitle);
            const publishGateBlocked = concept?.qualityGate.status !== "pass";
	            return (
	              <article key={key} className="publishReviewCard">
                <div>
                  <span>{task.platform}</span>
                  <h4>{task.conceptTitle}</h4>
                  <p>
                    {task.day} at {task.publishWindow}
                  </p>
                  <small>{task.automationMode === "direct-api-after-oauth" ? "OAuth required before direct posting" : task.automationMode}</small>
                </div>
                <div className="postingActionPanel portalPostingPanel">
                  <div>
                    <strong>Posting execution</strong>
                    <p>Use the manual kit now, or direct publish after this platform is connected through OAuth.</p>
                  </div>
                  <div className="postingActionButtons">
	                    <button
	                      disabled={Boolean(postingLoading) || publishGateBlocked}
	                      onClick={() => runCustomerPublishingAction(key, "manual-assisted")}
                        title={publishGateBlocked ? "Complete the production gate before generating a posting kit." : undefined}
	                      type="button"
	                    >
                      {manualBusy ? <Loader2 className="spin" size={16} /> : <ClipboardList size={16} />}
                      Manual kit
                    </button>
	                    <button
	                      disabled={Boolean(postingLoading) || publishGateBlocked}
	                      onClick={() => runCustomerPublishingAction(key, "direct-api")}
                        title={publishGateBlocked ? "Complete the production gate before direct publishing." : undefined}
	                      type="button"
	                    >
                      {directBusy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                      Direct publish
                    </button>
                  </div>
                  {attempt ? (
                    <div className="postingAttemptResult">
                      <span className={`statusPill status-${attempt.status}`}>{formatStatus(attempt.status)}</span>
                      <p>{attempt.error || `${formatStatus(attempt.method)} attempt saved.`}</p>
                      <div className="postingAttemptMetaGrid">
                        <span>
                          Method <strong>{formatStatus(attempt.method)}</strong>
                        </span>
                        <span>
                          Visibility <strong>{publishingVisibilityLabel(attempt)}</strong>
                        </span>
                        <span>
                          Upload <strong>{providerResponseValue(attempt, "uploadStatus") || formatStatus(attempt.status)}</strong>
                        </span>
                        <span>
                          Updated <strong>{formatDateTime(attempt.updatedAt)}</strong>
                        </span>
                      </div>
                      <div className="postingAttemptLinks">
                        {attempt.assetUrl ? (
                          <a href={attempt.assetUrl} target="_blank" rel="noreferrer">
                            Open MP4
                          </a>
                        ) : null}
                        {attempt.externalUrl ? (
                          <a href={attempt.externalUrl} target="_blank" rel="noreferrer">
                            Open live post
                          </a>
                        ) : null}
                      </div>
                      <ol>
                        {attempt.instructions.slice(0, 4).map((instruction) => (
                          <li key={instruction}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
                <div className={`publishStatusStrip ${publishStatus.state}`}>
                  <Clock3 size={16} />
                  <div>
                    <strong>{publishStatus.label}</strong>
                    <span>{publishStatus.detail}</span>
                  </div>
                </div>
                {publishGateBlocked && concept ? (
                  <div className="publishGateNotice">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>Production gate not ready</strong>
                      <span>
                        {formatStatus(concept.qualityGate.status)} · {concept.qualityGate.score}/
                        {concept.qualityGate.minPublishScore}.{" "}
                        {concept.qualityGate.publishBlockers[0] ||
                          concept.qualityGate.nextActions[0] ||
                          "Resolve proof, claims, storyboard, and QA before posting."}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="portalReviewActions">
	                  {publishingReviewActions.map((action) => (
	                    <button
	                      key={action.status}
	                      className={row?.status === action.status ? "active" : ""}
                      disabled={publishGateBlocked && (action.status === "ready-to-schedule" || action.status === "scheduled")}
	                      onClick={() =>
	                        updatePublish(key, {
                          status: action.status,
                          autoPublishApproved:
                            action.status === "scheduled" ? true : row?.autoPublishApproved ?? false,
                          scheduledFor:
                            action.status === "scheduled" && !row?.scheduledFor
                              ? defaultAutoPublishTime()
                              : row?.scheduledFor ?? ""
                        })
	                      }
                      title={
                        publishGateBlocked && (action.status === "ready-to-schedule" || action.status === "scheduled")
                          ? "This row needs a passing proof, claim, storyboard, and QA gate first."
                          : undefined
                      }
	                      type="button"
	                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <div className="autoPublishControls">
                  <label className="autoPublishToggle">
	                    <input
	                      checked={row?.autoPublishApproved ?? false}
                      disabled={publishGateBlocked}
	                      onChange={(event) =>
                        updatePublish(key, {
                          autoPublishApproved: event.target.checked,
                          status: event.target.checked ? "scheduled" : row?.status ?? "ready-to-schedule",
                          scheduledFor:
                            event.target.checked && !row?.scheduledFor ? defaultAutoPublishTime() : row?.scheduledFor ?? ""
                        })
                      }
                      type="checkbox"
                    />
                    <span>Auto-publish when due</span>
                  </label>
                  <label className="autoPublishTime">
                    <span>Publish time</span>
	                    <input
                      disabled={publishGateBlocked}
	                      onChange={(event) =>
                        updatePublish(key, {
                          scheduledFor: fromDateTimeLocal(event.target.value),
                          autoPublishApproved: Boolean(event.target.value) || row?.autoPublishApproved || false,
                          status: event.target.value ? "scheduled" : row?.status ?? "ready-to-schedule"
                        })
                      }
                      type="datetime-local"
                      value={toDateTimeLocal(row?.scheduledFor)}
                    />
                  </label>
                  {row?.publishingJobId ? (
                    <p className="autoPublishMeta">
                      Queued for hands-off posting{row.publishingJobQueuedAt ? ` on ${formatDateTime(row.publishingJobQueuedAt)}` : ""}.
                    </p>
                  ) : null}
                  <p className="autoPublishHint">
                    Save the review after changing this row. VIDSLOOM queues the post only after the video is approved,
                    OAuth is connected, and the scheduled time is due.
                  </p>
                  {row?.publishingError ? <p className="autoPublishError">{row.publishingError}</p> : null}
                </div>
                <div className="performanceCapturePanel">
                  <div className="performanceCaptureHeader">
                    <div>
                      <strong>Performance proof</strong>
                      <span>Capture early results, screenshots, enquiries, bookings, or sales notes after the post goes live.</span>
                    </div>
                    {performance.capturedAt ? <small>Updated {formatDateTime(performance.capturedAt)}</small> : null}
                  </div>
                  <label className="performanceUrlField">
                    <span>Live post URL</span>
                    <input
                      onChange={(event) => updatePublishPerformance(key, { livePostUrl: event.target.value })}
                      placeholder={attempt?.externalUrl || "Paste the live post URL"}
                      value={performance.livePostUrl}
                    />
                  </label>
                  {attempt?.externalUrl && !performance.livePostUrl ? (
                    <button
                      className="performanceUseAttempt"
                      onClick={() => updatePublishPerformance(key, { livePostUrl: attempt.externalUrl })}
                      type="button"
                    >
                      Use live post URL
                    </button>
                  ) : null}
                  <div className="performanceMetricGrid">
                    {performanceMetricFields.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input
                          min={0}
                          onChange={(event) =>
                            updatePublishPerformance(key, {
                              [field.key]: numberFromInput(event.target.value)
                            })
                          }
                          type="number"
                          value={numberInputValue(performance[field.key])}
                        />
                      </label>
                    ))}
                    <label>
                      <span>Currency</span>
                      <input
                        maxLength={3}
                        onChange={(event) => updatePublishPerformance(key, { currency: event.target.value.toLowerCase() })}
                        value={performance.currency}
                      />
                    </label>
                  </div>
                  <label className="performanceWideField">
                    <span>Screenshot, report, or proof links</span>
                    <textarea
                      onChange={(event) => updatePublishPerformance(key, { screenshotLinks: event.target.value })}
                      placeholder="Paste screenshots, analytics exports, enquiry screenshots, booking proof, or CRM links."
                      value={performance.screenshotLinks}
                    />
                  </label>
                  <label className="performanceWideField">
                    <span>Business impact notes</span>
                    <textarea
                      onChange={(event) => updatePublishPerformance(key, { notes: event.target.value })}
                      placeholder="Example: 3 WhatsApp enquiries, 1 booking, comments asked for pricing, customer wants more product demos..."
                      value={performance.notes}
                    />
                  </label>
                  <p className="performanceFollowupMeta">
                    Follow-ups: 24h {performance.followUp24hSentAt ? `sent ${formatDateTime(performance.followUp24hSentAt)}` : "pending"} · 48h{" "}
                    {performance.followUp48hSentAt ? `sent ${formatDateTime(performance.followUp48hSentAt)}` : "pending"}
                  </p>
                </div>
                <label className="portalReviewNote">
                  <span>Schedule note</span>
                  <textarea
                    onChange={(event) => updatePublish(key, { note: event.target.value })}
                    placeholder="Example: hold until asset is approved, publish after event date is confirmed..."
                    value={row?.note ?? ""}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className="portalProofCapture">
        <div className="portalReviewSectionHeader">
          <MessageSquareText size={19} />
          <div>
            <h3>Pilot proof capture</h3>
            <p>Use this to record real outcomes, quotes, screenshots, links, or before-after notes from the pilot.</p>
          </div>
        </div>
        <label className="portalReviewNote">
          <span>Customer notes for VIDSLOOM</span>
          <textarea
            onChange={(event) => setDraft((current) => ({ ...current, customerNotes: event.target.value }))}
            placeholder="Anything the production team should know before the next queue..."
            value={draft.customerNotes}
          />
        </label>
        <label className="portalReviewNote">
          <span>Proof notes</span>
          <textarea
            onChange={(event) => setDraft((current) => ({ ...current, proofNotes: event.target.value }))}
            placeholder="Example: bookings increased, enquiry screenshots, customer quote, best performing post URL..."
            value={draft.proofNotes}
          />
        </label>
        <label className="portalConsent portalProofPermission">
          <input
            checked={draft.proofPermission}
            onChange={(event) => setDraft((current) => ({ ...current, proofPermission: event.target.checked }))}
            type="checkbox"
          />
          <span>VIDSLOOM may contact me to turn approved pilot results into a case study or testimonial.</span>
        </label>
      </section>

      {error ? (
        <p className="leadError" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="portalMessage" aria-live="polite">
          {message}
        </p>
      ) : null}
      <button className="siteButton primarySiteButton fullWidthButton" disabled={saving} onClick={saveReview} type="button">
        {saving ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
        {saving ? "Saving review" : "Save review queue"}
      </button>
    </div>
  );
}

function CampaignPreview({ item, review }: { item: PortalCampaign; review?: CustomerCampaignReview }) {
  const campaign = item.campaign;
  return (
    <article className="portalCampaign">
      <span>{campaign.generationStatus === "ai-generated" ? "AI-generated pack" : "AI-assisted pack"}</span>
      <h3>{campaign.pack.positioning}</h3>
      <p>{campaign.pack.executiveBrief}</p>
      <strong className={`reviewStatusPill ${review?.overallStatus ?? "needs-review"}`}>
        {formatStatus(review?.overallStatus ?? "needs-review")}
      </strong>
      <div className="portalMiniList">
        {campaign.pack.videoConcepts.slice(0, 3).map((concept) => (
          <div key={concept.title}>
            <strong>{concept.title}</strong>
            <small>{concept.hook}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildPublishingTimeline(campaign: PublicCampaign, draft: ReviewDraft, attempts: PublishingAttempt[]) {
  const items: Array<{
    id: string;
    state: "live" | "active" | "ready" | "blocked" | "pending";
    label: string;
    detail: string;
    meta: string;
    timestamp: number;
  }> = [];

  if (isPlanningActive(campaign)) {
    items.push({
      id: "planning-active",
      state: "active",
      label: "Campaign pack is being prepared",
      detail: "VIDSLOOM is building trend intelligence, scripts, captions, posting rows, and approval checks.",
      meta: campaign.planningStartedAt ? `Started ${formatDateTime(campaign.planningStartedAt)}` : "Queued for AI planning",
      timestamp: timestampFor(campaign.planningStartedAt || campaign.planningQueuedAt || campaign.createdAt)
    });
  } else if (isPlanningFailed(campaign)) {
    items.push({
      id: "planning-failed",
      state: "blocked",
      label: "Campaign planning needs attention",
      detail: campaign.planningError || "VIDSLOOM could not complete the campaign pack yet.",
      meta: campaign.planningCompletedAt ? `Updated ${formatDateTime(campaign.planningCompletedAt)}` : "",
      timestamp: timestampFor(campaign.planningCompletedAt || campaign.createdAt)
    });
  } else {
    items.push({
      id: "planning-ready",
      state: "ready",
      label: "Campaign pack ready",
      detail: `${campaign.pack.videoConcepts.length} concepts and ${campaign.pack.publishingQueue.length} publishing rows are available for review.`,
      meta: campaign.planningCompletedAt ? `Ready ${formatDateTime(campaign.planningCompletedAt)}` : "",
      timestamp: timestampFor(campaign.planningCompletedAt || campaign.createdAt)
    });
  }

  const renderStatus = renderStatusSummary(campaign);
  items.push({
    id: "render-status",
    state: renderStatus.state === "failed" ? "blocked" : renderStatus.state === "active" ? "active" : renderStatus.state === "ready" ? "ready" : "pending",
    label: renderStatus.label,
    detail: renderStatus.detail,
    meta: "",
    timestamp: latestRenderTimestamp(campaign)
  });

  for (const row of draft.publishingReviews) {
    const taskAttempts = attempts
      .filter((attempt) => attempt.taskKey === row.taskKey)
      .sort((a, b) => timestampFor(b.updatedAt || b.createdAt) - timestampFor(a.updatedAt || a.createdAt));
    const latest = taskAttempts[0];
    if (latest) {
      const summary = publishingStatusSummary(row, latest, {
        platform: row.platform,
        conceptTitle: row.conceptTitle,
        day: row.day,
        publishWindow: row.scheduledFor || "approved window",
        caption: "",
        hashtags: [],
        status: "scheduled",
        automationMode: latest.method === "direct-api" ? "direct-api-after-oauth" : "manual-upload-fallback",
        connectedAccountRequired: latest.method === "direct-api",
        assetChecklist: ["Approved MP4", "Approved caption"],
        approvalChecklist: ["Customer approval", "Platform permission"],
        platformRequirement: "",
        costControlNote: ""
      });
      items.push({
        id: `attempt-${latest.id}`,
        state: summary.state as "live" | "active" | "ready" | "blocked" | "pending",
        label: `${summary.label}: ${row.platform}`,
        detail: row.conceptTitle,
        meta: latest.externalUrl
          ? `Live URL captured ${formatDateTime(latest.updatedAt)}`
          : latest.error || `${formatStatus(latest.method)} updated ${formatDateTime(latest.updatedAt)}`,
        timestamp: timestampFor(latest.updatedAt || latest.createdAt)
      });
      continue;
    }

    if (row.publishingError) {
      items.push({
        id: `publishing-error-${row.taskKey}`,
        state: "blocked",
        label: `Automation needs attention: ${row.platform}`,
        detail: row.publishingError,
        meta: row.updatedAt ? `Updated ${formatDateTime(row.updatedAt)}` : "",
        timestamp: timestampFor(row.updatedAt)
      });
      continue;
    }

    if (row.publishingJobId) {
      items.push({
        id: `queued-${row.taskKey}`,
        state: "active",
        label: `Hands-off job queued: ${row.platform}`,
        detail: row.scheduledFor
          ? `${row.conceptTitle} is scheduled for ${formatDateTime(row.scheduledFor)}.`
          : `${row.conceptTitle} is waiting for its publishing window.`,
        meta: row.publishingJobQueuedAt ? `Queued ${formatDateTime(row.publishingJobQueuedAt)}` : "",
        timestamp: timestampFor(row.publishingJobQueuedAt || row.updatedAt)
      });
      continue;
    }

    if (row.autoPublishApproved && row.scheduledFor) {
      items.push({
        id: `ready-to-queue-${row.taskKey}`,
        state: "ready",
        label: `Ready to queue: ${row.platform}`,
        detail: `${row.conceptTitle} will be handed to automation after you save this review.`,
        meta: `Publish time ${formatDateTime(row.scheduledFor)}`,
        timestamp: timestampFor(row.updatedAt || row.scheduledFor)
      });
      continue;
    }

    if (row.status === "blocked") {
      items.push({
        id: `blocked-${row.taskKey}`,
        state: "blocked",
        label: `Blocked by review: ${row.platform}`,
        detail: row.note || `${row.conceptTitle} is not approved for publishing yet.`,
        meta: row.updatedAt ? `Updated ${formatDateTime(row.updatedAt)}` : "",
        timestamp: timestampFor(row.updatedAt)
      });
    }
  }

  const proofRows = draft.publishingReviews.filter((row) => row.performance.livePostUrl || row.performance.directPostUrl || row.performance.capturedAt);
  for (const row of proofRows) {
    const proofTime = row.performance.directPostMetricsAt || row.performance.capturedAt || row.performance.directPostCapturedAt;
    items.push({
      id: `proof-${row.taskKey}`,
      state: "live",
      label: `Proof captured: ${row.platform}`,
      detail: `${row.conceptTitle} has ${row.performance.directViews || row.performance.views} views and ${row.performance.bookings} bookings recorded.`,
      meta: proofTime ? `Captured ${formatDateTime(proofTime)}` : "Proof data saved",
      timestamp: timestampFor(proofTime || row.updatedAt)
    });
  }

  const sorted = items
    .sort((a, b) => b.timestamp - a.timestamp || activityRank(b.state) - activityRank(a.state))
    .slice(0, 8);

  return sorted.length
    ? sorted
    : [
        {
          id: "empty",
          state: "pending" as const,
          label: "Waiting for first approval",
          detail: "Approve a generated video and schedule row to start the publishing activity trail.",
          meta: "",
          timestamp: 0
        }
      ];
}

function latestRenderTimestamp(campaign: PublicCampaign) {
  return Math.max(
    timestampFor(campaign.createdAt),
    ...campaign.pack.videoAssets.map((asset) =>
      timestampFor(asset.renderCompletedAt || asset.renderStartedAt || asset.renderQueuedAt || asset.createdAt)
    )
  );
}

function activityRank(state: "live" | "active" | "ready" | "blocked" | "pending") {
  return state === "blocked" ? 5 : state === "active" ? 4 : state === "live" ? 3 : state === "ready" ? 2 : 1;
}

function defaultAssetDraft(): AssetDraft {
  return {
    kind: "product-photo",
    label: "",
    notes: "",
    sourceUrl: "",
    usageRights: "owned-or-licensed",
    usageConsent: true
  };
}

function assetFileUrl(asset: CustomerAsset, customerId: string, accessToken: string) {
  const params = new URLSearchParams({ customerId, accessToken });
  return `/api/customer/assets/${encodeURIComponent(asset.id)}/file?${params.toString()}`;
}

function assetQualityClass(score: number) {
  if (score >= 80) return "strong";
  if (score >= 60) return "usable";
  if (score >= 40) return "needs-assets";
  return "not-ready";
}

function assetStatusSummary(asset: CustomerAsset) {
  const parts = [
    asset.source === "url" ? "Linked URL" : formatBytes(asset.sizeBytes),
    asset.width && asset.height ? `${asset.width}x${asset.height}` : "",
    asset.usageConsent ? "usage confirmed" : "usage not confirmed",
    formatStatus(asset.usageRights)
  ];
  return parts.filter(Boolean).join(" | ");
}

function formatBytes(value: number) {
  if (!value) return "No file size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function buildInitialDraft(
  customer: CustomerView,
  onboarding: CustomerOnboarding | null,
  planProfile: PlanProfile
): OnboardingDraft {
  if (onboarding) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, submittedAt: _submittedAt, status: _status, generatedCampaignIds: _generatedCampaignIds, ...draft } = onboarding;
    return draft;
  }

  return {
    customerId: customer.id,
    websiteSocial: "",
    industry: "",
    locations: "",
    offer: "",
    targetAudience: "",
    primaryGoal: "Increase qualified enquiries, bookings, sales, or direct messages from short-form videos.",
    brandVoice: "Clear, practical, energetic, proof-led",
    proofPoints: "",
    assetLinks: "",
    currentContent: "",
    competitors: "",
    constraints: "Do not claim guaranteed revenue, guaranteed virality, or outcomes that cannot be proven.",
    platforms: ["Instagram Reels"],
    postingCadence: planProfile.cadence,
    brandKit: {
      logoUrl: "",
      primaryColor: "#05b6d4",
      secondaryColor: "#111827",
      fontStyle: "Clean, bold, highly readable",
      brandDo: "Use clear captions, proof-led language, and consistent brand colors.",
      brandDont: "Avoid unsupported claims, tiny text, cluttered overlays, or off-brand gimmicks."
    },
    creativeSettings: {
      hookStyle: "proof-first",
      captionStyle: "bold-subtitles",
      ctaType: "send-dm",
      visualStyle: "fast-cut",
      musicMood: "upbeat",
      voiceoverStyle: "narrator",
      subtitlesRequired: true
    },
    videoSettings: {
      durationSeconds: 15,
      qualityMode: "balanced",
      qualityInstructions: defaultQualityInstructions
    },
    approvalContact: customer.email,
    approvalChannels: ["Email"],
    notificationContact: customer.email,
    postingTimezone: "Customer local time",
    quietHours: "9:00 PM-8:00 AM local time",
    budgetSensitivity: "lowest-cost",
    assetSource: "vidsloom-assisted",
    publishingMode: "approval-first",
    approvalPolicy: "approve-every-post",
    autoPostingIntent: false,
    connectedAccounts: [
      {
        platform: "Instagram Reels",
        handle: "",
        status: "not-connected",
        autoPublish: false
      }
    ],
    consentToUseAssets: false,
    understandsOauth: false,
    consentToStart: false
  };
}

function buildReviewDraft(customerId: string, item: PortalCampaign, review?: CustomerCampaignReview): ReviewDraft {
  const now = new Date().toISOString();
  const existingVideoReviews = new Map(review?.videoReviews.map((row) => [row.conceptTitle, row]));
  const existingPublishingReviews = new Map(review?.publishingReviews.map((row) => [row.taskKey, row]));

  return {
    customerId,
    campaignId: item.id,
    videoReviews: item.campaign.pack.videoConcepts.map((concept) => {
      const existing = existingVideoReviews.get(concept.title);
      return {
        conceptTitle: concept.title,
        status: existing?.status ?? "needs-review",
        note: existing?.note ?? "",
        updatedAt: existing?.updatedAt ?? now
      };
    }),
    publishingReviews: item.campaign.pack.publishingQueue.map((task) => {
      const taskKey = publishingTaskKey(task);
      const existing = existingPublishingReviews.get(taskKey);
      return {
        taskKey,
        conceptTitle: task.conceptTitle,
        platform: task.platform,
        day: task.day,
        status: existing?.status ?? "needs-review",
        note: existing?.note ?? "",
        scheduledFor: existing?.scheduledFor ?? "",
        autoPublishApproved: existing?.autoPublishApproved ?? false,
        publishingJobId: existing?.publishingJobId ?? "",
        publishingJobQueuedAt: existing?.publishingJobQueuedAt ?? "",
        publishingError: existing?.publishingError ?? "",
        performance: existing?.performance ?? defaultPortalPerformance(),
        updatedAt: existing?.updatedAt ?? now
      };
    }),
    customerNotes: review?.customerNotes ?? "",
    proofNotes: review?.proofNotes ?? "",
    proofPermission: review?.proofPermission ?? false
  };
}

function buildWorkflowSteps({
  customer,
  onboarding,
  campaigns,
  review
}: {
  customer: CustomerView;
  onboarding: CustomerOnboarding | null;
  campaigns: PortalCampaign[];
  review?: CustomerCampaignReview;
}) {
  const billingDone = ["active", "trialing", "manual-review"].includes(customer.status);
  const briefDone = Boolean(onboarding);
  const packStarted = campaigns.length > 0;
  const packDone = campaigns.some((item) => item.campaign.planningStatus === "pack-ready");
  const reviewDone = review?.overallStatus === "approved" || review?.overallStatus === "ready-to-schedule" || review?.overallStatus === "scheduled";
  const scheduleDone = review?.overallStatus === "ready-to-schedule" || review?.overallStatus === "scheduled";
  return [
    {
      icon: ShieldCheck,
      label: "Account",
      text: billingDone ? "Billing or manual approval is active" : "Waiting for activation",
      state: billingDone ? "done" : "current"
    },
    {
      icon: ClipboardList,
      label: "Brief",
      text: briefDone ? "Business context saved" : "Complete the intake once",
      state: briefDone ? "done" : billingDone ? "current" : "pending"
    },
    {
      icon: Wand2,
      label: "Generate",
      text: packDone ? "First campaign pack is ready" : packStarted ? "Preparing campaign pack" : "Generate videos and schedule",
      state: packDone ? "done" : briefDone ? "current" : "pending"
    },
    {
      icon: Film,
      label: "Review",
      text: reviewDone ? "Concepts approved or ready" : "Approve, edit, or regenerate",
      state: reviewDone ? "done" : packDone ? "current" : "pending"
    },
    {
      icon: Clock3,
      label: "Schedule",
      text: scheduleDone ? "Publishing queue is ready" : "Confirm posting windows",
      state: scheduleDone ? "done" : reviewDone ? "current" : "pending"
    }
  ];
}

function publishingTaskKey(task: PublicCampaign["pack"]["publishingQueue"][number]) {
  return `${task.platform}-${task.conceptTitle}-${task.day}-${task.publishWindow}`;
}

function isRenderActiveAsset(asset: GeneratedVideoAsset) {
  return asset.status === "render-queued" || asset.status === "rendering";
}

function hasActiveRender(campaign: PublicCampaign | null) {
  return Boolean(campaign?.pack.videoAssets.some(isRenderActiveAsset));
}

function isPlanningActive(campaign: PublicCampaign | null) {
  return campaign?.planningStatus === "planning-queued" || campaign?.planningStatus === "planning";
}

function isPlanningFailed(campaign: PublicCampaign | null) {
  return campaign?.planningStatus === "planning-failed";
}

function campaignRenderKey(campaign: PublicCampaign | null) {
  if (!campaign) return "";
  return [
    campaign.planningStatus,
    campaign.planningCompletedAt,
    campaign.planningError,
    ...campaign.pack.videoAssets.map((asset) =>
      `${asset.id}:${asset.status}:${asset.renderMode}:${asset.renderCompletedAt || asset.renderStartedAt || asset.renderQueuedAt}`
    )
  ].join("|");
}

function renderStatusSummary(campaign: PublicCampaign | null) {
  if (isPlanningActive(campaign)) {
    return {
      state: "active",
      label: campaign?.planningStatus === "planning" ? "AI campaign planning running" : "AI campaign planning queued",
      detail:
        "VIDSLOOM is preparing trend intelligence, scripts, captions, schedule rows, and approval checks. MP4 previews start automatically after planning."
    };
  }

  if (isPlanningFailed(campaign)) {
    return {
      state: "failed",
      label: "Campaign planning needs attention",
      detail: "VIDSLOOM could not complete the campaign pack yet. The team can retry planning from the operations workspace."
    };
  }

  const assets = campaign?.pack.videoAssets ?? [];
  const total = assets.length || campaign?.pack.videoConcepts.length || 0;
  const queued = assets.filter((asset) => asset.status === "render-queued").length;
  const rendering = assets.filter((asset) => asset.status === "rendering").length;
  const failed = assets.filter((asset) => asset.status === "render-failed").length;
  const readyGenerated = assets.filter((asset) => asset.renderMode === "dynamic-render" || asset.renderMode === "ai-generated").length;
  const duration = campaign?.intake.videoSettings.durationSeconds ?? 15;
  const quality = formatStatus(campaign?.intake.videoSettings.qualityMode ?? "balanced");

  if (queued || rendering) {
    return {
      state: "active",
      label: `${queued + rendering}/${total} MP4s rendering`,
      detail: `${duration}s ${quality} previews are being prepared. You can review scripts, captions, CTAs, and posting windows now.`
    };
  }

  if (failed) {
    return {
      state: "failed",
      label: `${failed}/${total} renders need attention`,
      detail: "Review previews are visible, but VIDSLOOM should retry the customer-specific MP4 render before final approval."
    };
  }

  if (readyGenerated) {
    return {
      state: "ready",
      label: `${readyGenerated}/${total} customer-specific MP4s ready`,
      detail: `${duration}s ${quality} previews have been rendered from your brief and are ready for review.`
    };
  }

  return {
    state: "pending",
    label: "Sample previews available",
    detail: `${duration}s ${quality} settings are saved. Customer-specific rendering starts when the render queue runs.`
  };
}

function getPortalVideoAsset(campaign: PublicCampaign, conceptTitle: string, index: number): GeneratedVideoAsset {
  const existing = campaign.pack.videoAssets.find((asset) => asset.conceptTitle === conceptTitle) ?? campaign.pack.videoAssets[index];
  if (existing) return existing;

  const fallback = previewAssets[index % previewAssets.length];
  const concept = campaign.pack.videoConcepts.find((item) => item.title === conceptTitle);
  return {
    id: `fallback_asset_${index + 1}`,
    conceptTitle,
    platform: campaign.intake.platforms[index % campaign.intake.platforms.length],
    title: fallback.label,
    status: "rendered-preview",
    videoUrl: fallback.src,
    posterUrl: fallback.poster,
    sourceImageUrl: "",
    storageProvider: "public-sample",
    storageKey: "",
    posterStorageKey: "",
    renderMode: "sample-fallback",
    renderJobId: "",
    renderError: "",
    renderQueuedAt: "",
    renderStartedAt: "",
    renderCompletedAt: "",
    aspectRatio: "9:16",
    resolution: "720x1280",
    durationSeconds: campaign.intake.videoSettings.durationSeconds,
    qualityMode: campaign.intake.videoSettings.qualityMode,
    qualityInstructions: campaign.intake.videoSettings.qualityInstructions,
    renderStyle: "VIDSLOOM sample render with generated hook, caption, and CTA overlay",
    generatedBy: "VIDSLOOM video renderer",
    provenance: "Generated preview asset mapped from the campaign concept for review.",
    sourceInputs: [
      `Offer: ${campaign.intake.offer}`,
      `Audience: ${campaign.intake.audience}`,
      `Proof: ${campaign.intake.proofPoints || "Proof points pending customer confirmation."}`
    ],
    pipelineSteps: [
      "Campaign concept selected",
      "Script and caption prepared",
      "Vertical preview rendered",
      "Approval checks attached"
    ],
    outputIncludes: ["MP4 preview", "Poster frame", "Script", "Caption", "CTA"],
    usageBoundary:
      "This is a VIDSLOOM-generated preview asset for review. Final customer publishing should use approved customer assets, claims, and permissions.",
    aiMediaQa: defaultAiMediaQa(),
    qualityGate: concept?.qualityGate ?? defaultConceptQualityGate(),
    createdAt: campaign.createdAt
  };
}

function defaultAiMediaQa(): GeneratedVideoAsset["aiMediaQa"] {
  return {
    verdict: "not-run",
    firstThreeSecondImpact: 0,
    motionCoherence: 0,
    artifactRisk: 0,
    textOrLogoLeak: false,
    failureReasons: [],
    qaSource: "not-run"
  };
}

function defaultConceptQualityGate(): PublicCampaign["pack"]["videoConcepts"][number]["qualityGate"] {
  return {
    status: "needs-review",
    score: 0,
    minPublishScore: 78,
    checks: [],
    publishBlockers: [],
    nextActions: ["Review proof, claims, storyboard, and final MP4 before publishing."]
  };
}

function reviewStats(draft: ReviewDraft) {
  return {
    approvedVideos: draft.videoReviews.filter((item) => item.status === "approved").length,
    changeRequests: draft.videoReviews.filter((item) => item.status === "changes-requested" || item.status === "regenerate").length,
    readyTasks: draft.publishingReviews.filter((item) => item.status === "ready-to-schedule" || item.status === "scheduled").length
  };
}

function defaultPortalPerformance(): CustomerPublishingPerformance {
  return {
    livePostUrl: "",
    directPostUrl: "",
    directPostId: "",
    directPostStatus: "",
    directPostPrivacyStatus: "",
    directPostUploadStatus: "",
    directPostCapturedAt: "",
    directPostMetricsAt: "",
    directViews: 0,
    directLikes: 0,
    directComments: 0,
    directShares: 0,
    directSaves: 0,
    directClicks: 0,
    directNotes: "",
    screenshotLinks: "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    directMessages: 0,
    bookings: 0,
    salesValue: 0,
    currency: "sgd",
    notes: "",
    capturedAt: "",
    followUp24hJobId: "",
    followUp48hJobId: "",
    followUp24hSentAt: "",
    followUp48hSentAt: ""
  };
}

function numberFromInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function numberInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function shouldPollPublishing(draft: ReviewDraft, attempts: PublishingAttempt[]) {
  return draft.publishingReviews.some((row) => {
    const rowAttempts = attempts.filter((attempt) => attempt.taskKey === row.taskKey);
    if (rowAttempts.some((attempt) => attempt.status === "publishing")) return true;
    if (!row.publishingJobId && !row.publishingJobQueuedAt) return false;
    return !rowAttempts.some(isTerminalPublishingAttempt);
  });
}

function isTerminalPublishingAttempt(attempt: PublishingAttempt) {
  return ["manual-kit-ready", "queued", "published", "blocked", "failed"].includes(attempt.status);
}

function publishingStatusSummary(
  row: PublishingReviewRow | undefined,
  attempt: PublishingAttempt | undefined,
  task: PublishingQueueTask
) {
  if (attempt?.status === "published") {
    const visibility = publishingVisibilityLabel(attempt);
    return {
      state: "live",
      label: "Live post created",
      detail: `${task.platform} accepted the upload${visibility ? ` with ${visibility.toLowerCase()} visibility` : ""}.`
    };
  }

  if (attempt?.status === "queued") {
    return {
      state: "active",
      label: "Submitted to platform",
      detail: "The platform accepted the publishing request. Capture the live URL or first metrics when available."
    };
  }

  if (attempt?.status === "publishing") {
    return {
      state: "active",
      label: "Publishing now",
      detail: "VIDSLOOM is uploading the approved MP4, caption, hashtags, and CTA through the connected account."
    };
  }

  if (attempt?.status === "manual-kit-ready") {
    return {
      state: "ready",
      label: "Manual posting kit ready",
      detail: "The MP4, caption, checklist, and posting instructions are ready for hands-on posting."
    };
  }

  if (attempt?.status === "blocked" || attempt?.status === "failed") {
    return {
      state: "blocked",
      label: attempt.status === "blocked" ? "Posting blocked" : "Posting failed",
      detail: attempt.error || "Use the manual posting kit while VIDSLOOM fixes the publishing issue."
    };
  }

  if (row?.publishingError) {
    return {
      state: "blocked",
      label: "Automation needs attention",
      detail: row.publishingError
    };
  }

  if (row?.publishingJobId) {
    return {
      state: "active",
      label: "Hands-off job queued",
      detail: row.scheduledFor
        ? `VIDSLOOM will publish this after ${formatDateTime(row.scheduledFor)} once platform checks pass.`
        : "VIDSLOOM queued this row and will publish when it becomes due."
    };
  }

  if (row?.autoPublishApproved && row.scheduledFor) {
    return {
      state: "ready",
      label: "Ready to queue",
      detail: `Save the review to queue hands-off posting for ${formatDateTime(row.scheduledFor)}.`
    };
  }

  if (row?.status === "scheduled") {
    return {
      state: "ready",
      label: "Scheduled for approval",
      detail: "Set the publish time and save the review to hand this row to VIDSLOOM automation."
    };
  }

  if (row?.status === "ready-to-schedule") {
    return {
      state: "ready",
      label: "Ready for scheduling",
      detail: "Choose a publish time, approve auto-publish, then save the queue."
    };
  }

  if (row?.status === "blocked") {
    return {
      state: "blocked",
      label: "Blocked by customer",
      detail: row.note || "This row will not be posted until it is unblocked."
    };
  }

  return {
    state: "pending",
    label: "Needs customer decision",
    detail: "Approve the matching video and set this row to Ready or Scheduled before posting."
  };
}

function providerResponseValue(attempt: PublishingAttempt, key: string) {
  return attempt.providerResponse[key]?.trim() ?? "";
}

function publishingVisibilityLabel(attempt: PublishingAttempt) {
  const privacy = providerResponseValue(attempt, "privacyStatus");
  if (privacy) return formatStatus(privacy);
  if (attempt.status === "published") return "Account default";
  return "Safe default";
}

function timestampFor(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatStatus(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultAutoPublishTime() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function formatDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  });
}

function formatApiError(data: { error?: string; issues?: ApiIssue[] }, fallback: string) {
  const firstIssue = data.issues?.[0];
  if (!firstIssue) return data.error ?? fallback;

  const path = firstIssue.path?.length ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}
