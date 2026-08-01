import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAutomationSecret, requireQaSession } from "@/lib/auth";
import { createId } from "@/lib/id";
import { buildOpsAlerts, formatOpsAlertSummary } from "@/lib/ops-alerts";
import { sendOpsAlertEmail } from "@/lib/sendgrid";
import { saveOpsAlertSuppression } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OpsAlertRequestSchema = z.object({
  notify: z.boolean().default(false),
  minSeverity: z.enum(["critical", "warning", "info"]).default("critical"),
  includeSuppressed: z.boolean().default(false),
  acknowledgeIds: z.array(z.string().trim().min(3).max(240)).max(100).default([]),
  suppressHours: z.number().min(1).max(24 * 30).default(24),
  acknowledgedBy: z.string().trim().min(1).max(120).default("qa"),
  note: z.string().trim().max(600).optional().or(z.literal("")).default("")
});

export async function GET(request: Request) {
  const authError = authorizeOpsRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const report = await buildOpsAlerts({ includeSuppressed: url.searchParams.get("includeSuppressed") === "true" });
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const authError = authorizeOpsRequest(request);
  if (authError) return authError;

  const json = await request.json().catch(() => ({}));
  const parsed = OpsAlertRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ops alert request.", issues: parsed.error.issues }, { status: 400 });
  }

  const now = new Date();
  const acknowledgedIds: string[] = [];
  if (parsed.data.acknowledgeIds.length) {
    const suppressUntil = new Date(now.getTime() + parsed.data.suppressHours * 60 * 60 * 1000).toISOString();
    for (const alertId of Array.from(new Set(parsed.data.acknowledgeIds))) {
      await saveOpsAlertSuppression({
        id: createId("ops_ack"),
        alertId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        acknowledgedAt: now.toISOString(),
        acknowledgedBy: parsed.data.acknowledgedBy,
        note: parsed.data.note,
        suppressUntil,
        resolvedAt: ""
      });
      acknowledgedIds.push(alertId);
    }
  }

  const report = await buildOpsAlerts({ includeSuppressed: parsed.data.includeSuppressed });
  const severityRank = { info: 1, warning: 2, critical: 3 } as const;
  const matchingAlerts = report.alerts.filter(
    (alert) => severityRank[alert.severity] >= severityRank[parsed.data.minSeverity]
  );
  const email =
    parsed.data.notify && matchingAlerts.length
      ? await sendOpsAlertEmail({
          subject: `VIDSLOOM ops alerts: ${report.counts.critical} critical, ${report.counts.warning} warning`,
          body: formatOpsAlertSummary({
            ...report,
            alerts: matchingAlerts,
            counts: {
              total: matchingAlerts.length,
              critical: matchingAlerts.filter((alert) => alert.severity === "critical").length,
              warning: matchingAlerts.filter((alert) => alert.severity === "warning").length,
              info: matchingAlerts.filter((alert) => alert.severity === "info").length,
              suppressed: matchingAlerts.filter((alert) => alert.suppressed).length
            }
          })
        })
      : null;

  return NextResponse.json({
    ...report,
    acknowledgedIds,
    acknowledgedCount: acknowledgedIds.length,
    notification: email
      ? summarizeEmailResult(email)
      : {
          sent: false,
          reason: parsed.data.notify ? "No matching alerts met the requested severity." : "Notification was not requested."
        }
  });
}

function authorizeOpsRequest(request: Request) {
  if (hasValidAutomationSecret(request)) return null;
  return requireQaSession(request);
}

function summarizeEmailResult(result: Awaited<ReturnType<typeof sendOpsAlertEmail>>) {
  if (result.skipped) {
    return {
      sent: false,
      skipped: true,
      reason: result.reason
    };
  }

  if (!result.ok) {
    return {
      sent: false,
      status: result.status,
      error: result.error
    };
  }

  return {
    sent: true,
    status: result.status,
    jobId: result.jobId ?? ""
  };
}
