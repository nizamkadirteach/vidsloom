import { NextResponse } from "next/server";

import { requireQaSession } from "@/lib/auth";
import { toPublicCampaign } from "@/lib/public-campaign";
import { getCampaign } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireQaSession(request);
  if (authError) return authError;

  const { id } = await context.params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json({ campaign: toPublicCampaign(campaign) });
}
