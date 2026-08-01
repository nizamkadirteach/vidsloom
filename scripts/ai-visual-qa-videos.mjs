#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const samplesDir = join(root, "public", "samples");
const framesDir = join(root, ".vidsloom-qa", "video-frames");
const reportJsonPath = join(framesDir, "ai-visual-qa-report.json");
const reportMdPath = join(framesDir, "AI_VISUAL_QA.md");
const defaultModel = process.env.VIDSLOOM_VISUAL_QA_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallbackModel = process.env.VIDSLOOM_VISUAL_QA_FALLBACK_MODEL || process.env.GEMINI_FALLBACK_MODEL || "";

function shouldUseEnterpriseGemini() {
  return process.env.GOOGLE_GENAI_USE_ENTERPRISE === "true" || process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
}

function cloudProject() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "";
}

function cloudLocation() {
  return process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
}

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function createClient() {
  if (shouldUseEnterpriseGemini()) {
    const project = cloudProject();
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for enterprise visual QA.");
    return new GoogleGenAI({
      enterprise: true,
      project,
      location: cloudLocation(),
      apiVersion: "v1"
    });
  }

  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required for visual QA.");
  return new GoogleGenAI({ apiKey });
}

function imagePart(file) {
  return {
    inlineData: {
      mimeType: "image/png",
      data: readFileSync(file).toString("base64")
    }
  };
}

function isTransient(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("AbortError") ||
    message.includes("operation was aborted") ||
    message.includes('"code":429') ||
    message.includes('"code":500') ||
    message.includes('"code":503') ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE_EXCEEDED")
  );
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`Visual QA response was not JSON: ${text.slice(0, 500)}`);
  return text.slice(start, end + 1);
}

async function generateJson(ai, model, contents) {
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      httpOptions: { timeout: 120000 }
    }
  });
  return JSON.parse(extractJsonObject(response.text || "{}"));
}

async function generateJsonWithFallback(ai, contents) {
  try {
    return await generateJson(ai, defaultModel, contents);
  } catch (error) {
    if (!fallbackModel || fallbackModel === defaultModel || !isTransient(error)) throw error;
    return generateJson(ai, fallbackModel, contents);
  }
}

function posterPathFor(videoName) {
  const directPoster = join(samplesDir, `${videoName}-poster.png`);
  if (existsSync(directPoster)) return directPoster;
  return join(samplesDir, `${videoName.replace(/-sample$/, "").replace(/-loop$/, "")}-poster.png`);
}

function ensureContactSheets() {
  const readme = join(framesDir, "README.md");
  if (existsSync(readme)) return;
  execFileSync(process.execPath, [join(root, "scripts", "visual-qa-videos.mjs")], { stdio: "inherit" });
}

function collectVideos() {
  return readdirSync(samplesDir)
    .filter((file) => file.endsWith(".mp4") && !file.startsWith("._"))
    .sort()
    .map((file) => {
      const name = basename(file, ".mp4");
      return {
        file,
        name,
        contactSheet: join(framesDir, `${name}-contact.png`),
        still: join(framesDir, `${name}-still.png`),
        poster: posterPathFor(name)
      };
    });
}

function validateInputs(videos) {
  const missing = [];
  for (const video of videos) {
    if (!existsSync(video.contactSheet)) missing.push(video.contactSheet);
    if (!existsSync(video.still)) missing.push(video.still);
    if (!existsSync(video.poster)) missing.push(video.poster);
  }
  if (missing.length) {
    throw new Error(`Missing visual QA images. Run npm run visual:videos first.\n${missing.join("\n")}`);
  }
}

function visualQaPrompt(video) {
  return `You are VIDSLOOM's senior visual quality director and conversion-focused short-form video QA reviewer.

Review the attached contact sheet, one-second still frame, and poster for ${video.file}. Be strict. VIDSLOOM is a media company; the work must look premium enough for a customer-facing homepage.

Fail the video if you see any of these:
- text overflowing outside its card, frame, button, or safe area
- clipped letters, hidden words, cropped captions, or text too close to an edge
- unreadable text on mobile, tiny captions, low contrast, or dense copy
- weird symbols, glyph bars, random marks, fake UI gibberish, placeholder text, or malformed words
- warped faces/hands/products, ugly crops, visual artifacts, or low-quality generated frames
- poster frame does not match the video style
- the first three seconds do not look strong enough for a media-company landing page

Do not be polite. Do not reward intent. Only pass it if the visuals actually look clean, premium, readable, and customer-ready.
Use 0-100 numeric scoring only. firstThreeSecondImpact must be 0-100, where 0 is unusable and 100 is excellent. Do not use a 1-5 or 1-10 scale.

Return strict JSON only:
{
  "verdict": "pass" | "fail",
  "score": 0,
  "textOverflow": false,
  "clippedText": false,
  "unreadableText": false,
  "symbolArtifacts": false,
  "fakeUiOrGibberish": false,
  "uglyCropOrComposition": false,
  "visualArtifacts": false,
  "posterMismatch": false,
  "firstThreeSecondImpact": 0,
  "failures": ["specific issue with frame/area if any"],
  "warnings": ["specific non-blocking concern if any"],
  "notes": "one concise expert assessment"
}`;
}

function normalizeFinding(video, raw) {
  const failures = Array.isArray(raw.failures) ? raw.failures.map(String).filter(Boolean) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [];
  let firstThreeSecondImpact = Number(raw.firstThreeSecondImpact ?? 0);
  const blockingFlags = [
    "textOverflow",
    "clippedText",
    "unreadableText",
    "symbolArtifacts",
    "fakeUiOrGibberish",
    "uglyCropOrComposition",
    "visualArtifacts",
    "posterMismatch"
  ].filter((key) => raw[key] === true);
  const score = Number(raw.score ?? 0);
  if (raw.verdict === "pass" && score >= 85 && firstThreeSecondImpact > 0 && firstThreeSecondImpact <= 5 && !failures.length && !blockingFlags.length) {
    firstThreeSecondImpact = firstThreeSecondImpact * 20;
  }
  const verdict =
    raw.verdict === "pass" &&
    blockingFlags.length === 0 &&
    failures.length === 0 &&
    score >= 85 &&
    firstThreeSecondImpact >= 80
      ? "pass"
      : "fail";

  return {
    file: video.file,
    verdict,
    score,
    firstThreeSecondImpact,
    textOverflow: raw.textOverflow === true,
    clippedText: raw.clippedText === true,
    unreadableText: raw.unreadableText === true,
    symbolArtifacts: raw.symbolArtifacts === true,
    fakeUiOrGibberish: raw.fakeUiOrGibberish === true,
    uglyCropOrComposition: raw.uglyCropOrComposition === true,
    visualArtifacts: raw.visualArtifacts === true,
    posterMismatch: raw.posterMismatch === true,
    failures: failures.length
      ? failures
      : blockingFlags.map((flag) => `Visual QA flagged ${flag}.`),
    warnings,
    notes: String(raw.notes || "").trim()
  };
}

function renderMarkdown(report) {
  return [
    "# VIDSLOOM AI Visual QA",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall verdict: ${report.verdict.toUpperCase()}`,
    `Videos reviewed: ${report.findings.length}`,
    "",
    ...report.findings.flatMap((finding) => [
      `## ${finding.file}`,
      "",
      `Verdict: ${finding.verdict.toUpperCase()}`,
      `Score: ${finding.score}`,
      `First-three-second impact: ${finding.firstThreeSecondImpact}`,
      `Notes: ${finding.notes || "n/a"}`,
      "",
      finding.failures.length ? `Failures:\n${finding.failures.map((item) => `- ${item}`).join("\n")}` : "Failures: none",
      "",
      finding.warnings.length ? `Warnings:\n${finding.warnings.map((item) => `- ${item}`).join("\n")}` : "Warnings: none",
      ""
    ])
  ].join("\n");
}

mkdirSync(framesDir, { recursive: true });
ensureContactSheets();
const videos = collectVideos();
validateInputs(videos);
const ai = createClient();

const findings = [];
for (const video of videos) {
  const raw = await generateJsonWithFallback(ai, [
    { text: visualQaPrompt(video) },
    { text: "Contact sheet: eight sampled frames from the public landing-page video." },
    imagePart(video.contactSheet),
    { text: "Still frame: one-second frame used to inspect the first-three-second impression." },
    imagePart(video.still),
    { text: "Poster frame shown before playback." },
    imagePart(video.poster)
  ]);
  findings.push(normalizeFinding(video, raw));
}

const report = {
  generatedAt: new Date().toISOString(),
  verdict: findings.every((finding) => finding.verdict === "pass") ? "pass" : "fail",
  findings
};

writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
writeFileSync(reportMdPath, renderMarkdown(report));
console.log(renderMarkdown(report));

if (report.verdict !== "pass") {
  console.error(`\nAI visual QA failed. See ${reportMdPath}`);
  process.exit(1);
}
