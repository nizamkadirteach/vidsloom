#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const samplesDir = join(root, "public", "samples");
const outputDir = join(root, ".vidsloom-qa", "video-frames");
const provenancePath = join(samplesDir, "vidsloom-generated-video-provenance.json");
const ffmpeg = ffmpegStatic || "ffmpeg";
const ffprobe = "ffprobe";
const forbiddenPublicTerms = /\b(Gemini|Vertex|Cloud Run|Google Cloud|backend|infrastructure|highest-quality|staging|Cloud Tasks)\b/i;
const forbiddenPublicStringValues = [
  /\bGemini\b/i,
  /\bVertex\b/i,
  /\bCloud Run\b/i,
  /\bGoogle Cloud\b/i,
  /\bCloud Tasks\b/i,
  /\bbackend\b/i,
  /\binfrastructure\b/i,
  /\bstaging\b/i,
  /\.run\.app\b/i,
  /\.vidsloom-qa\b/i,
  /\b[A-Za-z0-9_-]*QA\b/
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: options.binary ? undefined : "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
}

function probeVideo(file) {
  try {
    const raw = run(
      ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,duration,avg_frame_rate",
        "-of",
        "json",
        file
      ],
      { capture: true }
    );
    return JSON.parse(raw).streams?.[0] ?? {};
  } catch (error) {
    throw new Error(`Unable to inspect ${file}. Install ffprobe or fix the MP4. ${error.message}`);
  }
}

function createContactSheet(file, output) {
  run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    file,
    "-vf",
    "fps=1/1.5,scale=220:-1,tile=4x2:padding=10:margin=10:color=white",
    "-frames:v",
    "1",
    output
  ]);
}

function createStill(file, output) {
  run(ffmpeg, ["-y", "-loglevel", "error", "-ss", "00:00:01", "-i", file, "-frames:v", "1", output]);
}

async function inspectImage(file) {
  try {
    return await sharp(file).metadata();
  } catch (error) {
    throw new Error(`Unable to inspect ${file}. ${error.message}`);
  }
}

function readProvenance() {
  if (!existsSync(provenancePath)) {
    failures.push("public/samples/vidsloom-generated-video-provenance.json is missing.");
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(provenancePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    failures.push(`Video provenance JSON is invalid: ${error.message}`);
    return [];
  }
}

function collectStringValues(input, values = []) {
  if (typeof input === "string") values.push(input);
  if (Array.isArray(input)) input.forEach((item) => collectStringValues(item, values));
  if (input && typeof input === "object") {
    Object.values(input).forEach((value) => collectStringValues(value, values));
  }
  return values;
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const videos = readdirSync(samplesDir)
  .filter((file) => file.endsWith(".mp4") && !file.startsWith("._"))
  .sort()
  .map((file) => join(samplesDir, file));

if (!videos.length) throw new Error("No public sample videos found in public/samples.");

const reportRows = [];
const failures = [];
const provenance = readProvenance();
const provenanceTextValues = collectStringValues(provenance);

for (const value of provenanceTextValues) {
  const failedTerm = forbiddenPublicStringValues.find((pattern) => pattern.test(value));
  if (failedTerm) failures.push(`Public sample provenance contains internal/provider wording: "${value}".`);
}

for (const video of videos) {
  const name = basename(video, ".mp4");
  const publicVideoPath = `/samples/${basename(video)}`;
  const poster = join(samplesDir, `${name.replace(/-sample$/, "").replace(/-loop$/, "")}-poster.png`);
  const directPoster = join(samplesDir, `${name}-poster.png`);
  const posterPath = existsSync(directPoster) ? directPoster : poster;
  const sheetPath = join(outputDir, `${name}-contact.png`);
  const stillPath = join(outputDir, `${name}-still.png`);
  const metadata = probeVideo(video);
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  const duration = Number.parseFloat(metadata.duration ?? "0");
  const matchedProvenance = provenance.find((item) => item?.video === publicVideoPath);

  createContactSheet(video, sheetPath);
  createStill(video, stillPath);

  if (width !== 720 || height !== 1280) failures.push(`${basename(video)} is ${width}x${height}, expected 720x1280.`);
  if (duration < 6 || duration > 20) failures.push(`${basename(video)} duration is ${duration.toFixed(2)}s, expected 6-20s.`);
  if (forbiddenPublicTerms.test(name)) failures.push(`${basename(video)} includes a public-forbidden provider/infra term.`);
  if (!existsSync(posterPath)) {
    failures.push(`${basename(video)} has no matching poster PNG.`);
  } else {
    const posterMetadata = await inspectImage(posterPath);
    if (posterMetadata.width !== 720 || posterMetadata.height !== 1280) {
      failures.push(`${basename(posterPath)} is ${posterMetadata.width}x${posterMetadata.height}, expected 720x1280.`);
    }
  }
  if (!matchedProvenance) {
    failures.push(`${basename(video)} has no direct visual-reviewed provenance entry.`);
  } else if (matchedProvenance.qaVerdict !== "visual-reviewed") {
    failures.push(`${basename(video)} provenance qaVerdict is ${matchedProvenance.qaVerdict || "missing"}, expected visual-reviewed.`);
  }

  reportRows.push({
    video,
    poster: existsSync(posterPath) ? posterPath : "",
    width,
    height,
    duration,
    frameRate: metadata.avg_frame_rate ?? "",
    sheetPath,
    stillPath
  });
}

const report = [
  "# VIDSLOOM Video Visual QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "Automated gates:",
  "- Each public landing video must be 720x1280 vertical MP4.",
  "- Each video should be 6-20 seconds for landing-page autoplay.",
  "- Public filenames must not expose provider, model, cloud, or infrastructure terms.",
  "",
  "Manual visual gate for every release:",
  "- Open every contact sheet below before deployment.",
  "- Reject unreadable placeholder text, symbol bars, fake UI gibberish, warped faces/hands, ugly crops, low contrast, or text too small for mobile.",
  "- Confirm the first 3 seconds look premium enough for a media-company homepage.",
  "- Confirm posters match the actual video style.",
  "",
  ...reportRows.flatMap((row) => [
    `## ${basename(row.video)}`,
    "",
    `Metadata: ${row.width}x${row.height}, ${row.duration.toFixed(2)}s, ${row.frameRate}`,
    row.poster ? `Poster: ${row.poster}` : "Poster: missing",
    "",
    `Contact sheet: ${row.sheetPath}`,
    `Still frame: ${row.stillPath}`,
    ""
  ])
].join("\n");

writeFileSync(join(outputDir, "README.md"), report);

console.log(report);

if (failures.length) {
  console.error("\nVideo QA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
