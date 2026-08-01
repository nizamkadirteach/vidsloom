import "server-only";

import { buildOwnerFollowupLinks } from "@/lib/contact-actions";
import type {
  BillingCustomer,
  Campaign,
  CustomerCampaignReview,
  CustomerOnboarding,
  PublishingAttempt
} from "@/lib/schemas";
import type { Lead } from "@/lib/schemas";

const SENDGRID_API_BASE = "https://api.sendgrid.com";

type SendGridResult =
  | { ok: true; skipped?: false; status: number; jobId?: string }
  | { ok: false; skipped?: false; status?: number; error: string }
  | { ok: true; skipped: true; reason: string };

type SendGridJsonResult<T> =
  | { ok: true; skipped?: false; status: number; data: T }
  | { ok: false; skipped?: false; status?: number; error: string }
  | { ok: true; skipped: true; reason: string };

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function listEnv(...names: string[]) {
  return Array.from(
    new Set(
      names
        .flatMap((name) => env(name).split(","))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getConfig() {
  return {
    apiKey: env("SENDGRID_API_KEY"),
    fromEmail: env("SENDGRID_FROM_EMAIL") || env("VIDSLOOM_FROM_EMAIL"),
    fromName: env("SENDGRID_FROM_NAME") || "VIDSLOOM",
    replyToEmail: env("SENDGRID_REPLY_TO_EMAIL") || env("VIDSLOOM_SALES_EMAIL") || env("SENDGRID_FROM_EMAIL"),
    salesEmail: env("VIDSLOOM_SALES_EMAIL") || env("SENDGRID_NOTIFY_EMAIL") || env("SENDGRID_FROM_EMAIL"),
    leadTemplateId: env("SENDGRID_LEAD_AUTORESPONDER_TEMPLATE_ID"),
    ownerTemplateId: env("SENDGRID_OWNER_LEAD_TEMPLATE_ID"),
    marketingListIds: listEnv("SENDGRID_MARKETING_LIST_IDS"),
    contactDbListIds: listEnv("SENDGRID_CONTACTDB_LIST_IDS", "SENDGRID_LEGACY_CONTACTDB_LIST_IDS")
  };
}

export function getSendGridStatus() {
  const config = getConfig();
  const canSendLeadAutoresponder = Boolean(config.apiKey && config.fromEmail);
  const canSendOwnerNotification = Boolean(config.apiKey && config.fromEmail && config.salesEmail);
  const sendGridListCount = config.marketingListIds.length + config.contactDbListIds.length;

  return {
    configured: canSendLeadAutoresponder || canSendOwnerNotification,
    hasApiKey: Boolean(config.apiKey),
    hasFromEmail: Boolean(config.fromEmail),
    hasSalesEmail: Boolean(config.salesEmail),
    hasLeadTemplate: Boolean(config.leadTemplateId),
    hasOwnerTemplate: Boolean(config.ownerTemplateId),
    canSendLeadAutoresponder,
    canSendOwnerNotification,
    leadAutoresponderMode: config.leadTemplateId ? "dynamic-template" : "inline-email",
    ownerNotificationMode: config.ownerTemplateId ? "dynamic-template" : "inline-email",
    newsletterCaptureMode: "vidsloom-native-list",
    externalListSyncMode: config.marketingListIds.length
      ? "sendgrid-marketing-list"
      : config.contactDbListIds.length
        ? "sendgrid-contactdb-list"
        : "internal-lead-store",
    canAttemptMarketingListSync: Boolean(config.apiKey && sendGridListCount),
    marketingListCount: config.marketingListIds.length,
    contactDbListCount: config.contactDbListIds.length,
    sendGridListCount
  };
}

function formatLeadValue(value: string) {
  return value.trim() || "Not provided yet";
}

function leadSummary(lead: Lead) {
  const links = buildOwnerFollowupLinks(lead);
  return [
    `Lead: ${lead.contactName} at ${lead.businessName}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : "",
    `Preferred contact: ${lead.preferredContact}`,
    lead.newsletterOptIn ? "Newsletter opt-in: yes" : "Newsletter opt-in: no",
    lead.website ? `Website/social: ${lead.website}` : "",
    `Industry: ${lead.industry}`,
    `Platforms: ${lead.platforms.join(", ")}`,
    `Budget: ${lead.monthlyBudget}`,
    `Urgency: ${lead.urgency}`,
    `Goal: ${lead.goal}`,
    lead.currentContent ? `Current content: ${lead.currentContent}` : "",
    links.email ? `Email follow-up: ${links.email}` : "",
    links.whatsapp ? `WhatsApp follow-up: ${links.whatsapp}` : "",
    links.sms ? `SMS follow-up: ${links.sms}` : "",
    "Recommended SLA: reply within 5 minutes if possible; same day at minimum.",
    `Source: ${lead.source}`,
    `Lead ID: ${lead.id}`
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function leadTemplateData(lead: Lead) {
  return {
    lead_id: lead.id,
    business_name: lead.businessName,
    contact_name: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    industry: lead.industry,
    goal: lead.goal,
    current_content: lead.currentContent,
    platforms: lead.platforms.join(", "),
    monthly_budget: lead.monthlyBudget,
    urgency: lead.urgency,
    preferred_contact: lead.preferredContact,
    newsletter_opt_in: lead.newsletterOptIn,
    source: lead.source,
    created_at: lead.createdAt
  };
}

function ownerNotificationHtml(lead: Lead) {
  const links = buildOwnerFollowupLinks(lead);
  const followupButtons = [
    links.email ? `<a href="${escapeHtml(links.email)}" style="background:#172033;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">Email lead</a>` : "",
    links.whatsapp ? `<a href="${escapeHtml(links.whatsapp)}" style="background:#14804a;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">WhatsApp lead</a>` : "",
    links.sms ? `<a href="${escapeHtml(links.sms)}" style="background:#0891b2;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">SMS lead</a>` : ""
  ].join("");

  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:680px;">
  <p style="color:#0891b2;font-size:12px;font-weight:800;text-transform:uppercase;margin:0 0 8px;">New VIDSLOOM audit request</p>
  <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px;">${escapeHtml(lead.businessName)} wants a video growth audit</h1>
  <p style="margin:0 0 16px;">Reply fast. Best first ask: request 2-3 links to their current posts, social profiles, website, or product/service pages so the first video angles can be prepared.</p>
  <div style="background:#f7fbfc;border:1px solid #cdeff5;border-radius:10px;padding:14px;margin:0 0 16px;">
    <p style="margin:0;"><strong>Contact:</strong> ${escapeHtml(lead.contactName)} &lt;${escapeHtml(lead.email)}&gt;</p>
    <p style="margin:6px 0 0;"><strong>Phone/WhatsApp:</strong> ${escapeHtml(formatLeadValue(lead.phone))}</p>
    <p style="margin:6px 0 0;"><strong>Preferred follow-up:</strong> ${escapeHtml(lead.preferredContact)}</p>
    <p style="margin:6px 0 0;"><strong>Business type:</strong> ${escapeHtml(lead.industry)}</p>
  </div>
  <div style="margin:0 0 16px;">${followupButtons || `<p style="margin:0;color:#657083;">No one-click phone link because no phone number was supplied.</p>`}</div>
  <h2 style="font-size:16px;margin:18px 0 8px;">Goal</h2>
  <p style="background:#fff8fb;border-left:4px solid #db2777;padding:10px 12px;margin:0 0 16px;">${escapeHtml(lead.goal)}</p>
  <h2 style="font-size:16px;margin:18px 0 8px;">Lead details</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Source</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(lead.source)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Urgency</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(lead.urgency)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Budget</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(lead.monthlyBudget)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Platforms</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(lead.platforms.join(", "))}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Lead ID</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(lead.id)}</td></tr>
  </table>
</div>`;
}

function leadAutoresponderText(lead: Lead) {
  return `Hi ${lead.contactName},

Thanks for requesting a VIDSLOOM video growth audit for ${lead.businessName}.

We received your request and will review:
- Your offer and target customer
- The fastest short-form video angles to test first
- What proof, product details, reviews, or assets can be turned into videos
- Your first approval-ready posting queue

To move fastest, reply with any 2-3 links you already have:
- Website or product/service page
- Instagram, TikTok, YouTube Shorts, LinkedIn, or Facebook profile
- Best current post, review page, menu, product listing, or testimonial

You do not need to film or edit anything before the audit. We are looking for the business proof and offer context needed to generate your first video campaign direction.

VIDSLOOM`;
}

function leadAutoresponderHtml(lead: Lead) {
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:640px;">
  <p>Hi ${escapeHtml(lead.contactName)},</p>
  <p>Thanks for requesting a VIDSLOOM video growth audit for <strong>${escapeHtml(lead.businessName)}</strong>.</p>
  <p>We received your request and will review your offer, target customer, fastest short-form video angles, available proof, and first approval-ready posting queue.</p>
  <div style="background:#f7fbfc;border:1px solid #cdeff5;border-radius:10px;padding:14px;margin:18px 0;">
    <p style="margin:0 0 8px;"><strong>To move fastest, reply with any 2-3 links you already have:</strong></p>
    <ul style="margin:0;padding-left:20px;">
      <li>Website or product/service page</li>
      <li>Instagram, TikTok, YouTube Shorts, LinkedIn, or Facebook profile</li>
      <li>Best current post, review page, menu, product listing, or testimonial</li>
    </ul>
  </div>
  <p>You do not need to film or edit anything before the audit. We are looking for the business proof and offer context needed to generate your first video campaign direction.</p>
  <p>VIDSLOOM</p>
</div>`;
}

async function sendGridRequest(path: string, init: RequestInit): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.apiKey) {
    return { ok: true, skipped: true, reason: "SENDGRID_API_KEY is not configured." };
  }

  try {
    const response = await fetch(`${SENDGRID_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text || `SendGrid request failed with HTTP ${response.status}.`
      };
    }
    const json = text ? (JSON.parse(text) as { job_id?: string }) : {};
    return { ok: true, status: response.status, jobId: json.job_id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown SendGrid error."
    };
  }
}

async function sendGridJsonRequest<T>(path: string, init: RequestInit): Promise<SendGridJsonResult<T>> {
  const config = getConfig();
  if (!config.apiKey) {
    return { ok: true, skipped: true, reason: "SENDGRID_API_KEY is not configured." };
  }

  try {
    const response = await fetch(`${SENDGRID_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text || `SendGrid request failed with HTTP ${response.status}.`
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (text ? JSON.parse(text) : {}) as T
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown SendGrid error."
    };
  }
}

async function sendMail(payload: Record<string, unknown>): Promise<SendGridResult> {
  return sendGridRequest("/v3/mail/send", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

type ContactDbRecipientResponse = {
  error_count?: number;
  errors?: unknown[];
  persisted_recipients?: string[];
};

function sendGridContactCapacityReason(error: string) {
  if (/limit of contacts|upgrade your account|access forbidden|correct scopes/i.test(error)) {
    return "Captured in the internal newsletter opt-in list. SendGrid contact-list sync is configured, but SendGrid contact capacity or Marketing Contacts permissions are not enabled on the account.";
  }

  return "";
}

export async function addLeadToMarketingList(lead: Lead): Promise<SendGridResult> {
  if (!lead.newsletterOptIn) {
    return { ok: true, skipped: true, reason: "Lead did not opt in to the newsletter." };
  }

  const config = getConfig();
  if (config.contactDbListIds.length) {
    const recipient = await sendGridJsonRequest<ContactDbRecipientResponse>("/v3/contactdb/recipients", {
      method: "POST",
      body: JSON.stringify([
        {
          email: lead.email,
          first_name: lead.contactName,
          last_name: lead.businessName
        }
      ])
    });

    if (recipient.skipped || !recipient.ok) {
      const reason = !recipient.ok ? sendGridContactCapacityReason(recipient.error) : "";
      if (reason) {
        return { ok: true, skipped: true, reason };
      }
      return recipient;
    }

    const recipientId = recipient.data.persisted_recipients?.[0];
    if (!recipientId || recipient.data.error_count) {
      const error = JSON.stringify(recipient.data.errors ?? recipient.data);
      const reason = sendGridContactCapacityReason(error);
      if (reason) {
        return { ok: true, skipped: true, reason };
      }

      return {
        ok: false,
        status: recipient.status,
        error: `SendGrid ContactDB recipient sync failed: ${error}`
      };
    }

    const addResults = await Promise.all(
      config.contactDbListIds.map((listId) =>
        sendGridRequest(`/v3/contactdb/lists/${encodeURIComponent(listId)}/recipients/${encodeURIComponent(recipientId)}`, {
          method: "POST"
        })
      )
    );
    const failed = addResults.find((result) => !result.ok);
    if (failed) {
      return failed;
    }

    return {
      ok: true,
      status: Math.max(...addResults.map((result) => ("status" in result && result.status ? result.status : 200)))
    };
  }

  if (!config.marketingListIds.length) {
    return {
      ok: true,
      skipped: true,
      reason: "Captured in the internal newsletter opt-in list. No SendGrid newsletter list is configured."
    };
  }

  return sendGridRequest("/v3/marketing/contacts", {
    method: "PUT",
    body: JSON.stringify({
      list_ids: config.marketingListIds,
      contacts: [
        {
          email: lead.email,
          first_name: lead.contactName,
          phone_number: lead.phone || undefined,
          external_id: lead.id
        }
      ]
    })
  });
}

export async function sendOwnerLeadNotification(lead: Lead): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail || !config.salesEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL or VIDSLOOM_SALES_EMAIL is not configured." };
  }

  const templateData = leadTemplateData(lead);
  const payload = config.ownerTemplateId
    ? {
        from: { email: config.fromEmail, name: config.fromName },
        reply_to: { email: lead.email, name: lead.contactName },
        personalizations: [
          {
            to: [{ email: config.salesEmail, name: "VIDSLOOM Sales" }],
            dynamic_template_data: templateData
          }
        ],
        template_id: config.ownerTemplateId,
        categories: ["vidsloom-lead", `source-${lead.source}`]
      }
    : {
        from: { email: config.fromEmail, name: config.fromName },
        reply_to: { email: lead.email, name: lead.contactName },
        personalizations: [{ to: [{ email: config.salesEmail, name: "VIDSLOOM Sales" }] }],
        subject: `New VIDSLOOM lead: ${lead.businessName}`,
        content: [
          {
            type: "text/plain",
            value: leadSummary(lead)
          },
          {
            type: "text/html",
            value: ownerNotificationHtml(lead)
          }
        ],
        categories: ["vidsloom-lead", `source-${lead.source}`]
      };

  return sendMail(payload);
}

export async function sendLeadAutoresponder(lead: Lead): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL is not configured." };
  }

  const templateData = leadTemplateData(lead);
  const payload = config.leadTemplateId
    ? {
        from: { email: config.fromEmail, name: config.fromName },
        reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
        personalizations: [
          {
            to: [{ email: lead.email, name: lead.contactName }],
            dynamic_template_data: templateData
          }
        ],
        template_id: config.leadTemplateId,
        categories: ["vidsloom-autoresponder", `source-${lead.source}`]
      }
    : {
        from: { email: config.fromEmail, name: config.fromName },
        reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
        personalizations: [{ to: [{ email: lead.email, name: lead.contactName }] }],
        subject: "Your VIDSLOOM video growth audit request",
        content: [
          {
            type: "text/plain",
            value: leadAutoresponderText(lead)
          },
          {
            type: "text/html",
            value: leadAutoresponderHtml(lead)
          }
        ],
        categories: ["vidsloom-autoresponder", `source-${lead.source}`]
      };

  return sendMail(payload);
}

export function getNewsletterTestRecipient() {
  const config = getConfig();
  return config.salesEmail || config.replyToEmail || config.fromEmail;
}

export async function sendOpsAlertEmail({
  subject,
  body
}: {
  subject: string;
  body: string;
}): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail || !config.salesEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL or VIDSLOOM_SALES_EMAIL is not configured." };
  }

  const htmlBody = body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
    personalizations: [{ to: [{ email: config.salesEmail, name: "VIDSLOOM Ops" }] }],
    subject,
    content: [
      {
        type: "text/plain",
        value: body
      },
      {
        type: "text/html",
        value: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:720px;">${htmlBody}</div>`
      }
    ],
    categories: ["vidsloom-ops-alerts"]
  });
}

export async function sendNewsletterEmail({
  toEmail,
  toName,
  subject,
  body,
  unsubscribeUrl,
  categories,
  customArgs
}: {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  unsubscribeUrl?: string;
  categories?: string[];
  customArgs?: Record<string, string>;
}) {
  const config = getConfig();
  if (!config.fromEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL is not configured." } satisfies SendGridResult;
  }

  const footer = unsubscribeUrl
    ? `You are receiving this because you opted in to VIDSLOOM video trend notes. Unsubscribe: ${unsubscribeUrl}`
    : "Test message from VIDSLOOM. Broadcast emails include a personal unsubscribe link.";
  const text = `${body.trim()}\n\n${footer}`;
  const htmlBody = body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
  const headers = unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    : undefined;

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
    personalizations: [
      {
        to: [{ email: toEmail, name: toName || undefined }],
        ...(customArgs ? { custom_args: customArgs } : {})
      }
    ],
    subject,
    ...(headers ? { headers } : {}),
    content: [
      {
        type: "text/plain",
        value: text
      },
      {
        type: "text/html",
        value: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:640px;">${htmlBody}<hr style="border:none;border-top:1px solid #dfe4ec;margin:20px 0;" /><p style="color:#657083;font-size:12px;">${unsubscribeUrl ? `You are receiving this because you opted in to VIDSLOOM video trend notes. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#0891b2;">Unsubscribe</a>.` : escapeHtml(footer)}</p></div>`
      }
    ],
    tracking_settings: {
      click_tracking: {
        enable: true,
        enable_text: true
      },
      open_tracking: {
        enable: true
      },
      subscription_tracking: {
        enable: false
      }
    },
    categories: categories?.length ? categories.slice(0, 10) : ["vidsloom-newsletter"]
  });
}

export async function sendCustomerOnboardingConfirmation({
  customer,
  onboarding,
  portalUrl
}: {
  customer: BillingCustomer;
  onboarding: CustomerOnboarding;
  portalUrl: string;
}): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL is not configured." };
  }

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
    personalizations: [{ to: [{ email: customer.email, name: customer.contactName }] }],
    subject: "VIDSLOOM received your onboarding brief",
    content: [
      {
        type: "text/plain",
        value: customerOnboardingConfirmationText(customer, onboarding, portalUrl)
      },
      {
        type: "text/html",
        value: customerOnboardingConfirmationHtml(customer, onboarding, portalUrl)
      }
    ],
    categories: ["vidsloom-customer-onboarding", `plan-${customer.plan}`]
  });
}

export async function sendOwnerCustomerOnboardingNotification({
  customer,
  onboarding,
  portalUrl
}: {
  customer: BillingCustomer;
  onboarding: CustomerOnboarding;
  portalUrl: string;
}): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail || !config.salesEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL or VIDSLOOM_SALES_EMAIL is not configured." };
  }

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: customer.email, name: customer.contactName },
    personalizations: [{ to: [{ email: config.salesEmail, name: "VIDSLOOM Ops" }] }],
    subject: `Paid onboarding submitted: ${customer.businessName}`,
    content: [
      {
        type: "text/plain",
        value: ownerCustomerOnboardingText(customer, onboarding, portalUrl)
      },
      {
        type: "text/html",
        value: ownerCustomerOnboardingHtml(customer, onboarding, portalUrl)
      }
    ],
    categories: ["vidsloom-owner-onboarding", `plan-${customer.plan}`]
  });
}

export async function triggerCustomerOnboardingNotifications({
  customer,
  onboarding,
  portalUrl
}: {
  customer: BillingCustomer;
  onboarding: CustomerOnboarding;
  portalUrl: string;
}) {
  const [customerConfirmation, ownerNotification] = await Promise.all([
    sendCustomerOnboardingConfirmation({ customer, onboarding, portalUrl }),
    sendOwnerCustomerOnboardingNotification({ customer, onboarding, portalUrl })
  ]);

  return {
    configured: getSendGridStatus().configured,
    customerConfirmation,
    ownerNotification
  };
}

type PublishingNotificationEvent =
  | "queued"
  | "published"
  | "submitted"
  | "blocked"
  | "failed"
  | "proof-24h"
  | "proof-48h";

type PublishingNotificationInput = {
  event: PublishingNotificationEvent;
  customer: BillingCustomer;
  campaign: Campaign;
  row: CustomerCampaignReview["publishingReviews"][number];
  portalUrl: string;
  attempt?: PublishingAttempt;
  manualFallback?: PublishingAttempt | null;
  reason?: string;
};

export async function triggerPublishingNotifications(input: PublishingNotificationInput) {
  const [customerNotification, ownerNotification] = await Promise.all([
    sendCustomerPublishingNotification(input),
    sendOwnerPublishingNotification(input)
  ]);

  return {
    configured: getSendGridStatus().configured,
    customerNotification,
    ownerNotification
  };
}

export async function triggerLeadFollowup(lead: Lead) {
  const [ownerNotification, autoresponder, marketingContact] = await Promise.all([
    sendOwnerLeadNotification(lead),
    sendLeadAutoresponder(lead),
    addLeadToMarketingList(lead)
  ]);

  return {
    configured: getSendGridStatus().configured,
    ownerNotification,
    autoresponder,
    marketingContact
  };
}

async function sendCustomerPublishingNotification(input: PublishingNotificationInput): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL is not configured." };
  }

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: config.replyToEmail || config.fromEmail, name: config.fromName },
    personalizations: [{ to: [{ email: input.customer.email, name: input.customer.contactName }] }],
    subject: customerPublishingSubject(input),
    content: [
      {
        type: "text/plain",
        value: customerPublishingText(input)
      },
      {
        type: "text/html",
        value: customerPublishingHtml(input)
      }
    ],
    categories: ["vidsloom-publishing", `publishing-${input.event}`]
  });
}

async function sendOwnerPublishingNotification(input: PublishingNotificationInput): Promise<SendGridResult> {
  const config = getConfig();
  if (!config.fromEmail || !config.salesEmail) {
    return { ok: true, skipped: true, reason: "SENDGRID_FROM_EMAIL or VIDSLOOM_SALES_EMAIL is not configured." };
  }

  return sendMail({
    from: { email: config.fromEmail, name: config.fromName },
    reply_to: { email: input.customer.email, name: input.customer.contactName },
    personalizations: [{ to: [{ email: config.salesEmail, name: "VIDSLOOM Ops" }] }],
    subject: ownerPublishingSubject(input),
    content: [
      {
        type: "text/plain",
        value: ownerPublishingText(input)
      },
      {
        type: "text/html",
        value: ownerPublishingHtml(input)
      }
    ],
    categories: ["vidsloom-publishing-owner", `publishing-${input.event}`]
  });
}

function customerOnboardingConfirmationText(customer: BillingCustomer, onboarding: CustomerOnboarding, portalUrl: string) {
  return `Hi ${customer.contactName},

We received the onboarding brief for ${customer.businessName}.

VIDSLOOM will use this to prepare your first approval-ready video campaign pack:
- Offer and audience: captured
- Proof points and asset links: ${onboarding.proofPoints || onboarding.assetLinks ? "captured" : "not supplied yet"}
- Platforms: ${onboarding.platforms.join(", ")}
- Approval contact: ${onboarding.approvalContact}

You can return to your customer portal here:
${portalUrl}

Direct auto-posting only starts after you connect each social account and approve the required platform permissions. Until then, VIDSLOOM keeps your queue approval-first.

VIDSLOOM`;
}

function customerOnboardingConfirmationHtml(customer: BillingCustomer, onboarding: CustomerOnboarding, portalUrl: string) {
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:640px;">
  <p>Hi ${escapeHtml(customer.contactName)},</p>
  <p>We received the onboarding brief for <strong>${escapeHtml(customer.businessName)}</strong>.</p>
  <div style="background:#f7fbfc;border:1px solid #cdeff5;border-radius:10px;padding:14px;margin:18px 0;">
    <p style="margin:0 0 8px;"><strong>VIDSLOOM will use this to prepare your first approval-ready video campaign pack:</strong></p>
    <ul style="margin:0;padding-left:20px;">
      <li>Platforms: ${escapeHtml(onboarding.platforms.join(", "))}</li>
      <li>Approval contact: ${escapeHtml(onboarding.approvalContact)}</li>
      <li>Posting timezone: ${escapeHtml(onboarding.postingTimezone)}</li>
    </ul>
  </div>
  <p><a href="${escapeHtml(portalUrl)}" style="background:#172033;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;font-weight:700;">Open customer portal</a></p>
  <p style="color:#657083;font-size:13px;">Direct auto-posting only starts after you connect each social account and approve the required platform permissions. Until then, VIDSLOOM keeps your queue approval-first.</p>
  <p>VIDSLOOM</p>
</div>`;
}

function customerPublishingSubject(input: PublishingNotificationInput) {
  if (input.event === "queued") return `VIDSLOOM queued your ${input.row.platform} post`;
  if (input.event === "published") return `VIDSLOOM published your ${input.row.platform} post`;
  if (input.event === "submitted") return `VIDSLOOM submitted your ${input.row.platform} post`;
  if (input.event === "proof-24h") return `How is your ${input.row.platform} post performing?`;
  if (input.event === "proof-48h") return `VIDSLOOM proof check: add results for your ${input.row.platform} post`;
  return `VIDSLOOM is handling a ${input.row.platform} posting issue`;
}

function ownerPublishingSubject(input: PublishingNotificationInput) {
  const prefix =
    input.event === "published" || input.event === "submitted" || input.event === "queued"
      ? "Publishing"
      : input.event === "proof-24h" || input.event === "proof-48h"
        ? "Proof follow-up"
        : "Posting issue";
  return `${prefix}: ${input.customer.businessName} - ${input.row.platform}`;
}

function customerPublishingText(input: PublishingNotificationInput) {
  const lines = [
    `Hi ${input.customer.contactName},`,
    "",
    customerPublishingLead(input),
    "",
    `Business: ${input.customer.businessName}`,
    `Campaign: ${input.campaign.pack.positioning}`,
    `Video: ${input.row.conceptTitle}`,
    `Platform: ${input.row.platform}`,
    input.row.scheduledFor ? `Scheduled time: ${formatEmailDate(input.row.scheduledFor)}` : "",
    input.attempt?.externalUrl ? `Live post: ${input.attempt.externalUrl}` : "",
    input.attempt?.assetUrl ? `Approved MP4: ${input.attempt.assetUrl}` : "",
    input.reason ? `Note: ${input.reason}` : "",
    input.manualFallback ? "Recovery: VIDSLOOM prepared a manual posting kit so the team can post by hand if needed." : "",
    "",
    `Open your VIDSLOOM portal: ${input.portalUrl}`,
    "",
    "VIDSLOOM"
  ];

  return lines.filter(Boolean).join("\n");
}

function customerPublishingHtml(input: PublishingNotificationInput) {
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:640px;">
  <p>Hi ${escapeHtml(input.customer.contactName)},</p>
  <p>${escapeHtml(customerPublishingLead(input))}</p>
  <div style="background:#f7fbfc;border:1px solid #cdeff5;border-radius:10px;padding:14px;margin:18px 0;">
    <p style="margin:0 0 8px;"><strong>${escapeHtml(input.row.platform)} publishing details</strong></p>
    <ul style="margin:0;padding-left:20px;">
      <li>Campaign: ${escapeHtml(input.campaign.pack.positioning)}</li>
      <li>Video: ${escapeHtml(input.row.conceptTitle)}</li>
      ${input.row.scheduledFor ? `<li>Scheduled time: ${escapeHtml(formatEmailDate(input.row.scheduledFor))}</li>` : ""}
      ${input.reason ? `<li>Note: ${escapeHtml(input.reason)}</li>` : ""}
      ${input.manualFallback ? "<li>Recovery: VIDSLOOM prepared a manual posting kit so the team can post by hand if needed.</li>" : ""}
    </ul>
  </div>
  <p>
    ${input.attempt?.externalUrl ? `<a href="${escapeHtml(input.attempt.externalUrl)}" style="background:#0891b2;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">Open live post</a>` : ""}
    ${input.portalUrl ? `<a href="${escapeHtml(input.portalUrl)}" style="background:#172033;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">Open VIDSLOOM portal</a>` : ""}
  </p>
  <p>VIDSLOOM</p>
</div>`;
}

function ownerPublishingText(input: PublishingNotificationInput) {
  return [
    `${input.event.toUpperCase()}: ${input.customer.businessName}`,
    `Customer: ${input.customer.contactName} <${input.customer.email}>`,
    `Phone: ${input.customer.phone || "Not supplied"}`,
    `Plan: ${input.customer.plan}`,
    `Campaign: ${input.campaign.id}`,
    `Platform: ${input.row.platform}`,
    `Video: ${input.row.conceptTitle}`,
    `Task key: ${input.row.taskKey}`,
    `Scheduled: ${input.row.scheduledFor || "Not set"}`,
    `Attempt status: ${input.attempt?.status || "n/a"}`,
    `External URL: ${input.attempt?.externalUrl || "n/a"}`,
    `Error: ${input.attempt?.error || input.reason || "n/a"}`,
    `Manual fallback: ${input.manualFallback ? input.manualFallback.status : "n/a"}`,
    `Portal: ${input.portalUrl}`
  ].join("\n");
}

function ownerPublishingHtml(input: PublishingNotificationInput) {
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:720px;">
  <p style="color:#0891b2;font-size:12px;font-weight:800;text-transform:uppercase;margin:0 0 8px;">VIDSLOOM publishing ${escapeHtml(input.event)}</p>
  <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px;">${escapeHtml(input.customer.businessName)} - ${escapeHtml(input.row.platform)}</h1>
  <p style="margin:0 0 14px;"><strong>Attempt:</strong> ${escapeHtml(input.attempt?.status || "n/a")} | <strong>Fallback:</strong> ${escapeHtml(input.manualFallback?.status || "n/a")}</p>
  <p>
    ${input.attempt?.externalUrl ? `<a href="${escapeHtml(input.attempt.externalUrl)}" style="background:#0891b2;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">Open live post</a>` : ""}
    <a href="${escapeHtml(input.portalUrl)}" style="background:#172033;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;margin:0 8px 8px 0;font-weight:700;">Open portal</a>
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Customer</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(input.customer.contactName)} &lt;${escapeHtml(input.customer.email)}&gt;</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Video</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(input.row.conceptTitle)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Task key</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(input.row.taskKey)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Scheduled</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(input.row.scheduledFor || "Not set")}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Error</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(input.attempt?.error || input.reason || "n/a")}</td></tr>
  </table>
</div>`;
}

function customerPublishingLead(input: PublishingNotificationInput) {
  if (input.event === "proof-24h") {
    return `Your ${input.row.platform} post has had time to collect early signals. Please add views, enquiries, screenshots, or business results in the portal.`;
  }
  if (input.event === "proof-48h") {
    return `VIDSLOOM is collecting the 48-hour proof snapshot for your ${input.row.platform} post so the next campaign can improve.`;
  }
  if (input.event === "queued") {
    return `VIDSLOOM queued your approved ${input.row.platform} post for hands-off publishing.`;
  }
  if (input.event === "published") {
    return `VIDSLOOM published your approved ${input.row.platform} post.`;
  }
  if (input.event === "submitted") {
    return `VIDSLOOM submitted your approved ${input.row.platform} post to the platform.`;
  }
  return `VIDSLOOM caught a ${input.row.platform} posting issue and is handling the recovery path.`;
}

function formatEmailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-SG", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Singapore",
    timeZoneName: "short"
  });
}

function ownerCustomerOnboardingText(customer: BillingCustomer, onboarding: CustomerOnboarding, portalUrl: string) {
  return [
    `Paid onboarding submitted: ${customer.businessName}`,
    `Customer: ${customer.contactName} <${customer.email}>`,
    `Plan: ${customer.plan}`,
    `Billing status: ${customer.status}`,
    `Portal: ${portalUrl}`,
    `Website/social: ${onboarding.websiteSocial}`,
    `Industry: ${onboarding.industry}`,
    `Platforms: ${onboarding.platforms.join(", ")}`,
    `Offer: ${onboarding.offer}`,
    `Audience: ${onboarding.targetAudience}`,
    `Goal: ${onboarding.primaryGoal}`,
    `Proof: ${onboarding.proofPoints || "Not supplied"}`,
    `Assets: ${onboarding.assetLinks || "Not supplied"}`,
    `Approval contact: ${onboarding.approvalContact}`,
    `OAuth acknowledged: ${onboarding.understandsOauth ? "yes" : "no"}`
  ].join("\n");
}

function ownerCustomerOnboardingHtml(customer: BillingCustomer, onboarding: CustomerOnboarding, portalUrl: string) {
  return `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.5;max-width:720px;">
  <p style="color:#0891b2;font-size:12px;font-weight:800;text-transform:uppercase;margin:0 0 8px;">Paid onboarding submitted</p>
  <h1 style="font-size:24px;line-height:1.15;margin:0 0 10px;">${escapeHtml(customer.businessName)} is ready for production setup</h1>
  <p style="margin:0 0 14px;"><strong>Plan:</strong> ${escapeHtml(customer.plan)} | <strong>Billing:</strong> ${escapeHtml(customer.status)}</p>
  <p><a href="${escapeHtml(portalUrl)}" style="background:#172033;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 12px;display:inline-block;font-weight:700;">Open customer portal</a></p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Customer</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(customer.contactName)} &lt;${escapeHtml(customer.email)}&gt;</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Website/social</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(onboarding.websiteSocial)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Industry</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(onboarding.industry)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Platforms</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(onboarding.platforms.join(", "))}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Goal</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(onboarding.primaryGoal)}</td></tr>
    <tr><td style="border:1px solid #dfe4ec;padding:8px;font-weight:700;">Approval</td><td style="border:1px solid #dfe4ec;padding:8px;">${escapeHtml(onboarding.approvalContact)} via ${escapeHtml(onboarding.approvalChannels.join(", "))}</td></tr>
  </table>
  <h2 style="font-size:16px;margin:18px 0 8px;">Offer</h2>
  <p style="background:#f7fbfc;border-left:4px solid #0891b2;padding:10px 12px;">${escapeHtml(onboarding.offer)}</p>
  <h2 style="font-size:16px;margin:18px 0 8px;">Audience</h2>
  <p style="background:#fff8fb;border-left:4px solid #db2777;padding:10px 12px;">${escapeHtml(onboarding.targetAudience)}</p>
</div>`;
}
