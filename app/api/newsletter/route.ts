import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import {
  enrollSubscriberSequences,
  getNewsletterOperationsSummary,
  runDueNewsletterAutomations
} from "@/lib/newsletter-automation";
import { NewsletterSubscribeSchema } from "@/lib/schemas";
import { listNewsletterSubscribers, upsertNewsletterSubscriber } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvHeaders = [
  "createdAt",
  "updatedAt",
  "email",
  "name",
  "businessName",
  "status",
  "source",
  "tags",
  "consentAt"
];

export async function GET(request: Request) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "500") || 500, 2000);
  const status = url.searchParams.get("status") === "all" ? "all" : "active";
  const subscribers = await listNewsletterSubscribers({ limit, status });

  if (url.searchParams.get("format") === "csv") {
    const rows = [
      csvHeaders.join(","),
      ...subscribers.map((subscriber) =>
        [
          subscriber.createdAt,
          subscriber.updatedAt,
          subscriber.email,
          subscriber.name,
          subscriber.businessName,
          subscriber.status,
          subscriber.source,
          subscriber.tags.join("; "),
          subscriber.consentAt
        ]
          .map(csvCell)
          .join(",")
      )
    ];

    return new Response(`${rows.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"vidsloom-newsletter-subscribers.csv\""
      }
    });
  }

  return NextResponse.json({
    capture: "vidsloom-native-list",
    count: subscribers.length,
    operations: await getNewsletterOperationsSummary(),
    contacts: subscribers.map((subscriber) => ({
      id: subscriber.id,
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
      email: subscriber.email,
      contactName: subscriber.name,
      businessName: subscriber.businessName,
      status: subscriber.status,
      source: subscriber.source,
      tags: subscriber.tags
    }))
  });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = NewsletterSubscribeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid newsletter subscription.", issues: parsed.error.issues }, { status: 400 });
  }

  const subscriber = await upsertNewsletterSubscriber({
    email: parsed.data.email,
    name: parsed.data.name,
    businessName: parsed.data.businessName,
    source: parsed.data.source,
    tags: parsed.data.tags,
    consentText: "User requested VIDSLOOM trend notes and video ideas."
  });

  const enrollments = await enrollSubscriberSequences({
    subscriber,
    trigger: "newsletter-subscribed"
  });
  const automation = await runDueNewsletterAutomations({
    requestUrl: request.url,
    limit: 5
  });

  return NextResponse.json({
    subscriber: {
      id: subscriber.id,
      email: subscriber.email,
      status: subscriber.status
    },
    automation: {
      enrolled: enrollments.length,
      ...automation
    }
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
