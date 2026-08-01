import "server-only";

import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { generatedAssetBucketName } from "@/lib/generated-asset-config";

let storageClient: Storage | null = null;

export type StoredCustomerAssetFile = {
  key: string;
  provider: "gcs" | "local";
};

export type CustomerAssetFileReadResult = {
  body: Buffer;
  contentType: string;
  cacheControl: string;
};

export async function saveCustomerAssetFile({
  key,
  body,
  contentType,
  cacheControl = "private, max-age=0, no-store"
}: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<StoredCustomerAssetFile> {
  const normalizedKey = normalizeCustomerAssetKey(key);
  const bucketName = customerAssetBucketName();

  if (bucketName) {
    await storage().bucket(bucketName).file(normalizedKey).save(body, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl
      }
    });
    return { key: normalizedKey, provider: "gcs" };
  }

  const destination = localCustomerAssetPath(normalizedKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ destination, body);
  return { key: normalizedKey, provider: "local" };
}

export async function readCustomerAssetFile({
  key,
  fallbackContentType = "application/octet-stream"
}: {
  key: string;
  fallbackContentType?: string;
}): Promise<CustomerAssetFileReadResult | null> {
  const normalizedKey = normalizeCustomerAssetKey(key);
  const bucketName = customerAssetBucketName();

  if (bucketName) {
    const file = storage().bucket(bucketName).file(normalizedKey);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [body] = await file.download();
    const [metadata] = await file.getMetadata().catch(() => [
      {
        contentType: fallbackContentType,
        cacheControl: ""
      }
    ]);
    return {
      body,
      contentType: String(metadata.contentType || fallbackContentType),
      cacheControl: String(metadata.cacheControl || "private, max-age=0, no-store")
    };
  }

  try {
    return {
      body: await readFile(/* turbopackIgnore: true */ localCustomerAssetPath(normalizedKey)),
      contentType: fallbackContentType,
      cacheControl: "private, max-age=0, no-store"
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function buildCustomerAssetStorageKey({
  environment,
  customerId,
  assetId,
  fileName
}: {
  environment: string;
  customerId: string;
  assetId: string;
  fileName: string;
}) {
  const safeFileName = fileName
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalizeCustomerAssetKey(
    `customer-assets/${safeSegment(environment)}/${safeSegment(customerId)}/${safeSegment(assetId)}/${safeFileName || "asset"}`
  );
}

export function customerAssetEnvironmentName() {
  return (process.env.VIDSLOOM_ENV ?? process.env.VIDLOOM_ENV ?? "local").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

function customerAssetBucketName() {
  return (
    process.env.VIDSLOOM_ASSET_BUCKET ??
    process.env.VIDSLOOM_GENERATED_ASSET_BUCKET ??
    process.env.VIDLOOM_ASSET_BUCKET ??
    process.env.VIDLOOM_GENERATED_ASSET_BUCKET ??
    ""
  ).trim();
}

function normalizeCustomerAssetKey(key: string) {
  const cleaned = key.replaceAll("\\", "/").replace(/^\/+/, "").trim();
  if (!cleaned || cleaned.includes("..") || !/^[a-zA-Z0-9/_\-.]+$/.test(cleaned)) {
    throw new Error("Invalid customer asset key.");
  }
  return cleaned;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function localCustomerAssetPath(key: string) {
  return path.join(process.cwd(), ".vidsloom-data", "customer-assets", normalizeCustomerAssetKey(key));
}

function storage() {
  storageClient ??= new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT
  });
  return storageClient;
}
