#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import ffmpegStatic from "ffmpeg-static";
import * as PImage from "pureimage";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const proofDir =
  process.env.VIDSLOOM_GENERATED_RESTAURANT_DIR ||
  join(root, ".vidsloom-qa", "staging-proof", "20260618T084110Z");
const publicSamples = join(root, "public", "samples");
const outputPath = join(publicSamples, "restaurant-reel-sample.mp4");
const posterPath = join(publicSamples, "restaurant-reel-poster.png");
const provenancePath = join(publicSamples, "vidsloom-generated-video-provenance.json");
const ffmpeg = ffmpegStatic || "ffmpeg";
const width = 720;
const height = 1280;
const fps = 24;
const fontFamily = "VidsloomSampleSans";
const fontPath = join(root, "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans-Bold.ttf");

const shots = [
  {
    clip: join(proofDir, "clip-shot-1-3shot-restaurant.mp4"),
    role: "Hook",
    headline: "Your next lunch order is decided in seconds.",
    caption: "Make the food feel worth the trip before they scroll.",
    proof: "Approved menu visuals and pickup offer.",
    cta: "Order pickup today"
  },
  {
    clip: join(proofDir, "clip-shot-2-3shot-restaurant.mp4"),
    role: "Proof",
    headline: "If the dish does not look craveable, they scroll.",
    caption: "People choose with their eyes first.",
    proof: "Restaurant-specific b-roll, no generic stock UI.",
    cta: "See today's bowls"
  },
  {
    clip: join(proofDir, "clip-shot-3-3shot-restaurant.mp4"),
    role: "Post",
    headline: "Fresh bowls. Fast pickup. Easy team lunches.",
    caption: "Caption, thumbnail, schedule, and approval are ready.",
    proof: "The owner approves before it goes live.",
    cta: "Order pickup today"
  }
];

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function assertInputs() {
  if (!existsSync(fontPath)) throw new Error(`Missing font: ${fontPath}`);
  for (const shot of shots) {
    if (!existsSync(shot.clip)) throw new Error(`Missing generated clip: ${shot.clip}`);
  }
}

function baseOverlaySvg({ index, total }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020617" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#020617" stop-opacity="0.54"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#topShade)"/>
  <rect width="${width}" height="${height}" fill="url(#bottomShade)"/>
  <rect x="38" y="46" width="644" height="78" rx="24" fill="#020617" opacity="0.62"/>
  <circle cx="76" cy="84" r="14" fill="#27d3de"/>
  <rect x="40" y="704" width="640" height="320" rx="34" fill="#020617" opacity="0.74"/>
  <rect x="66" y="734" width="170" height="44" rx="22" fill="#27d3de" opacity="0.98"/>
  <rect x="40" y="1048" width="640" height="82" rx="26" fill="#f8fafc" opacity="0.94"/>
  <rect x="66" y="1072" width="10" height="36" rx="5" fill="#f97316"/>
  <rect x="40" y="1150" width="640" height="78" rx="28" fill="#27d3de" opacity="0.96"/>
  <text x="-9999" y="-9999">${index + 1}/${total}</text>
</svg>`;
}

async function renderOverlay({ shot, index, total, output }) {
  const baseOverlay = await sharp(Buffer.from(baseOverlaySvg({ index, total }))).png().toBuffer();
  const image = PImage.make(width, height);
  const ctx = image.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  draw(ctx, { text: "Harbour Bowl Kitchen", x: 104, y: 80, size: 21, color: "#ffffff", shadow: true });
  draw(ctx, { text: "Instagram Reel", x: 104, y: 108, size: 15, color: "#cbd5e1", shadow: true });
  draw(ctx, { text: `${index + 1}/${total}`, x: 668, y: 94, size: 16, color: "#ffffff", align: "right", shadow: true });
  draw(ctx, { text: shot.role.toUpperCase(), x: 92, y: 764, size: 17, color: "#06111f" });

  wrap(shot.headline, 22, 3).forEach((line, lineIndex) => {
    draw(ctx, { text: line, x: 66, y: 838 + lineIndex * 46, size: 45, color: "#ffffff", shadow: true });
  });
  wrap(shot.caption, 29, 2).forEach((line, lineIndex) => {
    draw(ctx, { text: line, x: 68, y: 964 + lineIndex * 30, size: 25, color: "#dbeafe", shadow: true });
  });
  wrap(shot.proof, 31, 2).forEach((line, lineIndex) => {
    draw(ctx, { text: line, x: 92, y: 1084 + lineIndex * 28, size: 23, color: "#0f172a" });
  });
  wrap(shot.cta, 23, 1).forEach((line, lineIndex) => {
    draw(ctx, { text: line, x: 72, y: 1198 + lineIndex * 28, size: 28, color: "#03131a" });
  });
  draw(ctx, { text: "VIDSLOOM", x: 52, y: 1248, size: 16, color: "#ffffff", shadow: true });
  draw(ctx, {
    text: "video + caption + schedule",
    x: 668,
    y: 1248,
    size: 15,
    color: "#ffffff",
    align: "right",
    shadow: true
  });

  const textOverlay = await encodePng(image);
  await sharp(baseOverlay).composite([{ input: textOverlay, left: 0, top: 0 }]).png().toFile(output);
}

function draw(ctx, { text, x, y, size, color, align = "left", shadow = false }) {
  ctx.font = `${size}pt ${fontFamily}`;
  const cleanText = text.replace(/[\r\n\t]+/g, " ").trim();
  if (!cleanText) return;
  const measured = ctx.measureText(cleanText).width;
  const drawX = align === "right" ? x - measured : x;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.fillText(cleanText, drawX, y + 3);
  }
  ctx.fillStyle = color;
  ctx.fillText(cleanText, drawX, y);
}

function wrap(input, maxChars, maxLines) {
  const words = input.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
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
  return lines.slice(0, maxLines);
}

async function encodePng(image) {
  const chunks = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    }
  });
  await PImage.encodePNGToStream(image, writable);
  return Buffer.concat(chunks);
}

function updateProvenance() {
  const existing = existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, "utf8")) : [];
  const next = existing.filter((item) => item.key !== "restaurant");
  const restaurant = {
    key: "restaurant",
    generatedBy: "VIDSLOOM AI media pipeline",
    generationStatus: "ai-generated-staging-clips",
    generatedAt: new Date().toISOString().slice(0, 10),
    businessName: "Harbour Bowl Kitchen",
    conceptTitle: "Fresh bowl pickup offer",
    platform: "Instagram Reels",
    sourceVideos: shots.map((shot) => shot.clip.replace(`${root}/`, "")),
    video: "/samples/restaurant-reel-sample.mp4",
    poster: "/samples/restaurant-reel-poster.png",
    durationSeconds: 9,
    resolution: "720x1280",
    qaVerdict: "visual-reviewed",
    qaNote:
      "Assembled from actual VIDSLOOM-generated staging clips with clean public-facing overlays, no model or infrastructure references, and no internal planning copy."
  };
  const heroIndex = next.findIndex((item) => item.key === "hero");
  if (heroIndex >= 0) {
    next.splice(heroIndex + 1, 0, restaurant);
  } else {
    next.unshift(restaurant);
  }
  writeFileSync(provenancePath, `${JSON.stringify(next, null, 2)}\n`);
}

assertInputs();
mkdirSync(publicSamples, { recursive: true });
const font = PImage.registerFont(fontPath, fontFamily);
await font.load();

const tempDir = join(os.tmpdir(), `vidsloom-public-restaurant-${Date.now()}`);
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const segmentPaths = [];
for (const [index, shot] of shots.entries()) {
  const overlayPath = join(tempDir, `overlay-${index}.png`);
  const segmentPath = join(tempDir, `segment-${index}.mp4`);
  await renderOverlay({ shot, index, total: shots.length, output: overlayPath });
  run(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    shot.clip,
    "-i",
    overlayPath,
    "-filter_complex",
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},trim=duration=3,setpts=PTS-STARTPTS[base];[base][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
    "-map",
    "[v]",
    "-an",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-movflags",
    "+faststart",
    segmentPath
  ]);
  segmentPaths.push(segmentPath);
}

const concatPath = join(tempDir, "concat.txt");
writeFileSync(concatPath, segmentPaths.map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`).join("\n"));
run(ffmpeg, [
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
  "21",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  outputPath
]);

run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "0.5", "-i", outputPath, "-frames:v", "1", posterPath]);
await readFile(outputPath);
await readFile(posterPath);
updateProvenance();
rmSync(tempDir, { recursive: true, force: true });

console.log(`Updated ${outputPath}`);
console.log(`Updated ${posterPath}`);
console.log(`Updated ${provenancePath}`);
