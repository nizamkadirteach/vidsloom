#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const framesDir = join(root, ".vidsloom-qa", "video-file-frames");
const reportJsonPath = join(framesDir, "ai-video-file-qa-report.json");
const reportMdPath = join(framesDir, "AI_VIDEO_FILE_QA.md");
const defaultModel = process.env.VIDSLOOM_VISUAL_QA_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallbackModel = process.env.VIDSLOOM_VISUAL_QA_FALLBACK_MODEL || process.env.GEMINI_FALLBACK_MODEL || "";
const files = process.argv.slice(2).map((file) => resolve(file));

if (!files.length) {
  console.error("Usage: npm run visual:video-file:ai -- path/to/video.mp4 [path/to/another.mp4]");
  process.exit(2);
}

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
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for AI video-file QA.");
    return new GoogleGenAI({
      enterprise: true,
      project,
      location: cloudLocation(),
      apiVersion: "v1"
    });
  }

  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required for AI video-file QA.");
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

function frameNameFor(file) {
  return basename(file, ".mp4").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function ensureContactSheets() {
  mkdirSync(framesDir, { recursive: true });
  const missing = files.flatMap((file) => {
    const name = frameNameFor(file);
    return [join(framesDir, `${name}-contact.png`), join(framesDir, `${name}-still.png`)].filter(
      (candidate) => !existsSync(candidate)
    );
  });
  if (!missing.length) return;
  execFileSync(process.execPath, [join(root, "scripts", "visual-qa-video-file.mjs"), ...files], { stdio: "inherit" });
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
  if (start < 0 || end <= start) throw new Error(`AI video-file QA response was not JSON: ${text.slice(0, 500)}`);
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

function visualQaPrompt(file) {
  return `You are VIDSLOOM's senior visual quality director, mobile readability reviewer, and short-form video publishing gatekeeper.

Review the attached contact sheet and one-second still frame for this generated VIDSLOOM video file: ${basename(file)}.

Fail the video if you see any of these:
- text overflowing outside its card, frame, button, caption area, or safe area
- clipped letters, hidden words, cropped captions, or text too close to an edge
- unreadable text on mobile, tiny captions, low contrast, dense copy, or awkward wrapping
- weird symbols, square glyphs, glyph bars, random marks, fake UI gibberish, placeholder text, or malformed words
- warped faces/hands/products, ugly crops, visual artifacts, bad generated motion, or low-quality frames
- first-three-second hook that does not look premium enough for a media company selling video marketing
- customer-facing copy that exposes provider/model/backend/cloud/infrastructure details

Treat this as a hard pre-publish gate. Do not reward intent. Only pass if the video looks clean, premium, readable, and ready to show a paying business owner.

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
  "providerOrInfrastructureLeak": false,
  "firstThreeSecondImpact": 0,
  "failures": ["specific issue with frame/area if any"],
  "warnings": ["specific non-blocking concern if any"],
  "notes": "one concise expert assessment"
}`;
}

function normalizeFinding(file, raw) {
  const failures = Array.isArray(raw.failures) ? raw.failures.map(String).filter(Boolean) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [];
  const blockingFlags = [
    "textOverflow",
    "clippedText",
    "unreadableText",
    "symbolArtifacts",
    "fakeUiOrGibberish",
    "uglyCropOrComposition",
    "visualArtifacts",
    "providerOrInfrastructureLeak"
  ].filter((key) => raw[key] === true);
  const score = Number(raw.score ?? 0);
  const firstThreeSecondImpact = Number(raw.firstThreeSecondImpact ?? 0);
  const verdict =
    raw.verdict === "pass" &&
    blockingFlags.length === 0 &&
    failures.length === 0 &&
    score >= 85 &&
    firstThreeSecondImpact >= 80
      ? "pass"
      : "fail";

  return {
    file,
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
    providerOrInfrastructureLeak: raw.providerOrInfrastructureLeak === true,
    failures: failures.length ? failures : blockingFlags.map((flag) => `AI visual QA flagged ${flag}.`),
    warnings,
    notes: String(raw.notes || "").trim()
  };
}

function renderMarkdown(report) {
  return [
    "# VIDSLOOM AI Video File QA",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall verdict: ${report.verdict.toUpperCase()}`,
    `Videos reviewed: ${report.findings.length}`,
    "",
    ...report.findings.flatMap((finding) => [
      `## ${basename(finding.file)}`,
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

for (const file of files) {
  if (!existsSync(file)) throw new Error(`${file} does not exist.`);
}

ensureContactSheets();
const ai = createClient();
const findings = [];

for (const file of files) {
  const name = frameNameFor(file);
  const raw = await generateJsonWithFallback(ai, [
    { text: visualQaPrompt(file) },
    { text: "Contact sheet: sampled frames across the generated video." },
    imagePart(join(framesDir, `${name}-contact.png`)),
    { text: "Still frame: one-second frame used to inspect the first-three-second impression." },
    imagePart(join(framesDir, `${name}-still.png`))
  ]);
  findings.push(normalizeFinding(file, raw));
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
  console.error(`\nAI video-file QA failed. See ${reportMdPath}`);
  process.exit(1);
}
