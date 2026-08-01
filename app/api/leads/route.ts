import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import { createId } from "@/lib/id";
import { buildInitialSalesPipeline, leadToPipelineView } from "@/lib/lead-pipeline";
import {
  enrollSubscriberSequences,
  recordLeadSystemEmailEvents,
  runDueNewsletterAutomations
} from "@/lib/newsletter-automation";
import { LeadCreateSchema, LeadSchema } from "@/lib/schemas";
import { triggerLeadFollowup } from "@/lib/sendgrid";
import { listLeads, saveLead, upsertNewsletterSubscriber } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const leads = await listLeads();
  return NextResponse.json({
    leads: leads.map(leadToPipelineView),
    summary: summarizeLeads(leads)
  });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = LeadCreateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid lead.",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const lead = LeadSchema.parse({
    ...parsed.data,
    id: createId("lead"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sales: buildInitialSalesPipeline(parsed.data)
  });

  await saveLead(lead);
  let automation:
    | {
        enrolled: number;
        attempted: number;
        sent: number;
        skipped: number;
        failed: number;
      }
    | undefined;
  if (lead.newsletterOptIn) {
    const subscriber = await upsertNewsletterSubscriber({
      email: lead.email,
      name: lead.contactName,
      businessName: lead.businessName,
      source: lead.source === "homepage" ? "lead-form" : lead.source,
      tags: ["VIDSLOOM", lead.industry, lead.source],
      consentText: "Lead requested VIDSLOOM weekly trend notes and video ideas for business owners."
    });
    const enrollments = await enrollSubscriberSequences({
      subscriber,
      trigger: lead.source === "pilot" ? "pilot-requested" : "lead-created",
      lead
    });
    const run = await runDueNewsletterAutomations({
      requestUrl: request.url,
      limit: 5
    });
    automation = {
      enrolled: enrollments.length,
      ...run
    };
  }
  const followup = await triggerLeadFollowup(lead);
  await recordLeadSystemEmailEvents({
    lead,
    ownerNotification: followup.ownerNotification,
    autoresponder: followup.autoresponder
  });

  return NextResponse.json(
    {
      lead,
      followup: {
        configured: followup.configured,
        ownerNotification: summarizeFollowupResult(followup.ownerNotification),
        autoresponder: summarizeFollowupResult(followup.autoresponder),
        marketingContact: summarizeFollowupResult(followup.marketingContact)
      },
      automation
    },
    { status: 201 }
  );
}

function summarizeLeads(leads: Awaited<ReturnType<typeof listLeads>>) {
  const now = new Date().toISOString();
  return {
    total: leads.length,
    hot: leads.filter((lead) => lead.sales.priority === "hot").length,
    warm: leads.filter((lead) => lead.sales.priority === "warm").length,
    nurture: leads.filter((lead) => lead.sales.priority === "nurture").length,
    due: leads.filter((lead) => lead.sales.nextFollowUpAt && lead.sales.nextFollowUpAt <= now).length,
    won: leads.filter((lead) => lead.sales.status === "won").length,
    proposal: leads.filter((lead) => lead.sales.status === "proposal").length
  };
}

function summarizeFollowupResult(result: Awaited<ReturnType<typeof triggerLeadFollowup>>["ownerNotification"]) {
  if (result.skipped) {
    return { ok: true, skipped: true, reason: result.reason };
  }

  if (result.ok) {
    return { ok: true, skipped: false, status: result.status };
  }

  return {
    ok: false,
    skipped: false,
    status: result.status,
    error: "SendGrid request failed. Check server logs and SendGrid activity."
  };
}
