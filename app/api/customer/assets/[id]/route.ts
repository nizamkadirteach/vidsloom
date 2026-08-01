import { NextResponse } from "next/server";

import { summarizeCustomerAssetReadiness } from "@/lib/customer-assets";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { CustomerPortalAccessSchema } from "@/lib/schemas";
import { archiveCustomerAsset, listCustomerAssetsForCustomer } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const url = new URL(request.url);
  const parsed = CustomerPortalAccessSchema.safeParse({
    customerId: url.searchParams.get("customerId") ?? "",
    accessToken: url.searchParams.get("accessToken") ?? ""
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer asset request.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal(parsed.data);
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const asset = await archiveCustomerAsset(id, customer.id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const assets = await listCustomerAssetsForCustomer(customer.id, 200);
  return NextResponse.json({
    ok: true,
    asset,
    assets,
    readiness: summarizeCustomerAssetReadiness(assets)
  });
}
