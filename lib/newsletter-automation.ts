import "server-only";

import { createId } from "@/lib/id";
import { getNewsletterTestRecipient, sendNewsletterEmail } from "@/lib/sendgrid";
import type {
  Lead,
  NewsletterAudienceRule,
  NewsletterBroadcast,
  NewsletterEmailEvent,
  NewsletterEnrollment,
  NewsletterSegment,
  NewsletterSequence,
  NewsletterSubscriber
} from "@/lib/schemas";
import {
  getNewsletterEnrollmentByEmailAndSequence,
  getNewsletterSubscriberByEmail,
  listNewsletterBroadcasts,
  listNewsletterEmailEvents,
  listNewsletterEnrollments,
  listNewsletterSubscribers,
  saveNewsletterBroadcast,
  saveNewsletterEmailEvent,
  saveNewsletterEnrollment
} from "@/lib/storage";

type SendResult = Awaited<ReturnType<typeof sendNewsletterEmail>>;

const defaultAudience: NewsletterAudienceRule = {
  tags: [],
  sources: [],
  statuses: ["active"]
};

export function getNewsletterSequences(): NewsletterSequence[] {
  return [
    {
      id: "welcome-trend-notes",
      name: "Trend Notes Welcome",
      description: "New subscribers receive the promise, best first action, and pilot invitation.",
      trigger: "newsletter-subscribed",
      status: "active",
      audience: "marketing-opt-in",
      steps: [
        {
          id: "welcome",
          name: "Immediate welcome",
          delayHours: 0,
          subject: "You are on the VIDSLOOM trend notes list",
          body:
            "Hi {{name}},\n\nYou are on the VIDSLOOM trend notes list.\n\nWe will send practical short-form video ideas, trend translations, campaign examples, and ways to turn business proof into videos without asking you to film everything yourself.\n\nBest next step: reply with your website or social profile if you want us to spot the first video angles for {{businessName}}.",
          messageType: "marketing"
        },
        {
          id: "three-second-brief",
          name: "Three-second brief",
          delayHours: 24,
          subject: "The 3-second test for your next business video",
          body:
            "Most business videos lose buyers because the first three seconds do not say who the video is for or why it matters.\n\nThis week, test one of these hooks:\n\n1. \"If you are choosing {{businessName}} because of price, watch this first.\"\n2. \"Three mistakes people make before booking this service.\"\n3. \"What we check before recommending this product.\"\n\nVIDSLOOM turns this kind of angle into videos, captions, thumbnails, and posting windows.",
          messageType: "marketing"
        },
        {
          id: "pilot-invite",
          name: "Pilot invitation",
          delayHours: 72,
          subject: "Want VIDSLOOM to build the first video queue?",
          body:
            "If you want a faster start, VIDSLOOM can prepare the first approval-ready video queue for {{businessName}}.\n\nWe look at your offer, proof, audience, reviews, website, and available assets, then turn them into short-form video concepts, captions, thumbnails, and a posting schedule.\n\nReply with \"pilot\" if you want us to prepare the next step.",
          messageType: "marketing"
        }
      ]
    },
    {
      id: "audit-nurture",
      name: "Audit Request Nurture",
      description: "Opted-in audit leads receive useful follow-ups after the transactional audit confirmation.",
      trigger: "lead-created",
      status: "active",
      audience: "marketing-opt-in",
      steps: [
        {
          id: "audit-context",
          name: "Audit context",
          delayHours: 2,
          subject: "What VIDSLOOM checks before recommending video ideas",
          body:
            "For {{businessName}}, the fastest useful audit starts with proof, not random trends.\n\nWe look for the offer, buyer pain, trusted proof points, best current assets, and the simplest next action a viewer should take. Then we match those inputs to short-form video formats that can work organically and as paid creative.",
          messageType: "marketing"
        },
        {
          id: "first-video-batch",
          name: "First video batch",
          delayHours: 24,
          subject: "The first VIDSLOOM batch should usually be simple",
          body:
            "The first batch for {{businessName}} does not need to be expensive.\n\nA good starter queue usually contains:\n\n1. One problem-first video.\n2. One proof or before-after video.\n3. One offer explainer with a direct CTA.\n\nThat gives enough variation to learn what buyers respond to before spending more.",
          messageType: "marketing"
        },
        {
          id: "approval-system",
          name: "Approval system",
          delayHours: 72,
          subject: "How approval works before anything is posted",
          body:
            "VIDSLOOM can prepare videos, captions, thumbnails, and schedules without needing social account access first.\n\nDirect posting only happens after each customer connects the relevant social account and approves the required permissions. Before that, everything can stay in an approval queue for review, edits, or manual posting.",
          messageType: "marketing"
        }
      ]
    },
    {
      id: "pilot-fast-followup",
      name: "Pilot Fast Follow-Up",
      description: "Pilot leads get a faster sequence focused on assets, approval, and launch readiness.",
      trigger: "pilot-requested",
      status: "active",
      audience: "marketing-opt-in",
      steps: [
        {
          id: "pilot-assets",
          name: "Pilot asset request",
          delayHours: 1,
          subject: "What VIDSLOOM needs to start a pilot queue",
          body:
            "To start a useful VIDSLOOM pilot for {{businessName}}, the best inputs are simple:\n\n1. Website, menu, product page, or service page.\n2. Reviews, testimonials, before-after proof, or FAQs.\n3. Logo, photos, existing clips, or social profiles if available.\n\nYou do not need to produce videos from scratch before the pilot.",
          messageType: "marketing"
        },
        {
          id: "pilot-launch",
          name: "Pilot launch path",
          delayHours: 24,
          subject: "Your pilot should lead to a posting system",
          body:
            "The pilot goal is not just a few videos. It should prove a repeatable system: trend-aware ideas, generated video drafts, captions, thumbnails, posting windows, approvals, and follow-up-ready campaign assets.\n\nThat is the VIDSLOOM operating model.",
          messageType: "marketing"
        }
      ]
    }
  ];
}

export async function getNewsletterSegments(): Promise<NewsletterSegment[]> {
  const subscribers = await listNewsletterSubscribers({ status: "all", limit: 2000 });
  const segments: Omit<NewsletterSegment, "count">[] = [
    {
      id: "all-active",
      name: "All active subscribers",
      description: "Every currently subscribed contact.",
      rule: defaultAudience
    },
    {
      id: "audit-opt-ins",
      name: "Growth audit opt-ins",
      description: "Contacts who entered from an audit or lead form.",
      rule: {
        tags: [],
        sources: ["lead-form", "growth-audit"],
        statuses: ["active"]
      }
    },
    {
      id: "pilot-opt-ins",
      name: "Pilot opt-ins",
      description: "Higher-intent pilot page contacts.",
      rule: {
        tags: [],
        sources: ["pilot"],
        statuses: ["active"]
      }
    },
    {
      id: "trend-notes",
      name: "Trend notes page",
      description: "Visitors who joined from the standalone newsletter page.",
      rule: {
        tags: [],
        sources: ["newsletter-page"],
        statuses: ["active"]
      }
    },
    {
      id: "sample-app",
      name: "Workspace/sample users",
      description: "Contacts captured from sample app or workspace flows.",
      rule: {
        tags: [],
        sources: ["sample-app"],
        statuses: ["active"]
      }
    }
  ];

  return segments.map((segment) => ({
    ...segment,
    count: subscribers.filter((subscriber) => subscriberMatchesAudience(subscriber, segment.rule)).length
  }));
}

export async function getNewsletterOperationsSummary() {
  const [segments, sequences, broadcasts, events, enrollments] = await Promise.all([
    getNewsletterSegments(),
    Promise.resolve(getNewsletterSequences()),
    listNewsletterBroadcasts(8),
    listNewsletterEmailEvents(12),
    listNewsletterEnrollments({ status: "active", limit: 500 })
  ]);
  const now = new Date().toISOString();

  return {
    segments,
    sequences: sequences.map((sequence) => ({
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      trigger: sequence.trigger,
      status: sequence.status,
      steps: sequence.steps.map((step) => ({
        id: step.id,
        name: step.name,
        delayHours: step.delayHours,
        subject: step.subject,
        messageType: step.messageType
      }))
    })),
    broadcasts: broadcasts.map(publicBroadcast),
    events: events.map(publicEmailEvent),
    automation: {
      activeEnrollments: enrollments.length,
      dueNow: enrollments.filter((enrollment) => enrollment.nextSendAt <= now).length
    }
  };
}

export async function enrollSubscriberSequences({
  subscriber,
  trigger,
  lead
}: {
  subscriber: NewsletterSubscriber;
  trigger: NewsletterSequence["trigger"];
  lead?: Lead;
}) {
  const sequences = getNewsletterSequences().filter(
    (sequence) => sequence.status === "active" && sequence.trigger === trigger && sequence.audience === "marketing-opt-in"
  );
  const enrollments: NewsletterEnrollment[] = [];
  const now = new Date();

  for (const sequence of sequences) {
    const existing = await getNewsletterEnrollmentByEmailAndSequence(subscriber.email, sequence.id, lead?.id);
    if (existing && ["active", "completed"].includes(existing.status)) {
      enrollments.push(existing);
      continue;
    }

    const firstStep = sequence.steps[0];
    const nextSendAt = new Date(now.getTime() + firstStep.delayHours * 60 * 60 * 1000).toISOString();
    const enrollment = await saveNewsletterEnrollment({
      id: existing?.id ?? createId("enroll"),
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      email: subscriber.email,
      subscriberId: subscriber.id,
      leadId: lead?.id,
      sequenceId: sequence.id,
      status: "active",
      currentStepIndex: 0,
      nextSendAt,
      metadata: {
        source: subscriber.source,
        businessName: subscriber.businessName || lead?.businessName || "",
        trigger
      }
    });
    enrollments.push(enrollment);
  }

  return enrollments;
}

export async function runDueNewsletterAutomations({
  requestUrl,
  limit = 25
}: {
  requestUrl: string;
  limit?: number;
}) {
  const now = new Date();
  const due = (await listNewsletterEnrollments({ status: "active", limit: 1000 }))
    .filter((enrollment) => enrollment.nextSendAt <= now.toISOString())
    .slice(0, limit);
  const sequences = getNewsletterSequences();
  const results = [];

  for (const enrollment of due) {
    const sequence = sequences.find((item) => item.id === enrollment.sequenceId);
    const step = sequence?.steps[enrollment.currentStepIndex];
    if (!sequence || !step) {
      const completed = await saveNewsletterEnrollment({
        ...enrollment,
        status: "completed",
        updatedAt: now.toISOString(),
        completedAt: now.toISOString()
      });
      results.push({ enrollment: completed, sent: false, skipped: true });
      continue;
    }

    const subscriber = await getNewsletterSubscriberByEmail(enrollment.email);
    if (step.messageType === "marketing" && (!subscriber || subscriber.status !== "active")) {
      await saveNewsletterEmailEvent(
        buildEmailEvent({
          email: enrollment.email,
          subject: step.subject,
          messageType: "newsletter-sequence",
          status: "skipped",
          subscriber,
          enrollment,
          sequenceId: sequence.id,
          stepId: step.id,
          reason: "Subscriber is not active."
        })
      );
      const cancelled = await saveNewsletterEnrollment({
        ...enrollment,
        status: "cancelled",
        updatedAt: now.toISOString()
      });
      results.push({ enrollment: cancelled, sent: false, skipped: true });
      continue;
    }

    const context = subscriberContext(subscriber, enrollment);
    const unsubscribeUrl = subscriber
      ? new URL(`/api/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`, requestUrl).toString()
      : undefined;
    const result = await sendNewsletterEmail({
      toEmail: enrollment.email,
      toName: subscriber?.name,
      subject: renderTemplate(step.subject, context),
      body: renderTemplate(step.body, context),
      unsubscribeUrl: step.messageType === "marketing" ? unsubscribeUrl : undefined,
      categories: ["vidsloom-sequence", sequence.id],
      customArgs: {
        sequence_id: sequence.id,
        sequence_step_id: step.id,
        enrollment_id: enrollment.id
      }
    });

    await saveNewsletterEmailEvent(
      buildEmailEvent({
        email: enrollment.email,
        subject: step.subject,
        messageType: "newsletter-sequence",
        result,
        subscriber,
        enrollment,
        sequenceId: sequence.id,
        stepId: step.id,
        category: `sequence-${sequence.id}`
      })
    );

    const nextStepIndex = enrollment.currentStepIndex + 1;
    const nextStep = sequence.steps[nextStepIndex];
    const updated = await saveNewsletterEnrollment({
      ...enrollment,
      status: nextStep ? "active" : "completed",
      currentStepIndex: nextStepIndex,
      updatedAt: now.toISOString(),
      lastSentAt: now.toISOString(),
      nextSendAt: nextStep ? new Date(now.getTime() + nextStep.delayHours * 60 * 60 * 1000).toISOString() : now.toISOString(),
      completedAt: nextStep ? undefined : now.toISOString()
    });

    results.push({
      enrollment: updated,
      sent: result.ok && !result.skipped,
      skipped: Boolean(result.skipped),
      failed: !result.ok
    });
  }

  return {
    attempted: due.length,
    sent: results.filter((result) => result.sent).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => result.failed).length
  };
}

export async function sendNewsletterBroadcast({
  mode,
  subject,
  body,
  audience = defaultAudience,
  testEmail,
  requestUrl,
  limit = 500
}: {
  mode: "test" | "broadcast";
  subject: string;
  body: string;
  audience?: NewsletterAudienceRule;
  testEmail?: string;
  requestUrl: string;
  limit?: number;
}) {
  const now = new Date().toISOString();
  const broadcast = await saveNewsletterBroadcast({
    id: createId("broadcast"),
    createdAt: now,
    updatedAt: now,
    subject,
    body,
    status: mode === "test" ? "test" : "sending",
    audience,
    stats: {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    },
    testEmail: testEmail || ""
  });

  if (mode === "test") {
    const toEmail = testEmail || getNewsletterTestRecipient();
    if (!toEmail) {
      const failed = await saveNewsletterBroadcast({
        ...broadcast,
        updatedAt: new Date().toISOString(),
        status: "failed",
        stats: {
          attempted: 1,
          sent: 0,
          skipped: 0,
          failed: 1
        }
      });
      return {
        broadcast: publicBroadcast(failed),
        attempted: 1,
        sent: 0,
        skipped: 0,
        failed: 1,
        error: "No test email is configured."
      };
    }

    const result = await sendNewsletterEmail({
      toEmail,
      toName: "VIDSLOOM Test",
      subject: `[Test] ${subject}`,
      body,
      categories: ["vidsloom-newsletter-test"],
      customArgs: {
        broadcast_id: broadcast.id,
        mode: "test"
      }
    });
    await saveNewsletterEmailEvent(
      buildEmailEvent({
        email: toEmail,
        recipientName: "VIDSLOOM Test",
        subject,
        messageType: "newsletter-broadcast",
        result,
        broadcastId: broadcast.id,
        category: "newsletter-test"
      })
    );
    const updated = await saveNewsletterBroadcast({
      ...broadcast,
      updatedAt: new Date().toISOString(),
      status: result.ok ? "test" : "failed",
      stats: statsFromResults([result])
    });

    return {
      broadcast: publicBroadcast(updated),
      ...updated.stats,
      result
    };
  }

  const subscribers = (await listNewsletterSubscribers({ status: "all", limit: Math.min(limit, 2000) }))
    .filter((subscriber) => subscriberMatchesAudience(subscriber, audience))
    .slice(0, limit);
  const uniqueSubscribers = Array.from(new Map(subscribers.map((subscriber) => [subscriber.email.toLowerCase(), subscriber])).values());

  if (!uniqueSubscribers.length) {
    const failed = await saveNewsletterBroadcast({
      ...broadcast,
      updatedAt: new Date().toISOString(),
      status: "failed",
      stats: {
        attempted: 0,
        sent: 0,
        skipped: 0,
        failed: 0
      }
    });
    return {
      broadcast: publicBroadcast(failed),
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      error: "No newsletter opt-ins match this audience."
    };
  }

  const results = await Promise.all(
    uniqueSubscribers.map(async (subscriber) => {
      const unsubscribeUrl = new URL(`/api/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`, requestUrl).toString();
      const context = subscriberContext(subscriber);
      const result = await sendNewsletterEmail({
        toEmail: subscriber.email,
        toName: subscriber.name,
        subject: renderTemplate(subject, context),
        body: renderTemplate(body, context),
        unsubscribeUrl,
        categories: ["vidsloom-newsletter", "vidsloom-broadcast"],
        customArgs: {
          broadcast_id: broadcast.id,
          subscriber_id: subscriber.id
        }
      });
      await saveNewsletterEmailEvent(
        buildEmailEvent({
          email: subscriber.email,
          recipientName: subscriber.name,
          subject,
          messageType: "newsletter-broadcast",
          result,
          subscriber,
          broadcastId: broadcast.id,
          category: "newsletter-broadcast"
        })
      );
      return result;
    })
  );

  const stats = statsFromResults(results);
  const updated = await saveNewsletterBroadcast({
    ...broadcast,
    updatedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    status: stats.failed ? (stats.sent ? "partial" : "failed") : "sent",
    stats
  });

  return {
    broadcast: publicBroadcast(updated),
    ...stats
  };
}

export async function recordLeadSystemEmailEvents({
  lead,
  ownerNotification,
  autoresponder
}: {
  lead: Lead;
  ownerNotification: SendResult;
  autoresponder: SendResult;
}) {
  const ownerEmail = getNewsletterTestRecipient();
  await Promise.all([
    ownerEmail
      ? saveNewsletterEmailEvent(
          buildEmailEvent({
            email: ownerEmail,
            recipientName: "VIDSLOOM Sales",
            subject: `New VIDSLOOM lead: ${lead.businessName}`,
            messageType: "internal-notification",
            result: ownerNotification,
            leadId: lead.id,
            category: "lead-owner-notification",
            metadata: {
              source: lead.source,
              preferredContact: lead.preferredContact
            }
          })
        )
      : Promise.resolve(null),
    saveNewsletterEmailEvent(
      buildEmailEvent({
        email: lead.email,
        recipientName: lead.contactName,
        subject: "Your VIDSLOOM video growth audit request",
        messageType: "transactional",
        result: autoresponder,
        leadId: lead.id,
        category: "lead-autoresponder",
        metadata: {
          source: lead.source,
          preferredContact: lead.preferredContact
        }
      })
    )
  ]);
}

export function subscriberMatchesAudience(subscriber: NewsletterSubscriber, audience: NewsletterAudienceRule) {
  const statusMatches = audience.statuses.length ? audience.statuses.includes(subscriber.status) : subscriber.status === "active";
  const sourceMatches = audience.sources.length ? audience.sources.includes(subscriber.source) : true;
  const tagMatches = audience.tags.length ? audience.tags.some((tag) => subscriber.tags.includes(tag)) : true;
  return statusMatches && sourceMatches && tagMatches;
}

function renderTemplate(template: string, context: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => context[key] || "");
}

function subscriberContext(subscriber?: NewsletterSubscriber | null, enrollment?: NewsletterEnrollment) {
  const name = subscriber?.name || "";
  return {
    name: name || "there",
    email: subscriber?.email || enrollment?.email || "",
    businessName: subscriber?.businessName || enrollment?.metadata.businessName || "your business",
    source: subscriber?.source || enrollment?.metadata.source || ""
  };
}

function statsFromResults(results: SendResult[]) {
  return {
    attempted: results.length,
    sent: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.ok).length
  };
}

function buildEmailEvent({
  email,
  recipientName,
  subject,
  messageType,
  result,
  status,
  subscriber,
  enrollment,
  leadId,
  broadcastId,
  sequenceId,
  stepId,
  category,
  reason,
  metadata
}: {
  email: string;
  recipientName?: string;
  subject: string;
  messageType: NewsletterEmailEvent["messageType"];
  result?: SendResult;
  status?: NewsletterEmailEvent["status"];
  subscriber?: NewsletterSubscriber | null;
  enrollment?: NewsletterEnrollment;
  leadId?: string;
  broadcastId?: string;
  sequenceId?: string;
  stepId?: string;
  category?: string;
  reason?: string;
  metadata?: Record<string, string>;
}): NewsletterEmailEvent {
  const deliveryStatus =
    status ?? (result?.skipped ? "skipped" : result?.ok === false ? "failed" : result?.ok ? "sent" : "skipped");
  return {
    id: createId("email"),
    createdAt: new Date().toISOString(),
    email,
    recipientName: recipientName ?? subscriber?.name ?? "",
    subject,
    messageType,
    status: deliveryStatus,
    provider: "sendgrid",
    providerStatus: result && "status" in result ? result.status : undefined,
    providerJobId: result && "jobId" in result ? result.jobId : undefined,
    reason: reason ?? (result && "reason" in result ? result.reason : result && "error" in result ? result.error : undefined),
    subscriberId: subscriber?.id ?? enrollment?.subscriberId,
    leadId: leadId ?? enrollment?.leadId,
    broadcastId,
    sequenceId: sequenceId ?? enrollment?.sequenceId,
    sequenceStepId: stepId,
    category: category ?? "vidsloom-email",
    metadata: metadata ?? {}
  };
}

function publicBroadcast(broadcast: NewsletterBroadcast) {
  return {
    id: broadcast.id,
    createdAt: broadcast.createdAt,
    updatedAt: broadcast.updatedAt,
    subject: broadcast.subject,
    status: broadcast.status,
    audience: broadcast.audience,
    stats: broadcast.stats,
    sentAt: broadcast.sentAt
  };
}

function publicEmailEvent(event: NewsletterEmailEvent) {
  return {
    id: event.id,
    createdAt: event.createdAt,
    email: event.email,
    recipientName: event.recipientName,
    subject: event.subject,
    messageType: event.messageType,
    status: event.status,
    providerStatus: event.providerStatus,
    reason: event.reason,
    category: event.category
  };
}
