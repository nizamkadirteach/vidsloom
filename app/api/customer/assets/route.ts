import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  buildCustomerAssetStorageKey,
  customerAssetEnvironmentName,
  saveCustomerAssetFile
} from "@/lib/customer-asset-files";
import { scoreCustomerAssetQuality, summarizeCustomerAssetReadiness } from "@/lib/customer-assets";
import { authorizeCustomerPortal } from "@/lib/customer-access";
import { createId } from "@/lib/id";
import { CustomerAssetCreateSchema, CustomerAssetSchema, CustomerPortalAccessSchema } from "@/lib/schemas";
import { listCustomerAssetsForCustomer, saveCustomerAsset } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxUploadBytes = 30 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "text/plain"
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId") ?? "";
    const accessToken = url.searchParams.get("accessToken") ?? "";
    if (!customerId || !accessToken) {
      return NextResponse.json(
        {
          error: "Missing customer portal credentials.",
          required: ["customerId", "accessToken"]
        },
        { status: 400 }
      );
    }

    const parsed = CustomerPortalAccessSchema.safeParse({ customerId, accessToken });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid customer asset request.", issues: parsed.error.issues }, { status: 400 });
    }

    const customer = await authorizeCustomerPortal(parsed.data);
    if (!customer) {
      return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
    }

    const assets = await listCustomerAssetsForCustomer(customer.id, 200);
    return NextResponse.json({
      ok: true,
      assets,
      readiness: summarizeCustomerAssetReadiness(assets)
    });
  } catch (error) {
    console.error("VIDSLOOM customer asset list failed", error);
    return NextResponse.json({ error: "Customer asset library is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const parsed = contentType.includes("multipart/form-data")
    ? await parseMultipartAssetRequest(request)
    : CustomerAssetCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer asset request.", issues: parsed.error.issues }, { status: 400 });
  }

  const customer = await authorizeCustomerPortal({
    customerId: parsed.data.customerId,
    accessToken: parsed.data.accessToken
  });
  if (!customer) {
    return NextResponse.json({ error: "Invalid or expired customer portal link." }, { status: 401 });
  }

  const file = "file" in parsed.data ? parsed.data.file : null;
  const sourceUrl = parsed.data.sourceUrl.trim();
  if (!file && !sourceUrl) {
    return NextResponse.json({ error: "Upload a file or provide a source URL." }, { status: 400 });
  }

  if (sourceUrl && !isValidHttpUrl(sourceUrl)) {
    return NextResponse.json({ error: "Use a valid http or https source URL." }, { status: 400 });
  }

  if (file && file.size > maxUploadBytes) {
    return NextResponse.json(
      { error: "Asset upload is too large. Use a drive link for files above 30MB." },
      { status: 413 }
    );
  }

  const now = new Date().toISOString();
  const assetId = createId("asset");
  let storageKey = "";
  let storageProvider: "gcs" | "local" | "remote-url" = "remote-url";
  let originalFileName = "";
  let mimeType = "";
  let sizeBytes = 0;
  let width = 0;
  let height = 0;

  if (file) {
    originalFileName = file.name || "customer-asset";
    mimeType = file.type || contentTypeFromName(originalFileName);
    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported asset type. Upload images, MP4/MOV/WebM clips, PDFs, or text notes." },
        { status: 415 }
      );
    }
    const body = Buffer.from(await file.arrayBuffer());
    sizeBytes = body.byteLength;
    if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
      const metadata = await sharp(body).metadata().catch(() => null);
      width = metadata?.width ?? 0;
      height = metadata?.height ?? 0;
    }

    const stored = await saveCustomerAssetFile({
      key: buildCustomerAssetStorageKey({
        environment: customerAssetEnvironmentName(),
        customerId: customer.id,
        assetId,
        fileName: originalFileName
      }),
      body,
      contentType: mimeType
    });
    storageKey = stored.key;
    storageProvider = stored.provider;
  }

  const label = parsed.data.label.trim() || inferredAssetLabel({ fileName: originalFileName, sourceUrl, kind: parsed.data.kind });
  const quality = scoreCustomerAssetQuality({
    kind: parsed.data.kind,
    source: file ? "upload" : "url",
    mimeType,
    sizeBytes,
    width,
    height,
    sourceUrl,
    usageConsent: parsed.data.usageConsent,
    usageRights: parsed.data.usageRights
  });
  const asset = CustomerAssetSchema.parse({
    id: assetId,
    customerId: customer.id,
    createdAt: now,
    updatedAt: now,
    status: "active",
    kind: parsed.data.kind,
    source: file ? "upload" : "url",
    label,
    notes: parsed.data.notes,
    sourceUrl,
    originalFileName,
    mimeType,
    sizeBytes,
    width,
    height,
    durationSeconds: 0,
    storageProvider,
    storageKey,
    usageRights: parsed.data.usageRights,
    usageConsent: parsed.data.usageConsent,
    consentText: parsed.data.usageConsent
      ? "Customer confirmed VIDSLOOM may use this asset for campaign drafts, publishing kits, and approved generated videos."
      : "",
    ...quality
  });

  await saveCustomerAsset(asset);
  const assets = await listCustomerAssetsForCustomer(customer.id, 200);
  return NextResponse.json({
    ok: true,
    asset,
    assets,
    readiness: summarizeCustomerAssetReadiness(assets)
  });
}

async function parseMultipartAssetRequest(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return CustomerAssetCreateSchema.safeParse(null);
  const maybeFile = formData.get("file");
  const file = isFileLike(maybeFile) && maybeFile.size > 0 ? maybeFile : null;
  const parsed = CustomerAssetCreateSchema.safeParse({
    customerId: stringFromFormData(formData, "customerId"),
    accessToken: stringFromFormData(formData, "accessToken"),
    kind: stringFromFormData(formData, "kind") || "other",
    label: stringFromFormData(formData, "label"),
    notes: stringFromFormData(formData, "notes"),
    sourceUrl: stringFromFormData(formData, "sourceUrl"),
    usageRights: stringFromFormData(formData, "usageRights") || "owned-or-licensed",
    usageConsent: booleanFromFormData(formData, "usageConsent")
  });
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: {
      ...parsed.data,
      file
    }
  };
}

function stringFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function booleanFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function contentTypeFromName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function inferredAssetLabel({
  fileName,
  sourceUrl,
  kind
}: {
  fileName: string;
  sourceUrl: string;
  kind: string;
}) {
  if (fileName) {
    return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 140) || "Uploaded asset";
  }
  if (sourceUrl) {
    return new URL(sourceUrl).hostname.replace(/^www\./, "").slice(0, 140);
  }
  return `${kind} asset`;
}
