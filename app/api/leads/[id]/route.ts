import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import { applyLeadSalesUpdate, leadToPipelineView } from "@/lib/lead-pipeline";
import { LeadSalesUpdateSchema } from "@/lib/schemas";
import { getLead, saveLead } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ lead: leadToPipelineView(lead) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = LeadSalesUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead update.", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = applyLeadSalesUpdate(lead, parsed.data);
  await saveLead(updated);

  return NextResponse.json({ lead: leadToPipelineView(updated) });
}
