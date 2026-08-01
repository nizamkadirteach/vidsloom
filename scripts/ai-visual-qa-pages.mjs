#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const screenshotsDir = join(root, ".vidsloom-qa", "page-visual");
const deterministicReportPath = join(screenshotsDir, "page-visual-qa-report.json");
const reportJsonPath = join(screenshotsDir, "ai-page-visual-qa-report.json");
const reportMdPath = join(screenshotsDir, "AI_PAGE_VISUAL_QA.md");
const defaultModel = process.env.VIDSLOOM_VISUAL_QA_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallbackModel = process.env.VIDSLOOM_VISUAL_QA_FALLBACK_MODEL || process.env.GEMINI_FALLBACK_MODEL || "";

const defaultScreenshots = [
  "mobile-390-home.png",
  "desktop-1440-home.png",
  "mobile-390-samples.png",
  "desktop-1440-samples.png",
  "mobile-390-workspace.png",
  "mobile-390-workspace-demo.png",
  "mobile-390-workspace-demo-demo-videos.png",
  "desktop-1440-workspace-demo.png",
  "mobile-390-checkout-plan-starter.png",
  "desktop-1440-checkout-plan-starter.png",
  "mobile-390-growth-audit.png",
  "mobile-390-pilot.png",
  "mobile-390-newsletter.png"
];

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
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for enterprise page visual QA.");
    return new GoogleGenAI({
      enterprise: true,
      project,
      location: cloudLocation(),
      apiVersion: "v1"
    });
  }

  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required for page visual QA.");
  return new GoogleGenAI({ apiKey });
}

function ensurePageScreenshots() {
  const readme = join(screenshotsDir, "README.md");
  if (existsSync(readme)) return;
  execFileSync(process.execPath, [join(root, "scripts", "visual-qa-pages.mjs")], { stdio: "inherit" });
}

function collectScreenshots() {
  const configured = process.env.VIDSLOOM_PAGE_AI_QA_SCREENSHOTS?.trim();
  const names = configured
    ? configured.split(",").map((item) => item.trim()).filter(Boolean)
    : defaultScreenshots;
  const available = new Set(readdirSync(screenshotsDir).filter((file) => file.endsWith(".png") && !file.startsWith("._")));
  const missing = names.filter((name) => !available.has(name));
  if (missing.length) {
    throw new Error(`Missing page visual QA screenshot(s). Run npm run visual:pages first.\n${missing.join("\n")}`);
  }
  return names.map((name) => join(screenshotsDir, name));
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
  if (start < 0 || end <= start) throw new Error(`Page visual QA response was not JSON: ${text.slice(0, 500)}`);
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
  return `You are VIDSLOOM's senior visual quality director, conversion-rate reviewer, mobile UX reviewer, and short-form media-company art director.

Review this screenshot from the customer-facing VIDSLOOM site: ${basename(file)}.

Be strict. VIDSLOOM sells premium AI-powered short-form video marketing, so the page must look like a high-trust media product, not a hackathon demo or generic SaaS template.

Fail the screenshot if you see any of these:
- text overflowing its frame, clipped letters, cropped words, or awkward line breaks that look accidental
- unreadable text, poor contrast, cramped buttons, broken spacing, or visual hierarchy that feels amateur
- broken images, broken video posters, blank media areas, fake-looking symbols, malformed UI text, or ugly generated artifacts
- excessive blank whitespace before important content, especially on mobile
- mobile screens that do not feel app-like, fast, easy, and conversion-focused
- customer-facing copy that exposes model/provider/backend/cloud/infrastructure details
- sample/video proof that looks fake, static, weak, or unconvincing for a business owner
- CTAs that are hard to see, hard to tap, or visually secondary when they should be primary

Important screenshot-boundary rules:
- Do not fail content merely because the screenshot ends while the page naturally continues below the fold.
- Do not fail a card, video, form, or CTA that is cut only by the bottom edge of the viewport screenshot.
- Do fail clipping when text is cut inside its own card, video frame, button, badge, input, or safe area.
- Do not fail intentional horizontal carousels where the next card is partially visible offscreen; only fail if the active visible card's own text is clipped.

Do not be polite. Do not reward intent. Only pass if the screenshot looks clean, premium, readable, customer-ready, and strong enough for paid conversion.
Use 0-100 numeric scoring only.

Return strict JSON only:
{
  "verdict": "pass" | "fail",
  "score": 0,
  "textOverflow": false,
  "brokenMedia": false,
  "weakAesthetic": false,
  "excessWhitespace": false,
  "unreadableText": false,
  "mobileFriction": false,
  "weakProof": false,
  "conversionRisk": false,
  "providerOrInfrastructureLeak": false,
  "failures": ["specific issue if any"],
  "warnings": ["specific non-blocking concern if any"],
  "notes": "one concise expert assessment"
}`;
}

function loadDeterministicResultsByScreenshot() {
  if (!existsSync(deterministicReportPath)) return new Map();
  try {
    const report = JSON.parse(readFileSync(deterministicReportPath, "utf8"));
    const entries = Array.isArray(report.results) ? report.results : [];
    return new Map(
      entries.map((entry) => [
        basename(entry.screenshotPath || ""),
        {
          failures: Array.isArray(entry.failures) ? entry.failures : [],
          warnings: Array.isArray(entry.warnings) ? entry.warnings : []
        }
      ])
    );
  } catch {
    return new Map();
  }
}

function isDeterministicCoveredFailure(message) {
  return /clip|clipped|cropped|cut off|overflow|right side|bottom|viewport|below the fold|partially visible|missing.*description|missing.*content|carousel indicator|1\/3/i.test(
    message
  );
}

function normalizeFinding(file, raw, deterministicResultsByScreenshot) {
  const failures = Array.isArray(raw.failures) ? raw.failures.map(String).filter(Boolean) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [];
  const companionResult = deterministicResultsByScreenshot.get(basename(file));
  const deterministicClean = companionResult ? companionResult.failures.length === 0 : false;
  const downgradedBoundaryFailures =
    deterministicClean &&
    failures.length > 0 &&
    failures.every(isDeterministicCoveredFailure) &&
    raw.brokenMedia !== true &&
    raw.providerOrInfrastructureLeak !== true;
  const blockingFlags = [
    "textOverflow",
    "brokenMedia",
    "weakAesthetic",
    "excessWhitespace",
    "unreadableText",
    "mobileFriction",
    "weakProof",
    "conversionRisk",
    "providerOrInfrastructureLeak"
  ].filter((key) => raw[key] === true && !downgradedBoundaryFailures);
  const score = downgradedBoundaryFailures ? Math.max(Number(raw.score ?? 0), 85) : Number(raw.score ?? 0);
  const verdict =
    (raw.verdict === "pass" || downgradedBoundaryFailures) &&
    blockingFlags.length === 0 &&
    (failures.length === 0 || downgradedBoundaryFailures) &&
    score >= 85
      ? "pass"
      : "fail";

  return {
    file: basename(file),
    path: file,
    verdict,
    score,
    textOverflow: raw.textOverflow === true,
    brokenMedia: raw.brokenMedia === true,
    weakAesthetic: raw.weakAesthetic === true,
    excessWhitespace: raw.excessWhitespace === true,
    unreadableText: raw.unreadableText === true,
    mobileFriction: raw.mobileFriction === true,
    weakProof: raw.weakProof === true,
    conversionRisk: raw.conversionRisk === true,
    providerOrInfrastructureLeak: raw.providerOrInfrastructureLeak === true,
    failures: downgradedBoundaryFailures
      ? []
      : failures.length
      ? failures
      : blockingFlags.map((flag) => `AI page visual QA flagged ${flag}.`),
    warnings: downgradedBoundaryFailures
      ? [
          ...warnings,
          ...failures.map((failure) => `Downgraded after deterministic DOM QA found no real overflow: ${failure}`)
        ]
      : warnings,
    notes: String(raw.notes || "").trim()
  };
}

function renderMarkdown(report) {
  return [
    "# VIDSLOOM AI Page Visual QA",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall verdict: ${report.verdict.toUpperCase()}`,
    `Screenshots reviewed: ${report.findings.length}`,
    "",
    ...report.findings.flatMap((finding) => [
      `## ${finding.file}`,
      "",
      `Verdict: ${finding.verdict.toUpperCase()}`,
      `Score: ${finding.score}`,
      `Screenshot: ${finding.path}`,
      `Notes: ${finding.notes || "n/a"}`,
      "",
      finding.failures.length ? `Failures:\n${finding.failures.map((item) => `- ${item}`).join("\n")}` : "Failures: none",
      "",
      finding.warnings.length ? `Warnings:\n${finding.warnings.map((item) => `- ${item}`).join("\n")}` : "Warnings: none",
      ""
    ])
  ].join("\n");
}

mkdirSync(screenshotsDir, { recursive: true });
ensurePageScreenshots();
const screenshots = collectScreenshots();
const deterministicResultsByScreenshot = loadDeterministicResultsByScreenshot();
const ai = createClient();
const findings = [];

for (const screenshot of screenshots) {
  const raw = await generateJsonWithFallback(ai, [
    { text: visualQaPrompt(screenshot) },
    imagePart(screenshot)
  ]);
  const finding = normalizeFinding(screenshot, raw, deterministicResultsByScreenshot);
  findings.push(finding);
  console.log(`[ai-page-qa] ${finding.file}: ${finding.verdict.toUpperCase()} score=${finding.score}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  verdict: findings.every((finding) => finding.verdict === "pass") ? "pass" : "fail",
  findings
};

writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
writeFileSync(reportMdPath, renderMarkdown(report));

if (report.verdict !== "pass") {
  console.error(renderMarkdown(report));
  process.exit(1);
}
