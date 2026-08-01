const DEFAULT_OWNER_MESSAGE =
  "Hi, I requested a VIDSLOOM video growth audit. I want to move quickly and share my links/assets.";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function normalizePhoneForLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string, message = DEFAULT_OWNER_MESSAGE) {
  const digits = normalizePhoneForLink(phone);
  if (!digits) {
    return "";
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsUrl(phone: string, message = DEFAULT_OWNER_MESSAGE) {
  const digits = normalizePhoneForLink(phone);
  if (!digits) {
    return "";
  }

  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}

export function buildMailtoUrl(email: string, subject: string, body: string) {
  if (!email.trim()) {
    return "";
  }

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getPublicContactActions() {
  const salesEmail = env("VIDSLOOM_SALES_EMAIL") || env("SENDGRID_NOTIFY_EMAIL") || env("SENDGRID_FROM_EMAIL");
  const whatsappNumber = env("VIDSLOOM_WHATSAPP_NUMBER") || env("NEXT_PUBLIC_VIDSLOOM_WHATSAPP_NUMBER");
  const smsNumber = env("VIDSLOOM_SMS_NUMBER") || env("NEXT_PUBLIC_VIDSLOOM_SMS_NUMBER") || whatsappNumber;
  const message = env("VIDSLOOM_CONTACT_PREFILL") || DEFAULT_OWNER_MESSAGE;

  return {
    salesEmail,
    whatsappUrl: buildWhatsAppUrl(whatsappNumber, message),
    smsUrl: buildSmsUrl(smsNumber, message),
    mailtoUrl: buildMailtoUrl(
      salesEmail,
      "VIDSLOOM video growth audit",
      "Hi VIDSLOOM,\n\nI want a video growth audit for my business.\n\nBusiness:\nWebsite/social:\nGoal:\nBest contact method:\n"
    )
  };
}

export function buildOwnerFollowupLinks(lead: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  goal: string;
}) {
  const body = `Hi ${lead.contactName}, this is VIDSLOOM. I saw your audit request for ${lead.businessName}. Fastest next step: send 2-3 links to your current best posts or social profiles so we can prepare the first video angles.`;
  const subject = `VIDSLOOM audit for ${lead.businessName}`;

  return {
    email: buildMailtoUrl(lead.email, subject, body),
    whatsapp: buildWhatsAppUrl(lead.phone ?? "", body),
    sms: buildSmsUrl(lead.phone ?? "", body)
  };
}
