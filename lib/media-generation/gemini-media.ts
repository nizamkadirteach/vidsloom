import "server-only";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

import { readCustomerAssetFile } from "@/lib/customer-asset-files";
import { createGeminiClient, getGeminiRuntime } from "@/lib/gemini";
import { saveGeneratedAsset, type StoredGeneratedAsset } from "@/lib/generated-asset-storage";
import { mediaCostControlSettings } from "@/lib/media-generation/cost-controls";
import type { CompiledPromptPacket } from "@/lib/media-generation/schemas";
import { getCustomerAsset } from "@/lib/storage";

export type MediaGenerationResult = {
  ok: boolean;
  status: "disabled" | "generated" | "failed";
  asset?: StoredGeneratedAsset;
  posterAsset?: StoredGeneratedAsset;
  qa?: {
    playable: boolean;
    durationSeconds: number;
    resolution: string;
    fileSizeBytes: number;
    checks: string[];
    warnings: string[];
    verdict: "pass" | "review" | "failed";
  };
  error?: string;
};

export function mediaFeatureFlags() {
  return {
    mediaGeneration: process.env.VIDSLOOM_MEDIA_GENERATION_ENABLED === "true",
    referenceFrames: process.env.VIDSLOOM_REFERENCE_FRAME_GENERATION_ENABLED === "true",
    videoClips: process.env.VIDSLOOM_VIDEO_CLIP_GENERATION_ENABLED === "true",
    tts: process.env.VIDSLOOM_TTS_ENABLED === "true",
    maxPremiumClips: positiveInteger(process.env.VIDSLOOM_PREMIUM_VIDEO_MAX_CLIPS, 1),
    mediaBudgetCents: positiveInteger(process.env.VIDSLOOM_MEDIA_BUDGET_PER_CAMPAIGN_CENTS, 0)
  };
}

export function mediaRuntimeStatus() {
  const runtime = getGeminiRuntime();
  const flags = mediaFeatureFlags();
  const costControls = mediaCostControlSettings();
  return {
    configured: runtime.configured,
    mode: runtime.mode,
    location: runtime.location,
    mediaGenerationEnabled: flags.mediaGeneration,
    referenceFrameGenerationEnabled: flags.referenceFrames,
    videoClipGenerationEnabled: flags.videoClips,
    ttsEnabled: flags.tts,
    mediaBudgetCents: costControls.configuredBudgetCents,
    allowUnbudgetedGeneration: costControls.allowUnbudgetedGeneration,
    maxPremiumClips: costControls.maxPremiumClips,
    imageModelConfigured: Boolean(imageModel()),
    videoModelConfigured: Boolean(videoModel()),
    ttsModelConfigured: Boolean(ttsModel())
  };
}

export async function generateReferenceFrame({
  packet,
  storageBaseKey
}: {
  packet: CompiledPromptPacket;
  storageBaseKey: string;
}): Promise<MediaGenerationResult> {
  const flags = mediaFeatureFlags();
  if (!flags.mediaGeneration || !flags.referenceFrames) {
    return { ok: false, status: "disabled", error: "Reference-frame generation is disabled." };
  }

  try {
    const ai = createGeminiClient() as unknown as {
      models: {
        generateContent: (request: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const referenceParts = await referenceAssetParts(packet);
    const response = await ai.models.generateContent({
      model: imageModel(),
      contents: [
        {
          role: "user",
          parts: [{ text: referenceFramePrompt(packet) }, ...referenceParts]
        }
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });
    const image = extractBinaryPart(response);
    if (!image) throw new Error("Image generation response did not include image bytes.");
    const asset = await saveGeneratedAsset({
      key: `${storageBaseKey}/reference-frame.png`,
      body: image.body,
      contentType: image.contentType || "image/png"
    });
    return { ok: true, status: "generated", asset };
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message : "Reference frame failed." };
  }
}

export async function generateVideoClip({
  packet,
  storageBaseKey,
  referenceImage
}: {
  packet: CompiledPromptPacket;
  storageBaseKey: string;
  referenceImage?: Buffer;
}): Promise<MediaGenerationResult> {
  const flags = mediaFeatureFlags();
  if (!flags.mediaGeneration || !flags.videoClips) {
    return { ok: false, status: "disabled", error: "Video clip generation is disabled." };
  }

  try {
    const ai = createGeminiClient() as unknown as {
      models: {
        generateVideos: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
      operations: {
        getVideosOperation: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
      files?: {
        download?: (request: { file: unknown; downloadPath: string }) => Promise<void>;
      };
    };
    const durationSeconds = packet.qualityProfile.clipDurationSeconds;
    const request: Record<string, unknown> = {
      model: videoModel(),
      prompt: videoPrompt(packet),
      config: {
        numberOfVideos: 1,
        aspectRatio: "9:16",
        durationSeconds,
        resolution: packet.qualityProfile.resolution,
        personGeneration: "allow_adult",
        negativePrompt: packet.providerNativeNegative,
        enhancePrompt: true,
        generateAudio: false
      }
    };
    if (referenceImage) {
      request.image = {
        imageBytes: referenceImage.toString("base64"),
        mimeType: "image/png"
      };
    }

    let operation = await ai.models.generateVideos(request);
    const startedAt = Date.now();
    const timeoutMs = positiveInteger(process.env.VIDSLOOM_VIDEO_GENERATION_TIMEOUT_MS, 8 * 60 * 1000);
    while (!operation.done && Date.now() - startedAt < timeoutMs) {
      await sleep(10000);
      operation = await ai.operations.getVideosOperation({ operation });
    }
    if (!operation.done) throw new Error("Video generation timed out before the operation completed.");

    const generated = extractGeneratedVideo(operation);
    const videoBuffer = await downloadGeneratedVideo(ai, generated);
    const asset = await saveGeneratedAsset({
      key: `${storageBaseKey}/clip.mp4`,
      body: videoBuffer,
      contentType: "video/mp4"
    });
    return { ok: true, status: "generated", asset };
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message : "Video clip generation failed." };
  }
}

export async function generateVoiceover({
  text,
  storageBaseKey
}: {
  text: string;
  storageBaseKey: string;
}): Promise<MediaGenerationResult> {
  const flags = mediaFeatureFlags();
  if (!flags.mediaGeneration || !flags.tts) {
    return { ok: false, status: "disabled", error: "TTS generation is disabled." };
  }

  try {
    const ai = createGeminiClient() as unknown as {
      models: {
        generateContent: (request: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const response = await ai.models.generateContent({
      model: ttsModel(),
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: process.env.VIDSLOOM_TTS_VOICE || "Kore"
            }
          }
        }
      }
    });
    const audio = extractBinaryPart(response);
    if (!audio) throw new Error("TTS response did not include audio bytes.");
    const asset = await saveGeneratedAsset({
      key: `${storageBaseKey}/voiceover.wav`,
      body: audio.body,
      contentType: audio.contentType || "audio/wav"
    });
    return { ok: true, status: "generated", asset };
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message : "Voiceover generation failed." };
  }
}

function referenceFramePrompt(packet: CompiledPromptPacket) {
  return [
    "Create a clean, high-fidelity vertical 9:16 reference frame for a short-form business video.",
    packet.invariantBlock.referenceAssetIds.length
      ? "Use the attached customer reference images for product, environment, and visual identity anchoring. Do not copy screenshots, text, labels, or proof; use them only to preserve visual truth."
      : "No customer image reference is attached; infer a realistic category-specific scene from the approved brief.",
    "Fill the entire vertical frame edge-to-edge with the scene. No letterboxing, black bars, borders, inset images, or landscape composition inside a portrait canvas.",
    packet.positivePrompt,
    `Safe-zone requirement: ${packet.postProductionPlan.safeZone}`,
    "No typography. No generated logo, logo-like mark, distorted brand mark, random foreground prop, malformed hand, or cropped partial face.",
    "No invented testimonials, star ratings, awards, dashboards, revenue, medical results, or proof.",
    "Leave natural negative space for post-production captions and proof overlays."
  ].join("\n");
}

async function referenceAssetParts(packet: CompiledPromptPacket) {
  const parts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  const ids = [...new Set(packet.invariantBlock.referenceAssetIds)].slice(0, 4);

  for (const assetId of ids) {
    if (parts.length >= 2) break;
    const asset = await getCustomerAsset(assetId).catch(() => null);
    if (!asset || asset.status !== "active" || !asset.usageConsent) continue;
    if (asset.kind === "logo" || asset.kind === "testimonial-proof" || asset.kind === "review-screenshot") continue;
    if (!asset.mimeType.startsWith("image/") || asset.mimeType === "image/svg+xml") continue;

    const loaded = await loadCustomerReferenceImage(asset).catch(() => null);
    if (!loaded) continue;
    parts.push({
      inlineData: {
        mimeType: loaded.mimeType,
        data: loaded.body.toString("base64")
      }
    });
  }

  return parts;
}

async function loadCustomerReferenceImage(asset: {
  storageKey: string;
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
}) {
  let body: Buffer | null = null;
  let mimeType = asset.mimeType || "image/png";

  if (asset.storageKey) {
    const stored = await readCustomerAssetFile({ key: asset.storageKey, fallbackContentType: mimeType });
    if (stored?.body.length) {
      body = stored.body;
      mimeType = stored.contentType || mimeType;
    }
  } else if (asset.sourceUrl && asset.sourceUrl.startsWith("https://")) {
    const response = await fetch(asset.sourceUrl, { cache: "no-store" });
    if (response.ok) {
      mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || mimeType;
      body = Buffer.from(await response.arrayBuffer());
    }
  }

  if (!body || !mimeType.startsWith("image/") || mimeType === "image/svg+xml") return null;

  const normalized = await sharp(body)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { body: normalized, mimeType: "image/jpeg" };
}

function videoPrompt(packet: CompiledPromptPacket) {
  return [
    packet.positivePrompt,
    `Generation lane: ${packet.qualityProfile.generationLane}.`,
    `Final assembly requirement: ${packet.qualityProfile.finalAssemblyRequired ? "deterministic overlay assembly required" : "single clip only"}.`,
    `Safe-zone requirement: ${packet.postProductionPlan.safeZone}`,
    "Use full-frame vertical 9:16 composition with no letterboxing, black bars, borders, inset images, or landscape framing.",
    "No readable generated text. No generated logos, logo-like marks, distorted brand marks, random foreground props, malformed hands, or cropped partial faces.",
    "No fake proof. No fabricated customers or results.",
    "The output should be realistic, mobile-first, premium, and business-specific."
  ].join("\n");
}

function imageModel() {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
}

function videoModel() {
  return process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-001";
}

function ttsModel() {
  return process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
}

function extractBinaryPart(response: unknown): { body: Buffer; contentType: string } | null {
  const candidates = valueAtPath(response, ["candidates"]) as unknown[] | undefined;
  const candidateParts = candidates?.flatMap((candidate) => {
    const content = valueAtPath(candidate, ["content"]) as Record<string, unknown> | undefined;
    return Array.isArray(content?.parts) ? content.parts : [];
  });
  const directParts = Array.isArray((response as { parts?: unknown[] })?.parts) ? (response as { parts: unknown[] }).parts : [];
  const generatedImages = valueAtPath(response, ["generatedImages"]) as unknown[] | undefined;
  const parts = [...directParts, ...(candidateParts ?? []), ...(generatedImages ?? [])];

  for (const part of parts) {
    const inlineData = valueAtPath(part, ["inlineData"]) ?? valueAtPath(part, ["inline_data"]);
    const data =
      valueAtPath(inlineData, ["data"]) ??
      valueAtPath(part, ["image", "imageBytes"]) ??
      valueAtPath(part, ["image", "bytesBase64Encoded"]) ??
      valueAtPath(part, ["audio", "audioBytes"]);
    if (typeof data === "string" && data) {
      return {
        body: Buffer.from(data, "base64"),
        contentType: String(valueAtPath(inlineData, ["mimeType"]) ?? valueAtPath(inlineData, ["mime_type"]) ?? "application/octet-stream")
      };
    }
  }

  return null;
}

function extractGeneratedVideo(operation: Record<string, unknown>) {
  const generatedVideos =
    valueAtPath(operation, ["response", "generatedVideos"]) ??
    valueAtPath(operation, ["response", "generated_videos"]) ??
    valueAtPath(operation, ["generatedVideos"]);
  const first = Array.isArray(generatedVideos) ? generatedVideos[0] : null;
  if (!first) throw new Error("Video operation did not include a generated video.");
  return first;
}

async function downloadGeneratedVideo(
  ai: { files?: { download?: (request: { file: unknown; downloadPath: string }) => Promise<void> } },
  generated: unknown
) {
  const video = valueAtPath(generated, ["video"]) ?? generated;
  const bytes =
    valueAtPath(video, ["videoBytes"]) ??
    valueAtPath(video, ["bytesBase64Encoded"]) ??
    valueAtPath(video, ["data"]) ??
    valueAtPath(generated, ["videoBytes"]);
  if (typeof bytes === "string" && bytes) return Buffer.from(bytes, "base64");

  if (ai.files?.download) {
    const tempDir = await mkdtemp(path.join(tmpdir(), "vidsloom-video-download-"));
    const downloadPath = path.join(tempDir, "clip.mp4");
    try {
      await ai.files.download({ file: video, downloadPath });
      return await readFile(downloadPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  const uri = valueAtPath(video, ["uri"]) ?? valueAtPath(video, ["downloadUri"]) ?? valueAtPath(video, ["download_uri"]);
  if (typeof uri === "string" && uri.startsWith("http")) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Generated video download failed (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Unable to download generated video bytes from operation response.");
}

function valueAtPath(input: unknown, path: string[]) {
  return path.reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) return (value as Record<string, unknown>)[key];
    return undefined;
  }, input);
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
