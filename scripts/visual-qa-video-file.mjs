#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, ".vidsloom-qa", "video-file-frames");
const ffmpeg = ffmpegStatic || "ffmpeg";
const ffprobe = "ffprobe";
const forbiddenPublicTerms = /\b(Gemini|Vertex|Cloud Run|Google Cloud|backend|infrastructure|highest-quality)\b/i;
const files = process.argv.slice(2).map((file) => resolve(file));

if (!files.length) {
  console.error("Usage: npm run visual:video-file -- path/to/video.mp4 [path/to/another.mp4]");
  process.exit(2);
}

mkdirSync(outputDir, { recursive: true });

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe" });
}

function probeVideo(file) {
  const raw = run(ffprobe, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration,avg_frame_rate",
    "-of",
    "json",
    file
  ]);
  return JSON.parse(raw).streams?.[0] ?? {};
}

function createContactSheet(file, output) {
  execFileSync(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    file,
    "-vf",
    "fps=1/1.8,scale=220:-1,tile=4x2:padding=10:margin=10:color=white",
    "-frames:v",
    "1",
    output
  ]);
}

function createStill(file, output) {
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", "00:00:01", "-i", file, "-frames:v", "1", output]);
}

const failures = [];
const rows = [];

for (const file of files) {
  if (!existsSync(file)) {
    failures.push(`${file} does not exist.`);
    continue;
  }

  const name = basename(file, ".mp4").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const sheetPath = join(outputDir, `${name}-contact.png`);
  const stillPath = join(outputDir, `${name}-still.png`);
  const metadata = probeVideo(file);
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  const duration = Number.parseFloat(metadata.duration ?? "0");

  createContactSheet(file, sheetPath);
  createStill(file, stillPath);

  if (width !== 720 || height !== 1280) failures.push(`${basename(file)} is ${width}x${height}, expected 720x1280.`);
  if (!Number.isFinite(duration) || duration < 2 || duration > 60) {
    failures.push(`${basename(file)} duration is ${duration.toFixed(2)}s, expected 2-60s for reviewable generated output.`);
  }
  if (forbiddenPublicTerms.test(basename(file))) failures.push(`${basename(file)} includes a public-forbidden provider/infra term.`);

  rows.push({ file, width, height, duration, frameRate: metadata.avg_frame_rate ?? "", sheetPath, stillPath });
}

const report = [
  "# VIDSLOOM Generated Video File QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "Automated gates:",
  "- Video must be 720x1280 vertical MP4 before it can be considered for landing pages.",
  "- Generated-review videos should be 2-60 seconds.",
  "- Public filenames must not expose provider, model, cloud, or infrastructure terms.",
  "",
  "Manual visual gate:",
  "- Open every contact sheet and still frame below.",
  "- Reject unreadable placeholder text, symbol bars, fake UI gibberish, malformed hands/faces, low-quality crops, low contrast, or mobile-unreadable copy.",
  "- Do not promote a generated video to public pages unless the first three seconds look premium and business-relevant.",
  "",
  ...rows.flatMap((row) => [
    `## ${basename(row.file)}`,
    "",
    `Metadata: ${row.width}x${row.height}, ${row.duration.toFixed(2)}s, ${row.frameRate}`,
    "",
    `Contact sheet: ${row.sheetPath}`,
    `Still frame: ${row.stillPath}`,
    ""
  ])
].join("\n");

writeFileSync(join(outputDir, "README.md"), report);
console.log(report);

if (failures.length) {
  console.error("\nVideo file QA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
