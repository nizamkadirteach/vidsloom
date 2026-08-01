export type GeneratedAssetStorageProvider = "local" | "gcs";

export function generatedAssetBucketName() {
  return (
    process.env.VIDSLOOM_GENERATED_ASSET_BUCKET ??
    process.env.VIDSLOOM_ASSET_BUCKET ??
    process.env.VIDLOOM_GENERATED_ASSET_BUCKET ??
    process.env.VIDLOOM_ASSET_BUCKET ??
    ""
  ).trim();
}

export function generatedAssetProvider(): GeneratedAssetStorageProvider {
  return generatedAssetBucketName() ? "gcs" : "local";
}

export function buildGeneratedAssetUrl(key: string) {
  return `/api/generated-assets/${encodeURIComponentGeneratedAssetKey(key)}`;
}

export function normalizeGeneratedAssetKey(key: string) {
  const cleaned = key.replaceAll("\\", "/").replace(/^\/+/, "").trim();
  if (!cleaned || cleaned.includes("..") || !/^[a-zA-Z0-9/_\-.]+$/.test(cleaned)) {
    throw new Error("Invalid generated asset key.");
  }
  return cleaned;
}

function encodeURIComponentGeneratedAssetKey(key: string) {
  return normalizeGeneratedAssetKey(key)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
