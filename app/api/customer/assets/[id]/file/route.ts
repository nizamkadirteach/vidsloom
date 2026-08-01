import { NextResponse } from "next/server";

import { readCustomerAssetFile } from "@/lib/customer-asset-files";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { CustomerPortalAccessSchema } from "@/lib/schemas";
import { getCustomerAsset } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
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

  const asset = await getCustomerAsset(id);
  if (!asset || asset.customerId !== customer.id || asset.status === "archived") {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  if (asset.source === "url" && asset.sourceUrl) {
    return NextResponse.redirect(asset.sourceUrl);
  }

  if (!asset.storageKey) {
    return NextResponse.json({ error: "Asset file is not available." }, { status: 404 });
  }

  const stored = await readCustomerAssetFile({
    key: asset.storageKey,
    fallbackContentType: asset.mimeType || "application/octet-stream"
  });
  if (!stored) {
    return NextResponse.json({ error: "Asset file is not available." }, { status: 404 });
  }

  return new Response(new Uint8Array(stored.body), {
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": stored.cacheControl,
      "Content-Disposition": `inline; filename="${asset.originalFileName || `${asset.id}.asset`}"`,
      "X-Robots-Tag": "noindex"
    }
  });
}
