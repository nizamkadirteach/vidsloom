import "server-only";

import { Firestore, Query } from "@google-cloud/firestore";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

import { createId } from "@/lib/id";
import {
  AgentRun,
  AgentRunSchema,
  BillingCustomer,
  BillingCustomerSchema,
  Campaign,
  CampaignSchema,
  CustomerAsset,
  CustomerAssetSchema,
  CustomerCampaignReview,
  CustomerCampaignReviewSchema,
  CustomerOnboarding,
  CustomerOnboardingSchema,
  Lead,
  LeadSchema,
  NewsletterBroadcast,
  NewsletterBroadcastSchema,
  NewsletterEmailEvent,
  NewsletterEmailEventSchema,
  NewsletterEnrollment,
  NewsletterEnrollmentSchema,
  NewsletterSubscriber,
  NewsletterSubscriberSchema,
  OpsAlertSuppression,
  OpsAlertSuppressionSchema,
  PublishingAttempt,
  PublishingAttemptSchema,
  SocialConnection,
  SocialConnectionSchema,
  StripeEvent,
  StripeEventSchema
} from "@/lib/schemas";

const DATA_DIR = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.VIDSLOOM_DATA_DIR ?? process.env.VIDLOOM_DATA_DIR ?? ".vidsloom-data"
);
const CAMPAIGN_FILE = path.join(DATA_DIR, "campaigns.json");
const AGENT_LOG_FILE = path.join(DATA_DIR, "agent-runs.ndjson");
const LEAD_FILE = path.join(DATA_DIR, "leads.json");
const NEWSLETTER_FILE = path.join(DATA_DIR, "newsletter-subscribers.json");
const NEWSLETTER_BROADCAST_FILE = path.join(DATA_DIR, "newsletter-broadcasts.json");
const NEWSLETTER_EMAIL_EVENT_FILE = path.join(DATA_DIR, "newsletter-email-events.json");
const NEWSLETTER_ENROLLMENT_FILE = path.join(DATA_DIR, "newsletter-enrollments.json");
const BILLING_CUSTOMER_FILE = path.join(DATA_DIR, "billing-customers.json");
const STRIPE_EVENT_FILE = path.join(DATA_DIR, "stripe-events.json");
const CUSTOMER_ASSET_FILE = path.join(DATA_DIR, "customer-assets.json");
const CUSTOMER_ONBOARDING_FILE = path.join(DATA_DIR, "customer-onboarding.json");
const CUSTOMER_CAMPAIGN_REVIEW_FILE = path.join(DATA_DIR, "customer-campaign-reviews.json");
const SOCIAL_CONNECTION_FILE = path.join(DATA_DIR, "social-connections.json");
const PUBLISHING_ATTEMPT_FILE = path.join(DATA_DIR, "publishing-attempts.json");
const OPS_ALERT_SUPPRESSION_FILE = path.join(DATA_DIR, "ops-alert-suppressions.json");

function storageMode() {
  return process.env.VIDSLOOM_STORAGE ?? process.env.VIDLOOM_STORAGE ?? "local";
}

function shouldUseFirestore() {
  return storageMode() === "firestore";
}

function environmentName() {
  return (process.env.VIDSLOOM_ENV ?? process.env.VIDLOOM_ENV ?? "local").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

let firestoreClient: Firestore | null = null;

function firestore() {
  firestoreClient ??= new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT,
    ignoreUndefinedProperties: true
  });
  return firestoreClient;
}

function campaignCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_campaigns`);
}

function agentRunCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_agent_runs`);
}

function leadCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_leads`);
}

function newsletterCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_newsletter_subscribers`);
}

function newsletterBroadcastCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_newsletter_broadcasts`);
}

function newsletterEmailEventCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_newsletter_email_events`);
}

function newsletterEnrollmentCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_newsletter_enrollments`);
}

function billingCustomerCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_billing_customers`);
}

function stripeEventCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_stripe_events`);
}

function customerAssetCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_customer_assets`);
}

function customerOnboardingCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_customer_onboarding`);
}

function customerCampaignReviewCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_customer_campaign_reviews`);
}

function socialConnectionCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_social_connections`);
}

function publishingAttemptCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_publishing_attempts`);
}

function opsAlertSuppressionCollection() {
  return firestore().collection(`vidsloom_${environmentName()}_ops_alert_suppressions`);
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readCampaignsUnsafe(): Promise<Campaign[]> {
  try {
    const raw = await readFile(CAMPAIGN_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return CampaignSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readLeadsUnsafe(): Promise<Lead[]> {
  try {
    const raw = await readFile(LEAD_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return LeadSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readNewsletterSubscribersUnsafe(): Promise<NewsletterSubscriber[]> {
  try {
    const raw = await readFile(NEWSLETTER_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return NewsletterSubscriberSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readNewsletterBroadcastsUnsafe(): Promise<NewsletterBroadcast[]> {
  try {
    const raw = await readFile(NEWSLETTER_BROADCAST_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return NewsletterBroadcastSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readNewsletterEmailEventsUnsafe(): Promise<NewsletterEmailEvent[]> {
  try {
    const raw = await readFile(NEWSLETTER_EMAIL_EVENT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return NewsletterEmailEventSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readNewsletterEnrollmentsUnsafe(): Promise<NewsletterEnrollment[]> {
  try {
    const raw = await readFile(NEWSLETTER_ENROLLMENT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return NewsletterEnrollmentSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readBillingCustomersUnsafe(): Promise<BillingCustomer[]> {
  try {
    const raw = await readFile(BILLING_CUSTOMER_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return BillingCustomerSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readStripeEventsUnsafe(): Promise<StripeEvent[]> {
  try {
    const raw = await readFile(STRIPE_EVENT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return StripeEventSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readCustomerAssetsUnsafe(): Promise<CustomerAsset[]> {
  try {
    const raw = await readFile(CUSTOMER_ASSET_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return CustomerAssetSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readCustomerOnboardingUnsafe(): Promise<CustomerOnboarding[]> {
  try {
    const raw = await readFile(CUSTOMER_ONBOARDING_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return CustomerOnboardingSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readCustomerCampaignReviewsUnsafe(): Promise<CustomerCampaignReview[]> {
  try {
    const raw = await readFile(CUSTOMER_CAMPAIGN_REVIEW_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return CustomerCampaignReviewSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readSocialConnectionsUnsafe(): Promise<SocialConnection[]> {
  try {
    const raw = await readFile(SOCIAL_CONNECTION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return SocialConnectionSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readPublishingAttemptsUnsafe(): Promise<PublishingAttempt[]> {
  try {
    const raw = await readFile(PUBLISHING_ATTEMPT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return PublishingAttemptSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readOpsAlertSuppressionsUnsafe(): Promise<OpsAlertSuppression[]> {
  try {
    const raw = await readFile(OPS_ALERT_SUPPRESSION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return OpsAlertSuppressionSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function listCampaigns() {
  if (shouldUseFirestore()) {
    const snapshot = await campaignCollection().orderBy("createdAt", "desc").limit(100).get();
    return snapshot.docs.map((doc) => parseStoredCampaign(doc.data()));
  }

  await ensureDataDir();
  const campaigns = await readCampaignsUnsafe();
  return campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCampaign(id: string) {
  if (shouldUseFirestore()) {
    const doc = await campaignCollection().doc(id).get();
    return doc.exists ? parseStoredCampaign(doc.data()) : null;
  }

  const campaigns = await listCampaigns();
  return campaigns.find((campaign) => campaign.id === id) ?? null;
}

export async function saveCampaign(campaign: Campaign) {
  const parsed = parseStoredCampaign(campaign);

  if (shouldUseFirestore()) {
    const db = firestore();
    const batch = db.batch();
    batch.set(db.collection(`vidsloom_${environmentName()}_campaigns`).doc(parsed.id), parsed);
    for (const run of parsed.agentRuns) {
      batch.set(db.collection(`vidsloom_${environmentName()}_agent_runs`).doc(run.id), run);
    }
    await batch.commit();
    return;
  }

  await ensureDataDir();
  const campaigns = await readCampaignsUnsafe();
  const next = [parsed, ...campaigns.filter((item) => item.id !== parsed.id)];
  await writeFile(CAMPAIGN_FILE, JSON.stringify(next, null, 2), "utf8");
  await Promise.all(parsed.agentRuns.map((run) => appendAgentRun(run)));
}

function parseStoredCampaign(input: unknown) {
  const value = input && typeof input === "object" ? (input as Campaign) : input;
  const intake = value && typeof value === "object" && "intake" in value ? (value as Campaign).intake : null;
  const normalized =
    intake && typeof intake === "object"
      ? {
          ...(value as Campaign),
          intake: {
            ...intake,
            businessName: truncateText(intake.businessName, 80),
            website: truncateText(intake.website, 160),
            industry: truncateText(intake.industry, 80),
            offer: truncateText(intake.offer, 900),
            audience: truncateText(intake.audience, 900),
            goal: truncateText(intake.goal, 400),
            brandVoice: truncateText(intake.brandVoice, 300),
            constraints: truncateText(intake.constraints, 900),
            proofPoints: truncateText(intake.proofPoints, 900),
            assets: truncateText(intake.assets, 900)
          }
        }
      : value;

  return CampaignSchema.parse(normalized);
}

function truncateText(value: unknown, max: number) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export async function appendAgentRun(run: AgentRun) {
  if (shouldUseFirestore()) {
    await agentRunCollection().doc(run.id).set(run);
    return;
  }

  await ensureDataDir();
  await appendFile(AGENT_LOG_FILE, `${JSON.stringify(run)}\n`, "utf8");
}

export async function listAgentRuns(limit = 100) {
  if (shouldUseFirestore()) {
    const snapshot = await agentRunCollection().orderBy("completedAt", "desc").limit(limit).get();
    return snapshot.docs.map((doc) => AgentRunSchema.parse(doc.data()));
  }

  await ensureDataDir();
  try {
    const raw = await readFile(AGENT_LOG_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AgentRun)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function saveLead(lead: Lead) {
  const parsed = LeadSchema.parse(lead);

  if (shouldUseFirestore()) {
    await leadCollection().doc(parsed.id).set(parsed);
    return;
  }

  await ensureDataDir();
  const leads = await readLeadsUnsafe();
  const next = [parsed, ...leads.filter((item) => item.id !== parsed.id)];
  await writeFile(LEAD_FILE, JSON.stringify(next, null, 2), "utf8");
}

export async function listLeads(limit = 100) {
  if (shouldUseFirestore()) {
    const snapshot = await leadCollection().orderBy("createdAt", "desc").limit(limit).get();
    return snapshot.docs.map((doc) => LeadSchema.parse(doc.data()));
  }

  await ensureDataDir();
  const leads = await readLeadsUnsafe();
  return leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getLead(id: string) {
  if (shouldUseFirestore()) {
    const doc = await leadCollection().doc(id).get();
    return doc.exists ? LeadSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const leads = await readLeadsUnsafe();
  return leads.find((lead) => lead.id === id) ?? null;
}

export async function listNewsletterOptIns(limit = 500) {
  return listNewsletterSubscribers({ status: "active", limit });
}

export async function saveNewsletterSubscriber(subscriber: NewsletterSubscriber) {
  const parsed = NewsletterSubscriberSchema.parse(subscriber);

  if (shouldUseFirestore()) {
    await newsletterCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const subscribers = await readNewsletterSubscribersUnsafe();
  const next = [parsed, ...subscribers.filter((item) => item.id !== parsed.id)];
  await writeFile(NEWSLETTER_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function getNewsletterSubscriberByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (shouldUseFirestore()) {
    const snapshot = await newsletterCollection().where("email", "==", normalizedEmail).limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? NewsletterSubscriberSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const subscribers = await readNewsletterSubscribersUnsafe();
  return subscribers.find((subscriber) => subscriber.email.toLowerCase() === normalizedEmail) ?? null;
}

export async function getNewsletterSubscriberById(id: string) {
  if (shouldUseFirestore()) {
    const doc = await newsletterCollection().doc(id).get();
    return doc.exists ? NewsletterSubscriberSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const subscribers = await readNewsletterSubscribersUnsafe();
  return subscribers.find((subscriber) => subscriber.id === id) ?? null;
}

export async function getNewsletterSubscriberByToken(token: string) {
  if (shouldUseFirestore()) {
    const snapshot = await newsletterCollection().where("unsubscribeToken", "==", token).limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? NewsletterSubscriberSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const subscribers = await readNewsletterSubscribersUnsafe();
  return subscribers.find((subscriber) => subscriber.unsubscribeToken === token) ?? null;
}

export async function listNewsletterSubscribers({
  status = "active",
  limit = 500
}: {
  status?: NewsletterSubscriber["status"] | "all";
  limit?: number;
} = {}) {
  if (shouldUseFirestore()) {
    const collection = newsletterCollection();
    const snapshot =
      status === "all"
        ? await collection.limit(limit).get()
        : await collection.where("status", "==", status).limit(limit).get();
    return snapshot.docs
      .map((doc) => NewsletterSubscriberSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  await ensureDataDir();
  const subscribers = await readNewsletterSubscribersUnsafe();
  return subscribers
    .filter((subscriber) => status === "all" || subscriber.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function upsertNewsletterSubscriber(input: {
  email: string;
  name?: string;
  businessName?: string;
  source: NewsletterSubscriber["source"];
  tags?: string[];
  consentText: string;
}) {
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();
  const existing = await getNewsletterSubscriberByEmail(email);
  const tags = Array.from(new Set([...(existing?.tags ?? []), ...(input.tags ?? ["VIDSLOOM"])])).slice(0, 20);
  const subscriber = NewsletterSubscriberSchema.parse({
    id: existing?.id ?? createId("sub"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    email,
    name: input.name ?? existing?.name ?? "",
    businessName: input.businessName ?? existing?.businessName ?? "",
    status: "active",
    source: input.source,
    tags,
    consentText: input.consentText,
    consentAt: existing?.consentAt ?? now,
    unsubscribeToken: existing?.unsubscribeToken ?? createId("unsub")
  });

  return saveNewsletterSubscriber(subscriber);
}

export async function unsubscribeNewsletterSubscriberByToken(token: string) {
  const existing = await getNewsletterSubscriberByToken(token);
  if (!existing) return null;

  const unsubscribed = await saveNewsletterSubscriber({
    ...existing,
    status: "unsubscribed",
    updatedAt: new Date().toISOString(),
    unsubscribedAt: new Date().toISOString()
  });

  await cancelNewsletterEnrollmentsForEmail(existing.email);
  return unsubscribed;
}

export async function saveNewsletterBroadcast(broadcast: NewsletterBroadcast) {
  const parsed = NewsletterBroadcastSchema.parse(broadcast);

  if (shouldUseFirestore()) {
    await newsletterBroadcastCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const broadcasts = await readNewsletterBroadcastsUnsafe();
  const next = [parsed, ...broadcasts.filter((item) => item.id !== parsed.id)];
  await writeFile(NEWSLETTER_BROADCAST_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listNewsletterBroadcasts(limit = 50) {
  if (shouldUseFirestore()) {
    const snapshot = await newsletterBroadcastCollection().limit(Math.min(limit, 500)).get();
    return snapshot.docs
      .map((doc) => NewsletterBroadcastSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const broadcasts = await readNewsletterBroadcastsUnsafe();
  return broadcasts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export async function saveNewsletterEmailEvent(event: NewsletterEmailEvent) {
  const parsed = NewsletterEmailEventSchema.parse(event);

  if (shouldUseFirestore()) {
    await newsletterEmailEventCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const events = await readNewsletterEmailEventsUnsafe();
  const next = [parsed, ...events.filter((item) => item.id !== parsed.id)].slice(0, 5000);
  await writeFile(NEWSLETTER_EMAIL_EVENT_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listNewsletterEmailEvents(limit = 50) {
  if (shouldUseFirestore()) {
    const snapshot = await newsletterEmailEventCollection().limit(Math.min(limit, 500)).get();
    return snapshot.docs
      .map((doc) => NewsletterEmailEventSchema.parse(doc.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const events = await readNewsletterEmailEventsUnsafe();
  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function saveNewsletterEnrollment(enrollment: NewsletterEnrollment) {
  const parsed = NewsletterEnrollmentSchema.parse(enrollment);

  if (shouldUseFirestore()) {
    await newsletterEnrollmentCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const enrollments = await readNewsletterEnrollmentsUnsafe();
  const next = [parsed, ...enrollments.filter((item) => item.id !== parsed.id)];
  await writeFile(NEWSLETTER_ENROLLMENT_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listNewsletterEnrollments({
  status = "all",
  limit = 500
}: {
  status?: NewsletterEnrollment["status"] | "all";
  limit?: number;
} = {}) {
  if (shouldUseFirestore()) {
    const snapshot = await newsletterEnrollmentCollection().limit(Math.min(limit, 2000)).get();
    return snapshot.docs
      .map((doc) => NewsletterEnrollmentSchema.parse(doc.data()))
      .filter((enrollment) => status === "all" || enrollment.status === status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const enrollments = await readNewsletterEnrollmentsUnsafe();
  return enrollments
    .filter((enrollment) => status === "all" || enrollment.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function getNewsletterEnrollmentByEmailAndSequence(email: string, sequenceId: string, leadId?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const enrollments = await listNewsletterEnrollments({ status: "all", limit: 2000 });
  return (
    enrollments.find(
      (enrollment) =>
        enrollment.email.toLowerCase() === normalizedEmail &&
        enrollment.sequenceId === sequenceId &&
        (leadId ? enrollment.leadId === leadId : !enrollment.leadId)
    ) ?? null
  );
}

export async function cancelNewsletterEnrollmentsForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const enrollments = await listNewsletterEnrollments({ status: "active", limit: 2000 });
  const now = new Date().toISOString();
  await Promise.all(
    enrollments
      .filter((enrollment) => enrollment.email.toLowerCase() === normalizedEmail)
      .map((enrollment) =>
        saveNewsletterEnrollment({
          ...enrollment,
          status: "cancelled",
          updatedAt: now
        })
      )
  );
}

export async function saveBillingCustomer(customer: BillingCustomer) {
  const parsed = BillingCustomerSchema.parse(customer);

  if (shouldUseFirestore()) {
    await billingCustomerCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const customers = await readBillingCustomersUnsafe();
  const next = [parsed, ...customers.filter((item) => item.id !== parsed.id)];
  await writeFile(BILLING_CUSTOMER_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listBillingCustomers(limit = 100) {
  if (shouldUseFirestore()) {
    const snapshot = await billingCustomerCollection().limit(Math.min(limit, 500)).get();
    return snapshot.docs
      .map((doc) => BillingCustomerSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const customers = await readBillingCustomersUnsafe();
  return customers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export async function getBillingCustomer(id: string) {
  if (shouldUseFirestore()) {
    const doc = await billingCustomerCollection().doc(id).get();
    return doc.exists ? BillingCustomerSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const customers = await readBillingCustomersUnsafe();
  return customers.find((customer) => customer.id === id) ?? null;
}

export async function getBillingCustomerByCheckoutSessionId(sessionId: string) {
  if (!sessionId) return null;

  if (shouldUseFirestore()) {
    const snapshot = await billingCustomerCollection().where("stripeCheckoutSessionId", "==", sessionId).limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? BillingCustomerSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const customers = await readBillingCustomersUnsafe();
  return customers.find((customer) => customer.stripeCheckoutSessionId === sessionId) ?? null;
}

export async function getBillingCustomerBySubscriptionId(subscriptionId: string) {
  if (!subscriptionId) return null;

  if (shouldUseFirestore()) {
    const snapshot = await billingCustomerCollection().where("stripeSubscriptionId", "==", subscriptionId).limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? BillingCustomerSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const customers = await readBillingCustomersUnsafe();
  return customers.find((customer) => customer.stripeSubscriptionId === subscriptionId) ?? null;
}

export async function saveStripeEvent(event: StripeEvent) {
  const parsed = StripeEventSchema.parse(event);

  if (shouldUseFirestore()) {
    await stripeEventCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const events = await readStripeEventsUnsafe();
  const next = [parsed, ...events.filter((item) => item.id !== parsed.id)].slice(0, 2000);
  await writeFile(STRIPE_EVENT_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function getStripeEvent(id: string) {
  if (shouldUseFirestore()) {
    const doc = await stripeEventCollection().doc(id).get();
    return doc.exists ? StripeEventSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const events = await readStripeEventsUnsafe();
  return events.find((event) => event.id === id) ?? null;
}

export async function saveCustomerAsset(asset: CustomerAsset) {
  const parsed = CustomerAssetSchema.parse(asset);

  if (shouldUseFirestore()) {
    await customerAssetCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const assets = await readCustomerAssetsUnsafe();
  const next = [parsed, ...assets.filter((item) => item.id !== parsed.id)].slice(0, 5000);
  await writeFile(CUSTOMER_ASSET_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function getCustomerAsset(id: string) {
  if (!id) return null;

  if (shouldUseFirestore()) {
    const doc = await customerAssetCollection().doc(id).get();
    return doc.exists ? CustomerAssetSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const assets = await readCustomerAssetsUnsafe();
  return assets.find((asset) => asset.id === id) ?? null;
}

export async function listCustomerAssetsForCustomer(customerId: string, limit = 200) {
  if (!customerId) return [];

  if (shouldUseFirestore()) {
    const snapshot = await customerAssetCollection()
      .where("customerId", "==", customerId)
      .limit(Math.min(limit, 500))
      .get();
    return snapshot.docs
      .map((doc) => CustomerAssetSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const assets = await readCustomerAssetsUnsafe();
  return assets
    .filter((asset) => asset.customerId === customerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function archiveCustomerAsset(id: string, customerId: string) {
  const existing = await getCustomerAsset(id);
  if (!existing || existing.customerId !== customerId) return null;
  return saveCustomerAsset({
    ...existing,
    status: "archived",
    updatedAt: new Date().toISOString()
  });
}

export async function saveCustomerOnboarding(onboarding: CustomerOnboarding) {
  const parsed = CustomerOnboardingSchema.parse(onboarding);

  if (shouldUseFirestore()) {
    await customerOnboardingCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const onboardings = await readCustomerOnboardingUnsafe();
  const next = [parsed, ...onboardings.filter((item) => item.id !== parsed.id)];
  await writeFile(CUSTOMER_ONBOARDING_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function getCustomerOnboardingByCustomerId(customerId: string) {
  if (!customerId) return null;

  if (shouldUseFirestore()) {
    const snapshot = await customerOnboardingCollection().where("customerId", "==", customerId).limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? CustomerOnboardingSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const onboardings = await readCustomerOnboardingUnsafe();
  return onboardings.find((onboarding) => onboarding.customerId === customerId) ?? null;
}

export async function saveCustomerCampaignReview(review: CustomerCampaignReview) {
  const parsed = CustomerCampaignReviewSchema.parse(review);

  if (shouldUseFirestore()) {
    await customerCampaignReviewCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const reviews = await readCustomerCampaignReviewsUnsafe();
  const next = [parsed, ...reviews.filter((item) => item.id !== parsed.id)];
  await writeFile(CUSTOMER_CAMPAIGN_REVIEW_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function getCustomerCampaignReview(customerId: string, campaignId: string) {
  if (!customerId || !campaignId) return null;

  if (shouldUseFirestore()) {
    const snapshot = await customerCampaignReviewCollection()
      .where("customerId", "==", customerId)
      .where("campaignId", "==", campaignId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? CustomerCampaignReviewSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const reviews = await readCustomerCampaignReviewsUnsafe();
  return reviews.find((review) => review.customerId === customerId && review.campaignId === campaignId) ?? null;
}

export async function listCustomerCampaignReviewsForCustomer(customerId: string, limit = 50) {
  if (!customerId) return [];

  if (shouldUseFirestore()) {
    const snapshot = await customerCampaignReviewCollection()
      .where("customerId", "==", customerId)
      .limit(Math.min(limit, 200))
      .get();
    return snapshot.docs
      .map((doc) => CustomerCampaignReviewSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const reviews = await readCustomerCampaignReviewsUnsafe();
  return reviews
    .filter((review) => review.customerId === customerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function listCustomerCampaignReviews(limit = 100) {
  if (shouldUseFirestore()) {
    const snapshot = await customerCampaignReviewCollection().limit(Math.min(limit, 500)).get();
    return snapshot.docs
      .map((doc) => CustomerCampaignReviewSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const reviews = await readCustomerCampaignReviewsUnsafe();
  return reviews.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export async function saveSocialConnection(connection: SocialConnection) {
  const parsed = SocialConnectionSchema.parse(connection);

  if (shouldUseFirestore()) {
    await socialConnectionCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const connections = await readSocialConnectionsUnsafe();
  const next = [parsed, ...connections.filter((item) => item.id !== parsed.id)];
  await writeFile(SOCIAL_CONNECTION_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listSocialConnections({
  customerId = "",
  platform
}: {
  customerId?: string;
  platform?: SocialConnection["platform"];
} = {}) {
  if (shouldUseFirestore()) {
    let query: Query = socialConnectionCollection();
    if (customerId) query = query.where("customerId", "==", customerId);
    if (platform) query = query.where("platform", "==", platform);
    const snapshot = await query.limit(200).get();
    return snapshot.docs
      .map((doc) => SocialConnectionSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  await ensureDataDir();
  const connections = await readSocialConnectionsUnsafe();
  return connections
    .filter(
      (connection) => (!customerId || connection.customerId === customerId) && (!platform || connection.platform === platform)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSocialConnection(id: string) {
  if (!id) return null;

  if (shouldUseFirestore()) {
    const doc = await socialConnectionCollection().doc(id).get();
    return doc.exists ? SocialConnectionSchema.parse(doc.data()) : null;
  }

  await ensureDataDir();
  const connections = await readSocialConnectionsUnsafe();
  return connections.find((connection) => connection.id === id) ?? null;
}

export async function findActiveSocialConnection({
  customerId = "",
  platform
}: {
  customerId?: string;
  platform: SocialConnection["platform"];
}) {
  const connections = await listSocialConnections({ customerId, platform });
  return (
    connections.find(
      (connection) =>
        connection.status === "connected" &&
        Boolean(connection.accessTokenEncrypted) &&
        (!connection.expiresAt || Date.parse(connection.expiresAt) > Date.now() + 60_000)
    ) ?? null
  );
}

export async function savePublishingAttempt(attempt: PublishingAttempt) {
  const parsed = PublishingAttemptSchema.parse(attempt);

  if (shouldUseFirestore()) {
    await publishingAttemptCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const attempts = await readPublishingAttemptsUnsafe();
  const next = [parsed, ...attempts.filter((item) => item.id !== parsed.id)].slice(0, 3000);
  await writeFile(PUBLISHING_ATTEMPT_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listPublishingAttempts({
  campaignId = "",
  customerId = "",
  limit = 100
}: {
  campaignId?: string;
  customerId?: string;
  limit?: number;
} = {}) {
  if (shouldUseFirestore()) {
    let query: Query = publishingAttemptCollection();
    if (campaignId) query = query.where("campaignId", "==", campaignId);
    if (customerId) query = query.where("customerId", "==", customerId);
    const snapshot = await query.limit(Math.min(limit, 500)).get();
    return snapshot.docs
      .map((doc) => PublishingAttemptSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const attempts = await readPublishingAttemptsUnsafe();
  return attempts
    .filter((attempt) => (!campaignId || attempt.campaignId === campaignId) && (!customerId || attempt.customerId === customerId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function saveOpsAlertSuppression(suppression: OpsAlertSuppression) {
  const parsed = OpsAlertSuppressionSchema.parse(suppression);

  if (shouldUseFirestore()) {
    await opsAlertSuppressionCollection().doc(parsed.id).set(parsed);
    return parsed;
  }

  await ensureDataDir();
  const suppressions = await readOpsAlertSuppressionsUnsafe();
  const next = [parsed, ...suppressions.filter((item) => item.id !== parsed.id)].slice(0, 3000);
  await writeFile(OPS_ALERT_SUPPRESSION_FILE, JSON.stringify(next, null, 2), "utf8");
  return parsed;
}

export async function listOpsAlertSuppressions({ limit = 1000 }: { limit?: number } = {}) {
  if (shouldUseFirestore()) {
    const snapshot = await opsAlertSuppressionCollection().limit(Math.min(limit, 3000)).get();
    return snapshot.docs
      .map((doc) => OpsAlertSuppressionSchema.parse(doc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  await ensureDataDir();
  const suppressions = await readOpsAlertSuppressionsUnsafe();
  return suppressions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
