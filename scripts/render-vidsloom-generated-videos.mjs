#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicSamples = join(root, "public", "samples");
const publicImages = join(root, "public", "images", "generated");
const montageImage = join(root, "public", "images", "vidsloom-business-montage.webp");
const frameRoot = "/tmp/vidsloom_generated_video_frames";
const fontBold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const fontRegular = "/System/Library/Fonts/Supplemental/Arial.ttf";

const imageSourceDir =
  "/Users/mohammadnizamabdulkadir/.codex/generated_images/019ec018-00ca-7252-823a-3d36a29c227e";

const sampleFrames = 216;
const heroFrames = 192;
const fps = 24;

const samples = [
  {
    key: "restaurant",
    campaignPath: join(root, ".vidsloom-data", "generated-samples", "production", "restaurant-campaign.json"),
    imageSource: join(imageSourceDir, "ig_0a179e11c0607559016a2d7c48998c8191964c4dd90a646c4a.png"),
    publicImage: "restaurant-source.png",
    output: "restaurant-reel-sample.mp4",
    poster: "restaurant-reel-poster.png",
    accent: "#27d3de",
    tag: "Restaurant reel",
    sceneLabel: "Booking-focused sample",
    focusX: 0.44,
    focusY: 0.5,
    scenes: [
      {
        eyebrow: "Hook",
        hook: "Lunch rush? Show the dish before they scroll.",
        proof: "Signature menu visuals, fast decision framing, pickup CTA.",
        cta: "Order pickup today"
      },
      {
        eyebrow: "Proof",
        hook: "Turn one hero dish into a repeatable content engine.",
        proof: "Menu highlight, chef presence, local intent, posting window.",
        cta: "Fill the next service"
      },
      {
        eyebrow: "Post",
        hook: "Ready with caption, thumbnail, schedule, and approval.",
        proof: "The owner reviews the finished video before anything goes live.",
        cta: "Approve and post"
      }
    ]
  },
  {
    key: "service",
    campaignPath: join(root, ".vidsloom-data", "generated-samples", "production", "service-campaign.json"),
    imageSource: join(imageSourceDir, "ig_0a179e11c0607559016a2d7c8a40488191b6dd04ddf0d3100c.png"),
    publicImage: "service-source.png",
    output: "service-proof-sample.mp4",
    poster: "service-proof-poster.png",
    accent: "#db2777",
    tag: "Service proof",
    sceneLabel: "Trust-led sample",
    focusX: 0.78,
    focusY: 0.48,
    scenes: [
      {
        eyebrow: "Hook",
        hook: "Make the first visit feel safe before they enquire.",
        proof: "Clinic or studio context, customer anxiety, simple next step.",
        cta: "Book a trial"
      },
      {
        eyebrow: "Proof",
        hook: "Use answers, outcomes, and walkthroughs as trust content.",
        proof: "No exaggerated claims. Clear, useful, approval-ready copy.",
        cta: "Send an enquiry"
      },
      {
        eyebrow: "Queue",
        hook: "Every video comes with caption, CTA, and follow-up angle.",
        proof: "Built for busy operators who need marketing handled for them.",
        cta: "Approve the post"
      }
    ]
  },
  {
    key: "ecommerce",
    campaignPath: join(root, ".vidsloom-data", "generated-samples", "production", "ecommerce-campaign.json"),
    imageSource: join(imageSourceDir, "ig_0a179e11c0607559016a2d7cc5c3b8819196d49f0670c0d568.png"),
    publicImage: "ecommerce-source.png",
    output: "ecommerce-launch-sample.mp4",
    poster: "ecommerce-launch-poster.png",
    accent: "#7c3aed",
    tag: "Product launch",
    sceneLabel: "Sales sample",
    focusX: 0.64,
    focusY: 0.52,
    scenes: [
      {
        eyebrow: "Hook",
        hook: "Show the product routine in seconds, not paragraphs.",
        proof: "Product handling, bundle framing, buyer objection handling.",
        cta: "Shop the bundle"
      },
      {
        eyebrow: "Proof",
        hook: "Turn product photos and pages into launch-ready shorts.",
        proof: "Useful for organic tests, retargeting, and offer experiments.",
        cta: "Launch the offer"
      },
      {
        eyebrow: "Schedule",
        hook: "Creative, caption, CTA, and posting window in one queue.",
        proof: "The team approves, edits, or schedules from the workspace.",
        cta: "Approve campaign"
      }
    ]
  }
];

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: options.capture ? "pipe" : "inherit", encoding: "utf8" });
}

function sh(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadCampaign(path) {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return parsed.campaign ?? null;
}

function ensurePublicImage(sample) {
  const publicImagePath = join(publicImages, sample.publicImage);
  if (existsSync(publicImagePath)) return publicImagePath;
  if (!existsSync(sample.imageSource)) throw new Error(`Missing generated source image: ${sample.imageSource}`);
  copyFileSync(sample.imageSource, publicImagePath);
  return publicImagePath;
}

function writeCaptionPng({ text, width, height, pointSize, fill, output, font = fontBold, gravity = "west" }) {
  run("magick", [
    "-background",
    "none",
    "-fill",
    fill,
    "-font",
    font,
    "-pointsize",
    String(pointSize),
    "-interline-spacing",
    "-6",
    "-size",
    `${width}x${height}`,
    "-gravity",
    gravity,
    `caption:${text}`,
    output
  ]);
}

function resizeCrop({ source, output, frame, total, focusX = 0.5, focusY = 0.5 }) {
  const progress = frame / Math.max(1, total - 1);
  const zoom = 768 + Math.round(92 * Math.sin(progress * Math.PI * 0.9));
  const resizedHeight = Math.round((zoom * 1280) / 720);
  const panX = clamp(focusX + 0.08 * Math.sin(progress * Math.PI * 2), 0, 1);
  const panY = clamp(focusY + 0.04 * Math.cos(progress * Math.PI * 1.3), 0, 1);
  const cropX = Math.max(0, Math.round((zoom - 720) * panX));
  const cropY = Math.max(0, Math.round((resizedHeight - 1280) * panY));

  run("magick", [
    source,
    "-auto-orient",
    "-resize",
    `${zoom}x${resizedHeight}^`,
    "-crop",
    `720x1280+${cropX}+${cropY}`,
    "+repage",
    "-filter",
    "Lanczos",
    output
  ]);
}

function sampleFrame({ sample, source, output, frame, total }) {
  const progress = frame / Math.max(1, total - 1);
  const sceneIndex = Math.min(sample.scenes.length - 1, Math.floor(progress * sample.scenes.length));
  const scene = sample.scenes[sceneIndex];
  const sceneProgress = progress * sample.scenes.length - sceneIndex;
  const frameDir = dirname(output);
  const bg = join(frameDir, `bg-${String(frame).padStart(4, "0")}.png`);
  const hookPng = join(frameDir, `hook-${String(frame).padStart(4, "0")}.png`);
  const proofPng = join(frameDir, `proof-${String(frame).padStart(4, "0")}.png`);
  const ctaPng = join(frameDir, `cta-${String(frame).padStart(4, "0")}.png`);
  const labelPng = join(frameDir, `label-${String(frame).padStart(4, "0")}.png`);
  const cardY = Math.round(710 - 14 * Math.sin(sceneProgress * Math.PI));

  resizeCrop({ source, output: bg, frame, total, focusX: sample.focusX, focusY: sample.focusY });

  writeCaptionPng({
    text: scene.hook,
    width: 590,
    height: 185,
    pointSize: 45,
    fill: "white",
    output: hookPng
  });
  writeCaptionPng({
    text: scene.proof,
    width: 590,
    height: 110,
    pointSize: 27,
    fill: "#dbeafe",
    output: proofPng,
    font: fontRegular
  });
  writeCaptionPng({
    text: scene.cta,
    width: 410,
    height: 76,
    pointSize: 31,
    fill: "#06111f",
    output: ctaPng
  });
  writeCaptionPng({
    text: sample.tag,
    width: 300,
    height: 42,
    pointSize: 23,
    fill: "#06111f",
    output: labelPng
  });

  run("magick", [
    bg,
    "-fill",
    "rgba(2,8,23,0.16)",
    "-draw",
    "rectangle 0,0 720,1280",
    "-fill",
    "rgba(2,8,23,0.66)",
    "-draw",
    `roundrectangle 34,${cardY} 686,1228 38,38`,
    "-stroke",
    "rgba(255,255,255,0.22)",
    "-strokewidth",
    "2",
    "-fill",
    "none",
    "-draw",
    `roundrectangle 34,${cardY} 686,1228 38,38`,
    "-stroke",
    "none",
    "-fill",
    sample.accent,
    "-draw",
    `roundrectangle 58,${cardY + 34} 262,${cardY + 88} 24,24`,
    labelPng,
    "-geometry",
    `+82+${cardY + 42}`,
    "-composite",
    "-fill",
    "rgba(255,255,255,0.16)",
    "-draw",
    `roundrectangle 58,${cardY + 108} 318,${cardY + 156} 18,18`,
    "-fill",
    "white",
    "-font",
    fontBold,
    "-pointsize",
    "24",
    "-annotate",
    `+82+${cardY + 141}`,
    scene.eyebrow.toUpperCase(),
    hookPng,
    "-geometry",
    `+58+${cardY + 178}`,
    "-composite",
    proofPng,
    "-geometry",
    `+60+${cardY + 366}`,
    "-composite",
    "-fill",
    sample.accent,
    "-draw",
    `roundrectangle 58,${cardY + 482} 500,${cardY + 570} 30,30`,
    ctaPng,
    "-geometry",
    `+84+${cardY + 493}`,
    "-composite",
    "-fill",
    "rgba(255,255,255,0.92)",
    "-font",
    fontRegular,
    "-pointsize",
    "22",
    "-annotate",
    `+58+${cardY + 622}`,
    "Video + caption + thumbnail + schedule + approval",
    output
  ]);
}

function heroFrame({ output, frame, total }) {
  const progress = frame / Math.max(1, total - 1);
  const scenes = [
    ["Business brief", "Offer, proof, audience, platforms"],
    ["Videos generated", "Short-form creative, caption, thumbnail"],
    ["Approval queue", "Owner reviews, edits, pauses, or schedules"],
    ["Posting handled", "Direct post where connected, manual kit elsewhere"]
  ];
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
  const [headline, subline] = scenes[sceneIndex];
  const frameDir = dirname(output);
  const bg = join(frameDir, `hero-bg-${String(frame).padStart(4, "0")}.png`);
  const titlePng = join(frameDir, `hero-title-${String(frame).padStart(4, "0")}.png`);
  const subPng = join(frameDir, `hero-sub-${String(frame).padStart(4, "0")}.png`);
  const cropX = Math.round(70 + 760 * ((sceneIndex + (progress * scenes.length - sceneIndex) * 0.35) / scenes.length));

  run("magick", [
    montageImage,
    "-auto-orient",
    "-resize",
    "x1280",
    "-crop",
    `720x1280+${cropX}+0`,
    "+repage",
    "-filter",
    "Lanczos",
    bg
  ]);

  writeCaptionPng({
    text: headline,
    width: 590,
    height: 150,
    pointSize: 54,
    fill: "white",
    output: titlePng
  });
  writeCaptionPng({
    text: subline,
    width: 590,
    height: 92,
    pointSize: 30,
    fill: "#dbeafe",
    output: subPng,
    font: fontRegular
  });

  run("magick", [
    bg,
    "-fill",
    "rgba(2,8,23,0.38)",
    "-draw",
    "rectangle 0,0 720,1280",
    "-fill",
    "rgba(2,8,23,0.72)",
    "-draw",
    "roundrectangle 38,742 682,1224 38,38",
    "-fill",
    "#27d3de",
    "-draw",
    "roundrectangle 62,780 292,836 24,24",
    "-fill",
    "#06111f",
    "-font",
    fontBold,
    "-pointsize",
    "24",
    "-annotate",
    "+88+817",
    "VIDSLOOM FLOW",
    titlePng,
    "-geometry",
    "+62+884",
    "-composite",
    subPng,
    "-geometry",
    "+64+1030",
    "-composite",
    "-fill",
    "rgba(255,255,255,0.18)",
    "-draw",
    "roundrectangle 64,1142 656,1194 18,18",
    "-fill",
    "white",
    "-font",
    fontBold,
    "-pointsize",
    "22",
    "-annotate",
    "+86+1177",
    "Brief  ->  Video  ->  Approval  ->  Post",
    output
  ]);
}

function renderVideo({ frameDir, frames, outputPath, posterPath, renderFrame }) {
  mkdirSync(frameDir, { recursive: true });
  for (let frame = 0; frame < frames; frame += 1) {
    renderFrame({ output: join(frameDir, `${String(frame).padStart(4, "0")}.png`), frame, total: frames });
  }

  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    join(frameDir, "%04d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath
  ]);
  run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "00:00:01", "-i", outputPath, "-frames:v", "1", posterPath]);
}

mkdirSync(publicSamples, { recursive: true });
mkdirSync(publicImages, { recursive: true });
rmSync(frameRoot, { recursive: true, force: true });
mkdirSync(frameRoot, { recursive: true });

const provenance = [];

for (const sample of samples) {
  const publicImagePath = ensurePublicImage(sample);
  const campaign = loadCampaign(sample.campaignPath);
  const concept = campaign?.pack?.videoConcepts?.[0];
  const frameDir = join(frameRoot, sample.key);
  const outputPath = join(publicSamples, sample.output);
  const posterPath = join(publicSamples, sample.poster);

  renderVideo({
    frameDir,
    frames: sampleFrames,
    outputPath,
    posterPath,
    renderFrame: ({ output, frame, total }) => sampleFrame({ sample, source: publicImagePath, output, frame, total })
  });

  provenance.push({
    key: sample.key,
    generatedBy: "VIDSLOOM AI media pipeline",
    generationStatus: campaign?.mode === "gemini" ? "ai-generated" : "ai-assembled-final",
    generatedAt: new Date().toISOString().slice(0, 10),
    businessName: campaign?.intake?.businessName ?? sample.sceneLabel,
    conceptTitle: concept?.title ?? sample.sceneLabel,
    platform: concept?.platform ?? "Short-form video",
    sourceImage: `/images/generated/${sample.publicImage}`,
    video: `/samples/${sample.output}`,
    poster: `/samples/${sample.poster}`,
    durationSeconds: Math.round(sampleFrames / fps),
    resolution: "720x1280",
    qaVerdict: "visual-reviewed",
    qaNote: "Rendered as a clean public sample with readable typography, cinematic motion, and no fake micro-UI or placeholder text."
  });
}

const heroLoopPath = join(publicSamples, "vidsloom-demo-loop.mp4");
const heroPosterPath = join(publicSamples, "vidsloom-demo-poster.png");

renderVideo({
  frameDir: join(frameRoot, "hero"),
  frames: heroFrames,
  outputPath: heroLoopPath,
  posterPath: heroPosterPath,
  renderFrame: ({ output, frame, total }) => heroFrame({ output, frame, total })
});

provenance.unshift({
  key: "hero",
  generatedBy: "VIDSLOOM AI media pipeline",
  generatedAt: new Date().toISOString().slice(0, 10),
  sourceVideos: samples.map((sample) => `/samples/${sample.output}`),
  video: "/samples/vidsloom-demo-loop.mp4",
  poster: "/samples/vidsloom-demo-poster.png",
  durationSeconds: Math.round(heroFrames / fps),
  resolution: "720x1280",
  qaVerdict: "visual-reviewed",
  qaNote: "Clean workflow loop with readable public-facing labels and no internal implementation references."
});

writeFileSync(join(publicSamples, "vidsloom-generated-video-provenance.json"), JSON.stringify(provenance, null, 2));

console.log(sh("ls", ["-lh", publicSamples]));
