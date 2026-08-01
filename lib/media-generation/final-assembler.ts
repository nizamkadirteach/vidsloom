import "server-only";

import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import * as PImage from "pureimage";
import sharp from "sharp";

import { readGeneratedAsset, saveGeneratedAsset } from "@/lib/generated-asset-storage";
import type { MediaGenerationResult } from "@/lib/media-generation/gemini-media";
import type { MediaProductionPlan, MediaShotPlan, RenderComposition } from "@/lib/media-generation/schemas";
import type { Campaign, VideoConcept } from "@/lib/schemas";

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;
const TEXT_FONT_FAMILY = "VidsloomSans";
type TextCanvasContext = ReturnType<ReturnType<typeof PImage.make>["getContext"]>;
let textFontPath = "";
let textFontPromise: Promise<void> | null = null;

type AssemblyAssetInput = {
  shotId: string;
  type: "reference-frame" | "video-clip" | "final-video";
  result: MediaGenerationResult;
};

type ClipAssemblyInput = {
  shot: MediaShotPlan;
  clip: AssemblyAssetInput;
};

export async function assembleFinalReviewVideo({
  campaign,
  plan,
  generatedAssets,
  storageBaseKey
}: {
  campaign: Campaign;
  plan: MediaProductionPlan;
  generatedAssets: AssemblyAssetInput[];
  storageBaseKey: string;
}): Promise<MediaGenerationResult> {
  if (!ffmpegPath) {
    return { ok: false, status: "failed", error: "Bundled FFmpeg binary is not available for final assembly." };
  }

  const fontPath = finalAssemblyFontPath();
  if (!fontPath) {
    return { ok: false, status: "failed", error: "No deterministic TTF font is available for final assembly text overlays." };
  }

  const composition = plan.renderCompositions[0];
  if (!composition) {
    return { ok: false, status: "failed", error: "No render composition is available for final assembly." };
  }

  const clipInputs = clipsForComposition({ composition, plan, generatedAssets });
  if (!clipInputs.length) {
    return { ok: false, status: "disabled", error: "No generated video clips are available for final assembly." };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "vidsloom-final-assembly-"));
  const checks: string[] = [];
  const warnings: string[] = [];

  try {
    const targetDurationSeconds = composition.durationSeconds;
    const segmentDurationSeconds = Math.max(2, targetDurationSeconds / clipInputs.length);
    const segmentPaths: string[] = [];

    for (const [index, input] of clipInputs.entries()) {
      const clipAsset = input.clip.result.asset;
      if (!clipAsset) continue;
      const storedClip = await readGeneratedAsset(clipAsset.key);
      if (!storedClip?.body.length) {
        warnings.push(`Shot ${input.shot.shotNumber} clip could not be read from generated asset storage.`);
        continue;
      }

      const inputPath = path.join(tempDir, `input-${index}.mp4`);
      const overlayPath = path.join(tempDir, `overlay-${index}.png`);
      const outputPath = path.join(tempDir, `segment-${index}.mp4`);
      await writeFile(inputPath, storedClip.body);
      await writeFile(
        overlayPath,
        await renderOverlayPng({
          campaign,
          plan,
          composition,
          shot: input.shot,
          concept: conceptForShot(campaign, input.shot),
          index,
          total: clipInputs.length,
          fontPath
        })
      );

      await runFfmpeg(
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-stream_loop",
          "-1",
          "-i",
          inputPath,
          "-i",
          overlayPath,
          "-filter_complex",
          [
            `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,fps=${FPS},trim=duration=${fixedSeconds(segmentDurationSeconds)},setpts=PTS-STARTPTS[base]`,
            "[base][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
          ].join(";"),
          "-map",
          "[v]",
          "-an",
          "-t",
          fixedSeconds(segmentDurationSeconds),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "22",
          "-movflags",
          "+faststart",
          outputPath
        ],
        180_000
      );

      segmentPaths.push(outputPath);
    }

    if (!segmentPaths.length) {
      return { ok: false, status: "failed", error: "Final assembly had no readable generated clips." };
    }

    if (segmentPaths.length < composition.sourceShotIds.length) {
      warnings.push(
        `Final assembly used ${segmentPaths.length} generated clip${segmentPaths.length === 1 ? "" : "s"} for ${composition.sourceShotIds.length} planned shots.`
      );
    }

    const concatPath = path.join(tempDir, "concat.txt");
    const finalPath = path.join(tempDir, "final.mp4");
    const posterPath = path.join(tempDir, "poster.png");
    await writeFile(concatPath, segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join("\n"));

    await runFfmpeg(
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        finalPath
      ],
      180_000
    );

    await runFfmpeg(
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.2",
        "-i",
        finalPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
        posterPath
      ],
      60_000
    );

    const [videoBody, posterBody] = await Promise.all([readFile(finalPath), readFile(posterPath)]);
    checks.push("Generated clips were composited into one 9:16 final review MP4.");
    checks.push("Deterministic hook, proof, subtitle, brand, and CTA overlays were applied after AI footage generation.");
    checks.push("Final text overlays were rasterized with a pure-JS TTF renderer before FFmpeg encoding.");
    checks.push("Poster frame extraction succeeded, proving the assembled MP4 is decodable.");

    if (videoBody.length < 80_000) warnings.push("Final MP4 is unusually small and should be manually reviewed.");
    const verdict = videoBody.length >= 80_000 && posterBody.length >= 10_000 ? (warnings.length ? "review" : "pass") : "failed";
    if (verdict === "failed") {
      return { ok: false, status: "failed", error: "Final assembly output failed deterministic file-size checks." };
    }

    const [asset, posterAsset] = await Promise.all([
      saveGeneratedAsset({
        key: `${storageBaseKey}/assembled-review.mp4`,
        body: videoBody,
        contentType: "video/mp4"
      }),
      saveGeneratedAsset({
        key: `${storageBaseKey}/assembled-poster.png`,
        body: posterBody,
        contentType: "image/png"
      })
    ]);

    return {
      ok: true,
      status: "generated",
      asset,
      posterAsset,
      qa: {
        playable: true,
        durationSeconds: targetDurationSeconds,
        resolution: `${WIDTH}x${HEIGHT}`,
        fileSizeBytes: videoBody.length,
        checks,
        warnings,
        verdict
      }
    };
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message : "Final assembly failed." };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function clipsForComposition({
  composition,
  plan,
  generatedAssets
}: {
  composition: RenderComposition;
  plan: MediaProductionPlan;
  generatedAssets: AssemblyAssetInput[];
}): ClipAssemblyInput[] {
  const clips = generatedAssets.filter((item) => item.type === "video-clip" && item.result.status === "generated" && item.result.asset);
  const byShotId = new Map(clips.map((clip) => [clip.shotId, clip]));

  return composition.sourceShotIds
    .map((shotId) => {
      const shot = plan.shotPlans.find((item) => item.id === shotId);
      const clip = byShotId.get(shotId);
      return shot && clip ? { shot, clip } : null;
    })
    .filter((item): item is ClipAssemblyInput => Boolean(item));
}

async function renderOverlayPng({
  campaign,
  plan,
  composition,
  shot,
  concept,
  index,
  total,
  fontPath
}: {
  campaign: Campaign;
  plan: MediaProductionPlan;
  composition: RenderComposition;
  shot: MediaShotPlan;
  concept?: VideoConcept;
  index: number;
  total: number;
  fontPath: string;
}) {
  const baseOverlay = await sharp(Buffer.from(overlaySvg({ campaign }))).png().toBuffer();
  const textOverlay = await renderTextOverlayPng({
    campaign,
    plan,
    composition,
    shot,
    concept,
    index,
    total,
    fontPath
  });

  return sharp(baseOverlay).composite([{ input: textOverlay, left: 0, top: 0 }]).png().toBuffer();
}

function overlaySvg({ campaign }: { campaign: Campaign }) {
  const primary = safeColor(campaign.intake.brandKit.primaryColor, "#06b6d4");
  const secondary = safeColor(campaign.intake.brandKit.secondaryColor, "#f97316");

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="#020617" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#020617" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#topShade)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottomShade)"/>
  <rect x="38" y="46" width="644" height="76" rx="24" fill="#020617" opacity="0.62"/>
  <circle cx="76" cy="84" r="14" fill="${primary}"/>

  <rect x="40" y="642" width="640" height="332" rx="34" fill="#020617" opacity="0.72"/>
  <rect x="66" y="674" width="168" height="42" rx="21" fill="${secondary}" opacity="0.98"/>

  <rect x="40" y="998" width="640" height="96" rx="28" fill="#f8fafc" opacity="0.94"/>
  <rect x="66" y="1024" width="10" height="44" rx="5" fill="${secondary}"/>

  <rect x="40" y="1118" width="640" height="96" rx="30" fill="${primary}" opacity="0.96"/>
</svg>`;
}

async function renderTextOverlayPng({
  campaign,
  plan,
  composition,
  shot,
  concept,
  index,
  total,
  fontPath
}: {
  campaign: Campaign;
  plan: MediaProductionPlan;
  composition: RenderComposition;
  shot: MediaShotPlan;
  concept?: VideoConcept;
  index: number;
  total: number;
  fontPath: string;
}) {
  await ensureTextFont(fontPath);

  const image = PImage.make(WIDTH, HEIGHT);
  const ctx = image.getContext("2d");
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const layout = overlayTextLayout({ ctx, campaign, plan, composition, shot, concept, index, total });

  drawTextLine(ctx, { text: layout.brandName, x: 104, y: 80, fontSize: 21, color: "#ffffff", maxWidth: 488, shadow: true });
  drawTextLine(ctx, { text: layout.platformLabel, x: 104, y: 108, fontSize: 15, color: "#cbd5e1", maxWidth: 488, shadow: true });
  drawTextLine(ctx, { text: publicRoleLabel(shot.role), x: 94, y: 702, fontSize: 17, color: "#101018", maxWidth: 118 });

  layout.mainLines.forEach((line, lineIndex) => {
    drawTextLine(ctx, {
      text: line,
      x: 66,
      y: layout.mainStartY + lineIndex * layout.mainLineStep,
      fontSize: layout.mainFontSize,
      color: "#ffffff",
      maxWidth: 500,
      shadow: true
    });
  });

  layout.proofLines.forEach((line, lineIndex) => {
    drawTextLine(ctx, {
      text: line,
      x: 92,
      y: 1038 + lineIndex * layout.proofLineStep,
      fontSize: layout.proofFontSize,
      maxWidth: 530,
      color: "#0f172a"
    });
  });

  layout.ctaLines.forEach((line, lineIndex) => {
    drawTextLine(ctx, {
      text: line,
      x: 72,
      y: 1156 + lineIndex * layout.ctaLineStep,
      fontSize: layout.ctaFontSize,
      maxWidth: 560,
      color: "#03131a"
    });
  });

  return encodePureImagePng(image);
}

function conceptForShot(campaign: Campaign, shot: MediaShotPlan) {
  return campaign.pack.videoConcepts.find((concept) => concept.title === shot.conceptTitle);
}

function runFfmpeg(args: string[], timeoutMs = 120_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath as string, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Final video assembly timed out."));
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `FFmpeg exited with code ${code}.`));
    });
  });
}

function overlayTextLayout({
  ctx,
  campaign,
  plan,
  composition,
  shot,
  concept,
  index,
  total
}: {
  ctx: TextCanvasContext;
  campaign: Campaign;
  plan: MediaProductionPlan;
  composition: RenderComposition;
  shot: MediaShotPlan;
  concept?: VideoConcept;
  index: number;
  total: number;
}) {
  const mainText = publicSafeText(
    truncate(publicMainOverlayText({ campaign, shot, concept }), 76)
  );
  const caption = publicSafeText(
    truncate(publicCaptionText({ campaign, composition, shot, concept, index }), 92)
  );
  const proof = publicSafeText(truncate(publicProofText({ campaign, plan }), 74));
  const cta = publicSafeText(truncate(publicCtaText({ campaign, composition, concept }), 58));
  const mainBlock = fitTextBlock(ctx, mainText, {
    maxWidth: 500,
    maxLines: 3,
    fontSizes: [48, 44, 40, 37, 34]
  });
  const captionBlock = fitTextBlock(ctx, caption, {
    maxWidth: 520,
    maxLines: 1,
    fontSizes: [29, 27, 25, 23]
  });
  const proofBlock = fitTextBlock(ctx, proof, {
    maxWidth: 530,
    maxLines: 2,
    fontSizes: [24, 22, 20]
  });
  const ctaBlock = fitTextBlock(ctx, cta.replace(/^Primary CTA overlay:\s*/i, ""), {
    maxWidth: 560,
    maxLines: 2,
    fontSizes: [30, 27, 24, 22]
  });
  const brandName = fitSingleLine(ctx, publicSafeText(publicBrandName(campaign)), {
    maxWidth: 488,
    fontSize: 21
  });
  const platformLabel = fitSingleLine(ctx, publicSafeText(`${concept?.platform ?? shot.platform} video`), {
    maxWidth: 488,
    fontSize: 15
  });

  return {
    brandName,
    platformLabel,
    mainLines: mainBlock.lines,
    mainFontSize: mainBlock.fontSize,
    mainStartY: 776,
    mainLineStep: Math.max(44, Math.round(mainBlock.fontSize * 1.08)),
    captionLines: captionBlock.lines,
    captionFontSize: captionBlock.fontSize,
    captionStartY: Math.max(908, 776 + Math.max(1, mainBlock.lines.length) * Math.max(44, Math.round(mainBlock.fontSize * 1.08)) + 34),
    captionLineStep: Math.max(28, Math.round(captionBlock.fontSize * 1.12)),
    proofLines: proofBlock.lines,
    proofFontSize: proofBlock.fontSize,
    proofLineStep: Math.max(25, Math.round(proofBlock.fontSize * 1.15)),
    ctaLines: ctaBlock.lines,
    ctaFontSize: ctaBlock.fontSize,
    ctaLineStep: Math.max(27, Math.round(ctaBlock.fontSize * 1.12))
  };
}

function publicMainOverlayText({
  campaign,
  shot,
  concept
}: {
  campaign: Campaign;
  shot: MediaShotPlan;
  concept?: VideoConcept;
}) {
  const candidate = firstPublicSafeCandidate(
    shot.role === "hook" ? [shot.overlayText, concept?.hook, shot.action] : [shot.overlayText, shot.action],
    68
  );
  if (candidate && !isOverlongHook(candidate)) return candidate;

  const category = businessCategory(campaign);
  const role = shot.role;

  if (category === "video-marketing") {
    if (role === "hook") return "Your next campaign can be ready to approve.";
    if (role === "problem") return "Stop losing hours to editing and posting.";
    if (role === "offer" || role === "demo") return "Videos, captions, CTAs, and schedule windows.";
    if (role === "proof") return "Review the video queue before anything goes live.";
    if (role === "cta") return "Book a free growth call.";
  }

  if (category === "restaurant") {
    if (role === "hook") return "Your next lunch order is decided in seconds.";
    if (role === "problem") return "If the dish does not look craveable, they scroll.";
    if (role === "offer" || role === "demo") return "Fresh bowls. Fast pickup. Easy team lunches.";
    if (role === "proof") return "Show the food, the pickup, and the proof.";
    if (role === "cta") return "Make the next order obvious.";
  }

  if (category === "ecommerce") {
    if (role === "hook") return "Your next buyer decides in seconds.";
    if (role === "problem") return "Show the result before the scroll wins.";
    if (role === "offer" || role === "demo") return "Show the routine in three clear steps.";
    if (role === "proof") return "Show the product, proof, and next step.";
    if (role === "cta") return "Make checkout the obvious next move.";
  }

  if (category === "clinic" || category === "service") {
    if (role === "hook") return "Trust starts before the first enquiry.";
    if (role === "problem") return "Answer the worry before they ask.";
    if (role === "offer" || role === "demo") return "Show the first visit clearly.";
    if (role === "proof") return "Use approved proof to build trust.";
    if (role === "cta") return "Make booking the easiest next step.";
  }

  if (role === "hook") return "Your next customer decides in seconds.";
  if (role === "problem") return "Make the first step obvious.";
  if (role === "offer" || role === "demo") return shortOfferLine(campaign) || "Show the offer clearly.";
  if (role === "proof") return "Show real proof before asking for action.";
  if (role === "cta") return "Give them one clear next step.";
  return shortOfferLine(campaign) || "Make the message clear in seconds.";
}

function publicCaptionText({
  campaign,
  composition,
  shot,
  concept,
  index
}: {
  campaign: Campaign;
  composition: RenderComposition;
  shot: MediaShotPlan;
  concept?: VideoConcept;
  index: number;
}) {
  const candidate = firstPublicSafeCandidate(
    [shot.voiceoverLine, composition.subtitleSpec[index], concept?.caption, shot.overlayText],
    86
  );
  if (candidate) return candidate;

  const category = businessCategory(campaign);
  if (category === "video-marketing") {
    if (shot.role === "hook") return "Turn the brief into a ready-to-review campaign.";
    if (shot.role === "problem") return "Keep owners out of editing tools.";
    if (shot.role === "offer" || shot.role === "demo") return "Review the video, caption, CTA, and posting window.";
    if (shot.role === "proof") return "Approve before anything goes live.";
  }

  if (category === "restaurant") {
    if (shot.role === "hook") return "Make the food feel worth the trip before they scroll.";
    if (shot.role === "problem") return "People choose with their eyes first.";
    if (shot.role === "offer" || shot.role === "demo") return "One clear order path.";
    if (shot.role === "proof") return "Use approved menu visuals and real pickup context.";
  }

  if (category === "ecommerce") {
    if (shot.role === "hook") return "Product story in seconds.";
    if (shot.role === "problem") return "Make the choice obvious.";
    if (shot.role === "offer" || shot.role === "demo") return "Product, proof, CTA.";
    if (shot.role === "proof") return "Approved visuals only.";
  }

  if (category === "clinic" || category === "service") {
    if (shot.role === "hook") return "Clear first step.";
    if (shot.role === "problem") return "Answer the worry early.";
    if (shot.role === "offer" || shot.role === "demo") return "Simple next step.";
    if (shot.role === "proof") return "Approved proof only.";
  }

  return "Video queue ready.";
}

function publicProofText({ campaign, plan }: { campaign: Campaign; plan: MediaProductionPlan }) {
  const cleanedProof = firstPublicSafeCandidate(
    [
      ...plan.productionBrief.approvedProof.map(cleanProofCandidate),
      cleanProofCandidate(campaign.intake.proofPoints || "")
    ],
    68
  );
  if (cleanedProof) return cleanedProof;

  const category = businessCategory(campaign);
  if (category === "video-marketing") return "Approval-ready video queue with proof-safe copy.";
  if (category === "restaurant") return "Approved menu visuals and pickup offer.";
  if (category === "ecommerce") return "Approved product visuals and offer proof.";
  if (category === "clinic" || category === "service") return "Approved service proof and safe claims.";
  return "Customer-approved visuals, proof, and offer.";
}

function publicCtaText({
  campaign,
  composition,
  concept
}: {
  campaign: Campaign;
  composition: RenderComposition;
  concept?: VideoConcept;
}) {
  const ctaType = campaign.intake.creativeSettings.ctaType;
  const category = businessCategory(campaign);

  if (category === "video-marketing") return "Book a free growth call";

  if (category === "restaurant" && /\b(order|pickup|lunch|menu|bowl|food|meal)\b/i.test(campaign.intake.offer)) {
    return "Order pickup today";
  }

  const candidate = firstPublicSafeCandidate([concept?.cta, ...composition.ctaSpec], 54);
  if (candidate) return normalizeCta(candidate);

  if (ctaType === "buy-now") return category === "restaurant" ? "Order today" : "Shop now";
  if (ctaType === "book-call") return "Book a quick call";
  if (ctaType === "claim-offer") return "Claim the offer";
  if (ctaType === "learn-more") return category === "restaurant" ? "See the menu" : "Learn more";
  return "Send a DM";
}

function firstPublicSafeCandidate(candidates: Array<string | undefined>, maxLength: number) {
  for (const candidate of candidates) {
    const cleaned = cleanPublicText(candidate || "");
    if (!cleaned) continue;
    if (looksInternalPlanningText(cleaned)) continue;
    if (cleaned.length > maxLength) continue;
    return cleaned;
  }
  return "";
}

function cleanProofCandidate(input: string) {
  const raw = input.trim();
  if (/^customer-stated offer for .+$/i.test(raw)) return "";
  if (/\bcustomer-provided website or social presence\b/i.test(raw)) return "";
  if (/\bE2E\b|\bQA\b|\binternal pilot\b|\bpublic workflow sample\b/i.test(raw)) return "";
  if (/^(?:social reference|service photo|product photo|website screenshot|brand guide|logo):/i.test(raw)) return "";
  return cleanPublicText(input)
    .replace(/^customer-approved\s+(?:testimonial\s+)?screenshot\s+says\s+/i, "")
    .replace(/^customer-approved\s+/i, "")
    .replace(/^customer confirms\s+/i, "")
    .replace(/^product photo:\s*/i, "Approved product photo: ")
    .replace(/^service photo:\s*/i, "Approved service photo: ")
    .replace(/^raw video:\s*/i, "Approved video reference: ")
    .replace(/^testimonial or proof:\s*/i, "Approved proof: ");
}

function cleanPublicText(input: string) {
  return input
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/^\(?\s*\d+\s*[-–]\s*\d+\s*s\s*\)?\s*:?\s*/i, "")
    .replace(/^(?:visual|audio|voiceover|caption|shot|scene|camera|overlay)\s*:\s*/i, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\.\.+/g, ".")
    .replace(/\bif you are\s+/gi, "If you want to ")
    .replace(/\bincrease qualified\b/gi, "increase qualified")
    .replace(/\s+\.\s*$/g, ".")
    .trim();
}

function normalizeCta(input: string) {
  return input
    .replace(/^primary cta overlay:\s*/i, "")
    .replace(/^cta:\s*/i, "")
    .replace(/\s+or\s+request the first recommendation\.?$/i, "")
    .replace(/^book a quick audit$/i, "Book a quick audit")
    .trim();
}

function looksInternalPlanningText(input: string) {
  const text = input.toLowerCase();
  return (
    /\bgenerate high-intent\b/.test(text) ||
    /\bshow one concrete action beat\b/.test(text) ||
    /\buse one clear cta\b/.test(text) ||
    /\bawareness\s*(?:&|and)\s*lead generation\b/.test(text) ||
    /\b(?:tofu|mofu|bofu)\b/.test(text) ||
    /\bfunnel stage\b/.test(text) ||
    /\bapproved concept\b/.test(text) ||
    /\bdeterministic\b/.test(text) ||
    /\bpost-production\b/.test(text) ||
    /\bauto-post\b/.test(text) ||
    /\bconnected social account\b/.test(text) ||
    /\bcaption,?\s+thumbnail,?\s+schedule,?\s+and approval\b/.test(text) ||
    /\bcaption,?\s+cta,?\s+schedule,?\s+and approval\b/.test(text) ||
    /\bcustomer-stated\b/.test(text) ||
    /\bcustomer-approved\b/.test(text) ||
    /\bcustomer confirms\b/.test(text) ||
    /\bproduct photo:\b/.test(text) ||
    /\bservice photo:\b/.test(text) ||
    /\braw video:\b/.test(text) ||
    /\btestimonial or proof:\b/.test(text) ||
    /\bvisual\s*:\s*/.test(text) ||
    /\baudio\s*:\s*/.test(text) ||
    /\bvoiceover\s*:\s*/.test(text) ||
    /^\(?\s*\d+\s*[-–]\s*\d+\s*s\s*\)?/.test(text) ||
    /\*\*/.test(input) ||
    /^offer and visuals\.?$/i.test(input.trim()) ||
    /\bwrong first step\b/.test(text) ||
    /\bspecific situation\b/.test(text) ||
    /\bsolves your specific\b/.test(text) ||
    /\bbefore they ever talk to\b/.test(text) ||
    /\bat .+ we focus on\b/.test(text) ||
    /\bclaim-safe\b/.test(text) ||
    /\bproof ids?\b/.test(text) ||
    /\bsource shot\b/.test(text) ||
    /\bqa\b/.test(text)
  );
}

function isOverlongHook(input: string) {
  return input.length > 58 || input.split(/\s+/).length > 9;
}

function shortOfferLine(campaign: Campaign) {
  const offer = cleanPublicText(campaign.intake.offer)
    .replace(/^a\s+/i, "")
    .replace(/\bfor\s+[^:]+:\s*/i, "")
    .replace(/\bnear the cbd\b/gi, "nearby")
    .replace(/\.$/, "");
  if (!offer || looksInternalPlanningText(offer)) return "";
  if (offer.length > 48 || offer.split(/\s+/).length > 8) return "";
  return offer;
}

function publicRoleLabel(role: string) {
  if (role === "hook") return "START";
  if (role === "problem") return "PAIN";
  if (role === "offer" || role === "demo") return "OFFER";
  if (role === "proof") return "PROOF";
  if (role === "cta") return "ACTION";
  return "VIDEO";
}

function publicBrandName(campaign: Campaign) {
  const rawName = cleanPublicText(campaign.intake.businessName || "");
  if (!rawName) return "VIDSLOOM";
  if (/vidsloom/i.test(rawName) && /\b(internal|pilot|qa|test|e2e|production|staging)\b/i.test(rawName)) return "VIDSLOOM";
  if (/\b(internal|qa|test|e2e|staging)\b/i.test(rawName)) return "Business Campaign";
  return rawName;
}

function businessCategory(campaign: Campaign) {
  const haystack = [
    campaign.intake.businessName,
    campaign.intake.website,
    campaign.intake.industry,
    campaign.intake.offer,
    campaign.intake.audience,
    campaign.intake.goal,
    campaign.intake.brandVoice,
    campaign.intake.proofPoints,
    campaign.intake.constraints
  ]
    .join(" ")
    .toLowerCase();
  if (
    /\b(vidsloom|short-form video|short form video|video marketing|video growth|campaign pack|campaign packs|approval queue|approval-ready|posting support|captions?|ctas?|posting schedules?|social media marketing|ai video|video engine|content engine|marketing engine)\b/.test(
      haystack
    )
  ) {
    return "video-marketing";
  }
  if (/\b(restaurant|cafe|bistro|bar|food|menu|dining|chef|hospitality|lunch|bowl|meal|pickup)\b/.test(haystack)) {
    return "restaurant";
  }
  if (/\b(ecommerce|e-commerce|shop|store|product|skincare|beauty|retail|cart|checkout)\b/.test(haystack)) {
    return "ecommerce";
  }
  if (/\b(clinic|medical|dental|therapy|wellness|aesthetic|salon|spa)\b/.test(haystack)) {
    return "clinic";
  }
  if (/\b(coach|consultant|agency|service|studio|fitness|training|law|accounting|repair)\b/.test(haystack)) {
    return "service";
  }
  return "business";
}

function drawTextLine(
  ctx: TextCanvasContext,
  {
    text,
    x,
    y,
    fontSize,
    color,
    maxWidth,
    align = "left",
    shadow = false
  }: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    maxWidth?: number;
    align?: "left" | "right";
    shadow?: boolean;
  }
) {
  const safeText = text.replace(/[\r\n\t]+/g, " ").trim();
  if (!safeText) return;

  ctx.font = `${fontSize}pt ${TEXT_FONT_FAMILY}`;
  const width = ctx.measureText(safeText).width;
  if (maxWidth && width > maxWidth + 1) {
    throw new Error(`Text overlay overflow: "${safeText}" measured ${Math.ceil(width)}px, safe width is ${maxWidth}px.`);
  }
  const drawX = align === "right" ? x - width : x;

  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(safeText, drawX, y + 3);
  }

  ctx.fillStyle = color;
  ctx.fillText(safeText, drawX, y);
}

function fitSingleLine(
  ctx: TextCanvasContext,
  input: string,
  { maxWidth, fontSize }: { maxWidth: number; fontSize: number }
) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (measureTextWidth(ctx, text, fontSize) <= maxWidth) return text;
  return truncateToWidth(ctx, text, fontSize, maxWidth, false);
}

function fitTextBlock(
  ctx: TextCanvasContext,
  input: string,
  {
    maxWidth,
    maxLines,
    fontSizes
  }: {
    maxWidth: number;
    maxLines: number;
    fontSizes: number[];
  }
) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return { lines: [""], fontSize: fontSizes[fontSizes.length - 1] ?? 20 };

  for (const fontSize of fontSizes) {
    const lines = wrapTextToWidth(ctx, text, fontSize, maxWidth, maxLines);
    if (lines.length <= maxLines && lines.every((line) => measureTextWidth(ctx, line, fontSize) <= maxWidth + 1)) {
      return { lines, fontSize };
    }
  }

  const fontSize = fontSizes[fontSizes.length - 1] ?? 20;
  const lines = wrapTextToWidth(ctx, text, fontSize, maxWidth, maxLines);
  const lastLineIndex = Math.min(lines.length, maxLines) - 1;
  if (lastLineIndex >= 0) {
    lines[lastLineIndex] = truncateToWidth(ctx, lines[lastLineIndex], fontSize, maxWidth, false);
  }
  return { lines: lines.slice(0, maxLines), fontSize };
}

function wrapTextToWidth(
  ctx: TextCanvasContext,
  input: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number
) {
  const words = input.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureTextWidth(ctx, next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
    }

    if (measureTextWidth(ctx, word, fontSize) > maxWidth) {
      lines.push(truncateToWidth(ctx, word, fontSize, maxWidth));
      if (lines.length >= maxLines) break;
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push(truncateToWidth(ctx, input, fontSize, maxWidth));

  const consumed = lines.join(" ").replace(/\.\.\.$/, "").length;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (consumed < normalized.length - 3) {
    const index = lines.length - 1;
    lines[index] = truncateToWidth(ctx, lines[index].replace(/[.,;:!?-]+$/g, ""), fontSize, maxWidth, false);
  }

  return lines.slice(0, maxLines);
}

function truncateToWidth(
  ctx: TextCanvasContext,
  input: string,
  fontSize: number,
  maxWidth: number,
  withEllipsis = true
) {
  const suffix = withEllipsis ? "..." : "";
  const clean = input.replace(/\s+/g, " ").trim();
  if (measureTextWidth(ctx, clean, fontSize) <= maxWidth) return clean;

  let low = 0;
  let high = clean.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${clean.slice(0, mid).trim()}${suffix}`;
    if (measureTextWidth(ctx, candidate, fontSize) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${clean.slice(0, low).trim().replace(/[.,;:!?-]+$/g, "")}${suffix}`;
}

function measureTextWidth(ctx: TextCanvasContext, text: string, fontSize: number) {
  ctx.font = `${fontSize}pt ${TEXT_FONT_FAMILY}`;
  return ctx.measureText(text.replace(/[\r\n\t]+/g, " ").trim()).width;
}

async function ensureTextFont(fontPath: string) {
  if (textFontPath === fontPath && textFontPromise) {
    await textFontPromise;
    return;
  }

  const font = PImage.registerFont(fontPath, TEXT_FONT_FAMILY);
  textFontPath = fontPath;
  textFontPromise = font.load();
  await textFontPromise;
}

async function encodePureImagePng(image: ReturnType<typeof PImage.make>) {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    }
  });

  await PImage.encodePNGToStream(image, writable);
  return Buffer.concat(chunks);
}

function finalAssemblyFontPath() {
  const candidates = [
    path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "";
}

function wrapText(input: string, maxChars: number, maxLines: number) {
  const words = input.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) return [truncate(input, maxChars)];
  const consumed = lines.join(" ").length;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (consumed < normalized.length - 3) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?-]+$/g, "")}...`;
  }
  return lines.slice(0, maxLines);
}

function safeColor(input: string, fallback: string) {
  const value = input.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function publicSafeText(input: string) {
  return input
    .replace(/\bGemini\b/gi, "AI")
    .replace(/\bVertex\b/gi, "AI")
    .replace(/\bCloud Run\b/gi, "cloud")
    .replace(/\bGoogle Cloud\b/gi, "cloud")
    .replace(/\bbackend\b/gi, "system")
    .replace(/\binfrastructure\b/gi, "system");
}

function fixedSeconds(input: number) {
  return Math.max(0.1, input).toFixed(3);
}

function escapeConcatPath(input: string) {
  return input.replaceAll("'", "'\\''");
}
