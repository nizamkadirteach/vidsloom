import { CampaignIntake, CampaignPack, CampaignPackSchema, Platform } from "@/lib/schemas";

function pickPlatform(platforms: Platform[], index: number) {
  return platforms[index % platforms.length];
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function buildFallbackCampaignPack(intake: CampaignIntake): CampaignPack {
  const business = intake.businessName;
  const mainPlatform = pickPlatform(intake.platforms, 0);
  const secondPlatform = pickPlatform(intake.platforms, 1);
  const thirdPlatform = pickPlatform(intake.platforms, 2);
  const keyword = slugify(intake.industry).replaceAll("-", "");

  return CampaignPackSchema.parse({
    executiveBrief: `${business} should launch with a proof-led content sprint: short videos that show the customer problem, demonstrate the offer, and ask viewers to take one measurable action. The first week should prioritize trust, clarity, and conversion over broad entertainment.`,
    positioning: `${business} should be positioned as the practical, low-friction answer for ${intake.audience}. Every video should make the viewer feel understood within the first three seconds, then prove that the offer is credible and easy to act on.`,
    trendIntelligence: {
      agentName: "ZeitgeistScout",
      generatedAt: new Date().toISOString(),
      freshnessWindow: "Fallback formulas. Refresh with live trend grounding before final publishing.",
      caveat:
        "Trend fit changes quickly. These formulas are designed for low-cost organic testing and should be refreshed against current platform signals before high-spend paid campaigns.",
      recommendedFormats: [
        "Founder POV with a contrarian first line",
        "Before-after workflow transformation",
        "Three-part checklist with a sharp warning",
        "Customer objection answered in one minute"
      ],
      signals: [
        {
          platform: mainPlatform,
          format: "Founder POV with a contrarian first line",
          trendSignal: "Direct founder explanations can create trust without expensive production.",
          whyNow: "Small-business audiences often respond to useful, plainspoken founder content before polished ads.",
          remixFormula: "Start with a common belief, challenge it, show the hidden cost, then give one concrete action.",
          organicPlay: "Record on phone, add bold captions, and publish during the best customer decision window.",
          paidVariant: "Retarget viewers who watched 50 percent or more with a proof-led offer clip.",
          recommendedAssetType: "Vertical founder video with captions",
          costLevel: "low",
          confidence: 82,
          sourceType: "fallback-formula"
        },
        {
          platform: secondPlatform,
          format: "Before-after workflow transformation",
          trendSignal: "Transformation content makes the value obvious quickly.",
          whyNow: "Businesses need fast clarity on what changes after using the service.",
          remixFormula: "Show the painful manual workflow, the AI-assisted workflow, then the time saved or quality gained.",
          organicPlay: "Use customer-owned screenshots or simple screen recordings with private data removed.",
          paidVariant: "Run as a low-budget conversion test once the organic version earns saves or comments.",
          recommendedAssetType: "Screen recording plus captions",
          costLevel: "low",
          confidence: 80,
          sourceType: "fallback-formula"
        },
        {
          platform: thirdPlatform,
          format: "Three-part checklist with a sharp warning",
          trendSignal: "Checklist videos are easy to save and share.",
          whyNow: "Useful content that reduces buyer risk can convert without heavy ad spend.",
          remixFormula: "Give three checks, explain the one mistake to avoid, then invite the viewer to request help.",
          organicPlay: "Publish as a practical short with clean on-screen labels and a single CTA.",
          paidVariant: "Use as a top-of-funnel educational creative for small retargeting pools.",
          recommendedAssetType: "Talking head or template-based vertical video",
          costLevel: "low",
          confidence: 78,
          sourceType: "fallback-formula"
        },
        {
          platform: mainPlatform,
          format: "Customer objection answered in one minute",
          trendSignal: "Objection-led content helps turn passive viewers into qualified conversations.",
          whyNow: "Organic reach is more useful when the video attracts people with a specific purchase hesitation.",
          remixFormula: "Name the objection, explain when it is valid, show the safer decision rule, then invite a low-friction reply.",
          organicPlay: "Use one objection per post and ask viewers to comment with their situation.",
          paidVariant: "Promote only the objection that produces high-quality replies or saved posts.",
          recommendedAssetType: "Founder video, customer FAQ clip, or caption-led template",
          costLevel: "low",
          confidence: 76,
          sourceType: "fallback-formula"
        }
      ]
    },
    brandReadiness: [
      "Confirm the strongest customer promise and avoid claims that cannot be proven.",
      "Collect three customer proof points before publishing conversion-heavy content.",
      "Prepare one founder or product visual, one customer outcome visual, and one behind-the-scenes visual.",
      "Define a clear approval rule: no post ships without offer accuracy, brand voice, and compliance review."
    ],
    trendAngles: [
      {
        name: "Myth versus reality",
        insight: `Turn common misconceptions in ${intake.industry} into quick teachable moments.`,
        fitScore: 91,
        executionNote: "Open with a strong myth, show the consequence, then demonstrate the better path using the offer."
      },
      {
        name: "Before the customer buys",
        insight: "Educational pre-purchase content builds trust while filtering for higher-intent leads.",
        fitScore: 88,
        executionNote: "Show the viewer what to check, avoid, or ask before choosing a provider."
      },
      {
        name: "Founder explains the hidden cost",
        insight: "Founder-led clarity can outperform polished ads when the market is skeptical.",
        fitScore: 84,
        executionNote: "Use a direct-to-camera hook followed by one concrete example and a clear CTA."
      },
      {
        name: "Proof in public",
        insight: "Small businesses can win attention by showing proof, process, and customer outcomes.",
        fitScore: 86,
        executionNote: "Use anonymized customer examples until permissioned testimonials are available."
      }
    ],
    videoConcepts: [
      {
        title: "The mistake your next customer is already making",
        platform: mainPlatform,
        objective: "Generate high-intent awareness by naming the pain clearly.",
        hook: `Most ${intake.industry} buyers make this mistake before they ever talk to ${business}.`,
        script: `Most people do not need more options. They need to avoid the wrong first step. If you are ${intake.goal.toLowerCase()}, start by checking whether the offer actually solves your specific situation. At ${business}, we focus on ${intake.offer}. That means less guesswork and a clearer next move. If this sounds like you, use the link to get the first recommendation.`,
        shotList: [
          "Direct-to-camera opener with the mistake as on-screen text.",
          "Cut to a simple visual of the wrong path versus the better path.",
          "Show product, service, or proof asset with a specific caption.",
          "End with a single CTA and no competing message."
        ],
        caption: `Avoid the expensive first mistake. ${business} helps you move with a clearer plan.`,
        hashtags: [`#${keyword}`, "#smallbusiness", "#marketing", "#growth", "#founder"],
        cta: "Book a quick audit or request the first recommendation.",
        approvalRisks: ["Validate any performance claim before publishing.", "Avoid implying guaranteed revenue or outcomes."],
        qualityScore: 91
      },
      {
        title: "Three signs you are ready for this offer",
        platform: secondPlatform,
        objective: "Qualify leads by making fit obvious.",
        hook: `Three signs ${business} is a fit for you.`,
        script: `Sign one: you already know the problem but cannot solve it consistently. Sign two: the current workaround costs too much time. Sign three: you need a clear next step, not a long sales pitch. If that sounds familiar, ${business} helps with ${intake.offer}. Start with a small decision and measure the result.`,
        shotList: [
          "Numbered list overlay with three crisp signs.",
          "Use one relevant visual per sign.",
          "Add a quick proof point or customer quote if approved.",
          "Finish with a low-friction CTA."
        ],
        caption: "If these three signs sound familiar, it may be time to fix the system instead of pushing harder.",
        hashtags: [`#${keyword}`, "#businessowner", "#leadgeneration", "#contentstrategy"],
        cta: "Message the word READY for the next step.",
        approvalRisks: ["Confirm testimonial permission before using customer quotes."],
        qualityScore: 88
      },
      {
        title: "The hidden cost of doing nothing",
        platform: thirdPlatform,
        objective: "Create urgency without hype.",
        hook: "Doing nothing still has a cost.",
        script: `When a business delays fixing this, the cost usually shows up as lost time, missed leads, or inconsistent follow-through. The goal is not to buy more tools. The goal is to get a repeatable system. ${business} helps ${intake.audience} by focusing on ${intake.offer}. Here is the smallest next step we recommend.`,
        shotList: [
          "Open with text: Doing nothing still has a cost.",
          "Show three cost categories with clean on-screen labels.",
          "Show the VIDSLOOM-style recommendation or offer workflow.",
          "End with one recommended next action."
        ],
        caption: "The quiet cost is usually the one that compounds fastest.",
        hashtags: [`#${keyword}`, "#operations", "#growthstrategy", "#smb"],
        cta: "Ask for a 10-minute review.",
        approvalRisks: ["Keep cost examples general unless customer-specific data is verified."],
        qualityScore: 87
      },
      {
        title: "Behind the offer",
        platform: pickPlatform(intake.platforms, 3),
        objective: "Build trust by showing process.",
        hook: `Here is what happens before ${business} recommends anything.`,
        script: `A good recommendation starts before the sale. First, we understand the situation. Then we check what is already working. Then we identify the smallest action that can create a measurable result. That is how ${business} approaches ${intake.offer}.`,
        shotList: [
          "Show intake or discovery notes with private data hidden.",
          "Show a simple three-step process graphic.",
          "Show a founder or team moment.",
          "End with the customer's first action."
        ],
        caption: "Trust increases when the process is visible.",
        hashtags: [`#${keyword}`, "#behindthescenes", "#trust", "#process"],
        cta: "Start with the intake form.",
        approvalRisks: ["Blur or remove private customer details from any screen capture."],
        qualityScore: 89
      },
      {
        title: "Customer question of the week",
        platform: pickPlatform(intake.platforms, 4),
        objective: "Turn a common objection into a useful buying signal.",
        hook: "The question we wish every customer asked sooner.",
        script: `Before choosing a solution, ask this: what will be different after the first week? For ${business}, the answer should be specific, visible, and measurable. We use that question to keep ${intake.offer} tied to a real business result instead of vague activity.`,
        shotList: [
          "Open with the question as large on-screen text.",
          "Show the answer in three short proof-oriented beats.",
          "Show the first-week deliverable or customer-facing output.",
          "End with a prompt for viewers to ask for the checklist."
        ],
        caption: "A better question creates a better buying decision.",
        hashtags: [`#${keyword}`, "#customerquestions", "#sales", "#marketingops"],
        cta: "Comment CHECKLIST or request the first-week checklist.",
        approvalRisks: ["Do not imply that every customer will get the same measurable result."],
        qualityScore: 90
      }
    ],
    videoAssets: [],
    calendar: [
      {
        day: "Monday",
        platform: mainPlatform,
        conceptTitle: "The mistake your next customer is already making",
        publishWindow: "8:00-10:00 AM local time",
        reason: "Start the week with a clear educational hook and a conversion-oriented CTA."
      },
      {
        day: "Wednesday",
        platform: secondPlatform,
        conceptTitle: "Three signs you are ready for this offer",
        publishWindow: "12:00-1:30 PM local time",
        reason: "Midweek qualification content catches buyers evaluating options."
      },
      {
        day: "Friday",
        platform: thirdPlatform,
        conceptTitle: "The hidden cost of doing nothing",
        publishWindow: "4:00-6:00 PM local time",
        reason: "Urgency content works well when viewers are planning next-week priorities."
      },
      {
        day: "Sunday",
        platform: mainPlatform,
        conceptTitle: "Behind the offer",
        publishWindow: "7:00-9:00 PM local time",
        reason: "Trust-building content prepares the audience for the next campaign cycle."
      },
      {
        day: "Tuesday",
        platform: pickPlatform(intake.platforms, 4),
        conceptTitle: "Customer question of the week",
        publishWindow: "6:00-8:00 PM local time",
        reason: "Question-led content creates replies and reveals buyer objections."
      }
    ],
    publishingQueue: [],
    experiments: [
      {
        testName: "Hook specificity",
        variantA: "Name the exact customer mistake in the first sentence.",
        variantB: "Open with the hidden cost of the unresolved problem.",
        successMetric: "Three-second hold rate and profile click-through rate."
      },
      {
        testName: "CTA friction",
        variantA: "Book a quick audit.",
        variantB: "Message one keyword for the first recommendation.",
        successMetric: "Replies, booked calls, and qualified lead rate."
      },
      {
        testName: "Proof format",
        variantA: "Use a founder explanation with one proof point.",
        variantB: "Use a customer question with a checklist offer.",
        successMetric: "Saves, shares, comments, and follow-up requests."
      }
    ],
    kpiPlan: [
      {
        metric: "Qualified replies",
        target: "5+ replies in the first campaign week",
        captureMethod: "Manual social inbox count plus saved analytics screenshots."
      },
      {
        metric: "Profile or landing-page clicks",
        target: "2 percent click-through from engaged viewers",
        captureMethod: "Platform analytics plus UTM-tagged landing page."
      },
      {
        metric: "Booked calls or purchases",
        target: "1+ attributable conversion in the first sprint",
        captureMethod: "Customer CRM, booking tool, checkout records, or invoice notes."
      },
      {
        metric: "Customer time saved",
        target: "Customer confirms 2+ hours saved versus manual campaign planning",
        captureMethod: "Short customer feedback form after first delivery."
      }
    ],
    risks: [
      "The offer may need sharper proof before revenue-focused content can perform.",
      "Trend-led content should not override brand safety or regulated-claim constraints.",
      "Manual publishing may be required until official platform API access is approved."
    ],
    nextActions: [
      "Confirm the offer, proof points, and prohibited claims with the customer.",
      "Select the first three video concepts and record or assemble assets.",
      "Publish the first campaign pack using approved captions and CTAs.",
      "Capture screenshots of published posts, metrics, and customer feedback.",
      "Run the RevenueAnalyst review 72 hours after the first post."
    ]
  });
}
