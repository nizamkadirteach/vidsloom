import "server-only";

import { buildOwnerFollowupLinks } from "@/lib/contact-actions";
import { createId } from "@/lib/id";
import type { Lead, LeadCreate, LeadSalesUpdate } from "@/lib/schemas";

type LeadScoringInput = Pick<
  Lead | LeadCreate,
  | "source"
  | "phone"
  | "website"
  | "industry"
  | "goal"
  | "currentContent"
  | "platforms"
  | "monthlyBudget"
  | "urgency"
  | "preferredContact"
>;

export function scoreLead(input: LeadScoringInput) {
  let score = 20;
  const reasons: string[] = [];

  if (input.urgency === "this-week") {
    score += 25;
    reasons.push("Wants to move this week");
  } else if (input.urgency === "this-month") {
    score += 10;
    reasons.push("Has this-month timing");
  } else {
    score -= 5;
    reasons.push("Exploring only");
  }

  if (input.monthlyBudget === "5000-plus") {
    score += 30;
    reasons.push("High monthly budget signal");
  } else if (input.monthlyBudget === "1500-5000") {
    score += 24;
    reasons.push("Strong monthly budget signal");
  } else if (input.monthlyBudget === "500-1500") {
    score += 12;
    reasons.push("Viable starter budget");
  } else if (input.monthlyBudget === "under-500") {
    score -= 8;
    reasons.push("Budget may need qualification");
  }

  if (input.source === "pilot") {
    score += 18;
    reasons.push("Pilot page intent");
  } else if (input.source === "growth-audit") {
    score += 10;
    reasons.push("Requested growth audit");
  }

  if (input.phone?.trim()) {
    score += 10;
    reasons.push("Phone or WhatsApp supplied");
  }

  if (["WhatsApp", "SMS", "Phone"].includes(input.preferredContact)) {
    score += 8;
    reasons.push("Fast follow-up channel preferred");
  }

  if (input.website?.trim()) {
    score += 8;
    reasons.push("Website or social context supplied");
  }

  if (input.currentContent?.trim()) {
    score += 7;
    reasons.push("Existing content context supplied");
  }

  if (input.platforms.length >= 3) {
    score += 5;
    reasons.push("Multi-platform opportunity");
  }

  if (input.goal.trim().length > 90) {
    score += 5;
    reasons.push("Specific business goal");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const priority = normalizedScore >= 65 ? "hot" : normalizedScore >= 38 ? "warm" : "nurture";

  return {
    score: normalizedScore,
    priority,
    reasons: reasons.slice(0, 8)
  } as const;
}

export function buildInitialSalesPipeline(lead: LeadCreate | Lead) {
  const now = new Date();
  const scoring = scoreLead(lead);
  const nextFollowUpAt = new Date(
    now.getTime() + (scoring.priority === "hot" ? 2 : scoring.priority === "warm" ? 24 : 72) * 60 * 60 * 1000
  ).toISOString();

  return {
    status: scoring.priority === "nurture" ? ("nurture" as const) : ("new" as const),
    priority: scoring.priority,
    score: scoring.score,
    scoreReasons: scoring.reasons,
    assignedTo: "",
    followUpTask:
      scoring.priority === "hot"
        ? "Reply within 5 minutes if possible; ask for 2-3 links/assets and offer a pilot call."
        : scoring.priority === "warm"
          ? "Send the audit follow-up and ask for website/social links plus one proof point."
          : "Keep in nurture; send useful trend notes and invite them to request a pilot when ready.",
    lastContactedAt: "",
    nextFollowUpAt,
    notes: "",
    closeProbability: scoring.priority === "hot" ? 55 : scoring.priority === "warm" ? 30 : 10,
    proposalAmount: 0,
    lostReason: "",
    events: [
      {
        id: createId("event"),
        createdAt: now.toISOString(),
        type: "created" as const,
        summary: `Lead captured and scored ${scoring.score}/100 as ${scoring.priority}.`
      }
    ]
  };
}

export function applyLeadSalesUpdate(lead: Lead, update: LeadSalesUpdate) {
  const now = new Date().toISOString();
  const nextSales = {
    ...lead.sales,
    ...stripUndefined({
      status: update.status,
      priority: update.priority,
      score: update.score,
      scoreReasons: update.scoreReasons,
      assignedTo: update.assignedTo,
      followUpTask: update.followUpTask,
      lastContactedAt: update.lastContactedAt,
      nextFollowUpAt: update.nextFollowUpAt,
      notes: update.notes,
      closeProbability: update.closeProbability,
      proposalAmount: update.proposalAmount,
      lostReason: update.lostReason
    })
  };

  const summary = update.eventSummary?.trim() || defaultEventSummary(update, lead);
  const eventType = update.eventType ?? inferEventType(update);

  return {
    ...lead,
    updatedAt: now,
    sales: {
      ...nextSales,
      events: [
        {
          id: createId("event"),
          createdAt: now,
          type: eventType,
          summary
        },
        ...lead.sales.events
      ].slice(0, 50)
    }
  };
}

export function leadToPipelineView(lead: Lead) {
  const links = buildOwnerFollowupLinks(lead);
  return {
    ...lead,
    contactLinks: {
      email: links.email,
      whatsapp: links.whatsapp,
      sms: links.sms
    },
    due: Boolean(lead.sales.nextFollowUpAt && lead.sales.nextFollowUpAt <= new Date().toISOString())
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function inferEventType(update: LeadSalesUpdate) {
  if (update.status === "won") return "won" as const;
  if (update.status === "lost") return "lost" as const;
  if (update.proposalAmount || update.status === "proposal") return "proposal" as const;
  if (update.lastContactedAt) return "contact" as const;
  if (update.nextFollowUpAt || update.followUpTask) return "follow-up" as const;
  if (update.notes) return "note" as const;
  return "status" as const;
}

function defaultEventSummary(update: LeadSalesUpdate, lead: Lead) {
  if (update.status && update.status !== lead.sales.status) {
    return `Status changed from ${lead.sales.status} to ${update.status}.`;
  }

  if (update.lastContactedAt) {
    return "Contact attempt logged.";
  }

  if (update.nextFollowUpAt || update.followUpTask) {
    return "Follow-up task updated.";
  }

  if (update.notes) {
    return "Sales note updated.";
  }

  return "Lead pipeline updated.";
}
