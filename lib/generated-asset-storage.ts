import "server-only";

import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildGeneratedAssetUrl,
  generatedAssetBucketName,
  normalizeGeneratedAssetKey,
  type GeneratedAssetStorageProvider
} from "@/lib/generated-asset-config";

let storageClient: Storage | null = null;

export type StoredGeneratedAsset = {
  key: string;
  url: string;
  provider: GeneratedAssetStorageProvider;
};

export type GeneratedAssetReadResult = {
  body: Buffer;
  contentType: string;
  cacheControl: string;
};

export async function saveGeneratedAsset({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable"
}: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<StoredGeneratedAsset> {
  const normalizedKey = normalizeGeneratedAssetKey(key);
  const bucketName = generatedAssetBucketName();

  if (bucketName) {
    const bucket = storage().bucket(bucketName);
    await bucket.file(normalizedKey).save(body, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl
      }
    });
    return {
      key: normalizedKey,
      url: buildGeneratedAssetUrl(normalizedKey),
      provider: "gcs"
    };
  }

  const destination = localAssetPath(normalizedKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ destination, body);
  return {
    key: normalizedKey,
    url: buildGeneratedAssetUrl(normalizedKey),
    provider: "local"
  };
}

export async function readGeneratedAsset(key: string): Promise<GeneratedAssetReadResult | null> {
  const normalizedKey = normalizeGeneratedAssetKey(key);
  const bucketName = generatedAssetBucketName();
  const contentType = contentTypeForGeneratedAsset(normalizedKey);

  if (bucketName) {
    const file = storage().bucket(bucketName).file(normalizedKey);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [body] = await file.download();
    const [metadata] = await file.getMetadata().catch(() => [
      {
        contentType,
        cacheControl: ""
      }
    ]);
    return {
      body,
      contentType: String(metadata.contentType || contentType),
      cacheControl: String(metadata.cacheControl || "public, max-age=31536000, immutable")
    };
  }

  try {
    return {
      body: await readFile(/*turbopackIgnore: true*/ localAssetPath(normalizedKey)),
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function storage() {
  storageClient ??= new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT
  });
  return storageClient;
}

function localAssetPath(key: string) {
  return path.join(process.cwd(), ".vidsloom-data", "generated-assets", normalizeGeneratedAssetKey(key));
}

function contentTypeForGeneratedAsset(key: string) {
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
