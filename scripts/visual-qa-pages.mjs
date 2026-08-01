#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, ".vidsloom-qa", "page-visual");
const nextBuildIdPath = join(root, ".next", "BUILD_ID");
const baseUrlFromEnv = process.env.VIDSLOOM_PAGE_QA_BASE_URL?.trim();
const screenshotOnly = process.env.VIDSLOOM_PAGE_QA_SCREENSHOTS_ONLY === "true";
const chromeExecutable = findChromeExecutable();

const pages = parsePages();
const viewports = [
  { name: "mobile-390", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: "tablet-768", width: 768, height: 1024, isMobile: true, deviceScaleFactor: 2 },
  { name: "desktop-1440", width: 1440, height: 960, isMobile: false, deviceScaleFactor: 1 }
];

const allowedHorizontalScrollSelectors = [
  ".heroVideoRail",
  ".tabs",
  ".tableWrap",
  ".siteNav nav"
];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

let serverProcess = null;
let baseUrl = baseUrlFromEnv;

try {
  if (!chromeExecutable) {
    throw new Error("Chrome was not found. Set CHROME_BIN or PUPPETEER_EXECUTABLE_PATH for page visual QA.");
  }

  if (!baseUrl) {
    if (!existsSync(nextBuildIdPath)) {
      throw new Error("No .next production build found. Run npm run build before npm run visual:pages.");
    }
    const port = await getOpenPort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = startNextServer(port);
    await waitForHttp(`${baseUrl}/`, 90000);
  }

  const browser = await puppeteer.launch({
    executablePath: chromeExecutable,
    headless: "new",
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox"
    ]
  });

  const results = [];
  try {
    for (const viewport of viewports) {
      for (const pageTarget of pages) {
        results.push(await inspectPage(browser, viewport, pageTarget));
      }
    }
  } finally {
    await browser.close();
  }

  const failures = results.flatMap((result) => result.failures.map((failure) => ({ ...failure, result })));
  const warnings = results.flatMap((result) => result.warnings.map((warning) => ({ ...warning, result })));
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    chromeExecutable,
    verdict: failures.length ? "fail" : "pass",
    viewports,
    pages,
    results
  };

  writeFileSync(join(outputDir, "page-visual-qa-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outputDir, "README.md"), renderMarkdown(report, failures, warnings));
  console.log(renderConsoleSummary(report, failures, warnings));

  if (failures.length) process.exit(1);
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

function parsePages() {
  const configured = process.env.VIDSLOOM_PAGE_QA_PATHS?.trim();
  const rawPages = configured
    ? configured.split(",").map((item) => item.trim()).filter(Boolean)
    : [
        "/",
        "/#samples",
        "/#workspace",
        "/#pricing",
        "/pilot",
        "/growth-audit",
        "/workspace-demo",
        "/workspace-demo#demo-videos",
        "/checkout?plan=starter",
        "/newsletter",
        "/privacy",
        "/terms",
        "/refund",
        "/login"
      ];

  return rawPages.map((path) => ({
    path,
    label: labelForPath(path)
  }));
}

function labelForPath(path) {
  if (path === "/") return "home";
  return path
    .replace(/^\//, "")
    .replace(/[?#]/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "home";
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function startNextServer(port) {
  const child = spawn("npm", ["run", "start"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      VIDSLOOM_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
      VIDSLOOM_QA_USERNAME: process.env.VIDSLOOM_QA_USERNAME || "visual_qa",
      VIDSLOOM_QA_PASSWORD: process.env.VIDSLOOM_QA_PASSWORD || "visual_qa_password",
      VIDSLOOM_AUTH_SECRET: process.env.VIDSLOOM_AUTH_SECRET || "visual_qa_auth_secret"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => process.stdout.write(`[page-qa-server] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[page-qa-server] ${data}`));
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) process.stderr.write(`[page-qa-server] exited with code ${code}\n`);
    if (signal) process.stderr.write(`[page-qa-server] exited with signal ${signal}\n`);
  });
  return child;
}

async function getOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") reject(new Error("Unable to allocate an open port."));
        else resolve(address.port);
      });
    });
  });
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}. ${lastError instanceof Error ? lastError.message : ""}`);
}

async function inspectPage(browser, viewport, pageTarget) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!/favicon|net::ERR_ABORTED|ResizeObserver loop/i.test(text)) consoleErrors.push(text);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const url = new URL(pageTarget.path, baseUrl).toString();
  const screenshotPath = join(outputDir, `${viewport.name}-${pageTarget.label}.png`);
  const failures = [];
  const warnings = [];

  try {
    console.log(`[page-qa] ${viewport.name} ${pageTarget.path}`);
    await page.setViewport(viewport);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!response || response.status() >= 400) {
      failures.push(issue("http", `HTTP ${response?.status() ?? "no-response"} for ${url}`));
    }
    await settlePage(page);
    await loadMedia(page);
    await scrollToAnchor(page, pageTarget.path);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const inspected = await page.evaluate(runInBrowserQa, {
      viewportName: viewport.name,
      allowedHorizontalScrollSelectors
    });

    failures.push(...inspected.failures.map((item) => issue(item.type, item.message, item)));
    warnings.push(...inspected.warnings.map((item) => issue(item.type, item.message, item)));

    if (!screenshotOnly) {
      for (const error of consoleErrors.slice(0, 8)) {
        failures.push(issue("console-error", error));
      }
      for (const error of pageErrors.slice(0, 8)) {
        failures.push(issue("page-error", error));
      }
    }
  } catch (error) {
    failures.push(issue("inspection-error", error instanceof Error ? error.message : String(error)));
  } finally {
    await page.close();
  }

  return {
    viewport: viewport.name,
    path: pageTarget.path,
    label: pageTarget.label,
    url,
    screenshotPath,
    failures,
    warnings
  };
}

async function settlePage(page) {
  await page.evaluate(() => document.fonts?.ready);
  await delay(250);
  await page.evaluate(async () => {
    const step = Math.max(360, Math.floor(window.innerHeight * 0.92));
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y <= maxY; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    window.scrollTo(0, 0);
  });
  await delay(220);
}

async function loadMedia(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map((image) => {
        if (image.complete) return undefined;
        return new Promise((resolve) => {
          const done = () => resolve(undefined);
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          setTimeout(done, 1200);
        });
      })
    );

    const videos = Array.from(document.querySelectorAll("video"));
    await Promise.all(
      videos.map((video) => {
        video.muted = true;
        video.playsInline = true;
        video.load();
        const loaded = video.readyState >= 1
          ? Promise.resolve()
          : new Promise((resolve) => {
              const done = () => resolve(undefined);
              video.addEventListener("loadedmetadata", done, { once: true });
              video.addEventListener("error", done, { once: true });
              setTimeout(done, 1600);
            });
        return loaded.then(() => video.play?.().catch(() => undefined));
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
}

async function scrollToAnchor(page, path) {
  const hash = new URL(path, "https://vidsloom.local").hash;
  if (!hash) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(160);
    return;
  }
  await page.evaluate((targetHash) => {
    const id = decodeURIComponent(targetHash.slice(1));
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start", inline: "nearest" });
  }, hash);
  await delay(260);
}

function runInBrowserQa({ viewportName, allowedHorizontalScrollSelectors }) {
  const failures = [];
  const warnings = [];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const documentWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body?.scrollWidth || 0
  );

  if (documentWidth > viewportWidth + 2) {
    failures.push({
      type: "document-horizontal-scroll",
      message: `${viewportName}: document width ${documentWidth}px exceeds viewport ${viewportWidth}px.`
    });
  }

  const textSelector = [
    "h1",
    "h2",
    "h3",
    "h4",
    "p",
    "a",
    "button",
    "span",
    "strong",
    "small",
    "dt",
    "dd",
    "label",
    "li",
    "td",
    "th",
    "input",
    "textarea",
    "select"
  ].join(",");

  const textElements = Array.from(document.querySelectorAll(textSelector));
  for (const element of textElements) {
    if (!isVisible(element) || isAllowedHorizontalScroller(element, allowedHorizontalScrollSelectors)) continue;
    const text = readableText(element);
    if (!text) continue;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const clientWidth = Math.ceil(element.clientWidth || rect.width);
    const clientHeight = Math.ceil(element.clientHeight || rect.height);
    const horizontalOverflow = element.scrollWidth > clientWidth + 2;
    const verticalOverflow = element.scrollHeight > clientHeight + 2;
    const clipsX = ["hidden", "clip", "auto", "scroll"].includes(style.overflowX);
    const clipsY = ["hidden", "clip", "auto", "scroll"].includes(style.overflowY);
    const isFormControl = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element.tagName);
    const textTooCloseToViewport = rect.left < -1 || rect.right > viewportWidth + 1;
    const fontSize = Number.parseFloat(style.fontSize || "16");

    if (horizontalOverflow && (clipsX || style.whiteSpace === "nowrap" || isFormControl)) {
      failures.push({
        type: "text-overflow-x",
        message: `${viewportName}: ${describeElement(element)} text exceeds its box (${element.scrollWidth}px > ${clientWidth}px): "${truncate(text)}"`,
        selector: selectorFor(element),
        text: truncate(text, 160),
        rect: rectJson(rect)
      });
    }

    if (verticalOverflow && clipsY) {
      failures.push({
        type: "text-overflow-y",
        message: `${viewportName}: ${describeElement(element)} text is vertically clipped (${element.scrollHeight}px > ${clientHeight}px): "${truncate(text)}"`,
        selector: selectorFor(element),
        text: truncate(text, 160),
        rect: rectJson(rect)
      });
    }

    if (textTooCloseToViewport && !isFixedEdgeControl(element)) {
      failures.push({
        type: "text-outside-viewport",
        message: `${viewportName}: ${describeElement(element)} spills outside the viewport: "${truncate(text)}"`,
        selector: selectorFor(element),
        text: truncate(text, 160),
        rect: rectJson(rect)
      });
    }

    if (fontSize < 10 && text.length > 3 && rect.width > 20 && rect.height > 8) {
      warnings.push({
        type: "tiny-text",
        message: `${viewportName}: ${describeElement(element)} uses ${fontSize}px text: "${truncate(text)}"`,
        selector: selectorFor(element),
        text: truncate(text, 120),
        rect: rectJson(rect)
      });
    }
  }

  const visibleElements = Array.from(document.body.querySelectorAll("*"));
  for (const element of visibleElements) {
    if (!isVisible(element) || isAllowedHorizontalScroller(element, allowedHorizontalScrollSelectors)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > viewportWidth + 2 && !isFullBleed(element)) {
      failures.push({
        type: "element-too-wide",
        message: `${viewportName}: ${describeElement(element)} is ${Math.round(rect.width)}px wide in a ${viewportWidth}px viewport.`,
        selector: selectorFor(element),
        rect: rectJson(rect)
      });
    }
    if ((rect.left < -2 || rect.right > viewportWidth + 2) && !isFixedEdgeControl(element) && !isFullBleed(element)) {
      failures.push({
        type: "element-outside-viewport",
        message: `${viewportName}: ${describeElement(element)} extends outside viewport.`,
        selector: selectorFor(element),
        rect: rectJson(rect)
      });
    }
  }

  for (const image of Array.from(document.images)) {
    if (!isVisible(image)) continue;
    const rect = image.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12) continue;
    if (image.complete && (image.naturalWidth <= 0 || image.naturalHeight <= 0)) {
      failures.push({
        type: "broken-image",
        message: `${viewportName}: image failed to load: ${image.currentSrc || image.src || image.alt || selectorFor(image)}`,
        selector: selectorFor(image),
        rect: rectJson(rect)
      });
    } else if (!image.complete) {
      warnings.push({
        type: "image-not-complete",
        message: `${viewportName}: image was still loading during inspection: ${image.currentSrc || image.src || image.alt || selectorFor(image)}`,
        selector: selectorFor(image),
        rect: rectJson(rect)
      });
    }
  }

  for (const video of Array.from(document.querySelectorAll("video"))) {
    if (!isVisible(video)) continue;
    const rect = video.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) continue;
    const source = video.currentSrc || video.querySelector("source")?.src || "";
    if (!source) {
      failures.push({
        type: "missing-video-source",
        message: `${viewportName}: video has no usable source.`,
        selector: selectorFor(video),
        rect: rectJson(rect)
      });
      continue;
    }
    if (video.error) {
      failures.push({
        type: "video-error",
        message: `${viewportName}: video failed to load: ${source}`,
        selector: selectorFor(video),
        rect: rectJson(rect)
      });
      continue;
    }
    if (video.readyState < 1 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      failures.push({
        type: "video-metadata-missing",
        message: `${viewportName}: video metadata did not load: ${source}`,
        selector: selectorFor(video),
        rect: rectJson(rect)
      });
    }
    const blankScore = videoBlankScore(video);
    if (blankScore !== null && blankScore < 4) {
      failures.push({
        type: "blank-video-frame",
        message: `${viewportName}: video frame appears blank or nearly uniform: ${source}`,
        selector: selectorFor(video),
        rect: rectJson(rect)
      });
    }
  }

  const fixedElements = Array.from(document.querySelectorAll("*")).filter((element) => {
    if (!isVisible(element)) return false;
    const style = window.getComputedStyle(element);
    return style.position === "fixed" || style.position === "sticky";
  });
  for (const element of fixedElements) {
    const rect = element.getBoundingClientRect();
    if (rect.height > viewportHeight * 0.28 && rect.width > viewportWidth * 0.5) {
      warnings.push({
        type: "large-sticky-element",
        message: `${viewportName}: ${describeElement(element)} is a large sticky/fixed element and may cover content.`,
        selector: selectorFor(element),
        rect: rectJson(rect)
      });
    }
  }

  return {
    failures: dedupeIssues(failures).slice(0, 80),
    warnings: dedupeIssues(warnings).slice(0, 80)
  };

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function readableText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value || element.placeholder || "";
    }
    if (element instanceof HTMLSelectElement) {
      return element.selectedOptions?.[0]?.textContent?.trim() || "";
    }
    return (element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isAllowedHorizontalScroller(element, selectors) {
    return selectors.some((selector) => element.closest(selector));
  }

  function isFixedEdgeControl(element) {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    const rect = element.getBoundingClientRect();
    return rect.left >= -2 && rect.right <= viewportWidth + 2;
  }

  function isFullBleed(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (element.classList.contains("heroBackdropImage")) return true;
    return (
      rect.left <= 1 &&
      rect.right >= viewportWidth - 1 &&
      (style.position === "absolute" || style.position === "fixed" || element.tagName === "BODY" || element.tagName === "MAIN")
    );
  }

  function videoBlankScore(video) {
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(video, 0, 0, 32, 32);
      const data = context.getImageData(0, 0, 32, 32).data;
      let min = 255;
      let max = 0;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        min = Math.min(min, lum);
        max = Math.max(max, lum);
        total += lum;
      }
      const average = total / (data.length / 4);
      return Math.max(max - min, Math.abs(average - 8), Math.abs(average - 247));
    } catch {
      return null;
    }
  }

  function describeElement(element) {
    const id = element.id ? `#${element.id}` : "";
    const className = typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    return `${element.tagName.toLowerCase()}${id}${className}`;
  }

  function selectorFor(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      const id = current.id ? `#${current.id}` : "";
      const classes = typeof current.className === "string" && current.className.trim()
        ? `.${current.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
      parts.unshift(`${tag}${id}${classes}`);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function rectJson(rect) {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom)
    };
  }

  function truncate(text, max = 110) {
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  }

  function dedupeIssues(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.type}:${item.selector || ""}:${item.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function issue(type, message, extra = {}) {
  return { type, message, ...extra };
}

function rectSummary(rect) {
  if (!rect) return "";
  return ` rect=${rect.width}x${rect.height}@${rect.left},${rect.top}`;
}

function renderConsoleSummary(report, failures, warnings) {
  const lines = [
    `VIDSLOOM page visual QA: ${report.verdict.toUpperCase()}`,
    `Base URL: ${report.baseUrl}`,
    `Screenshots: ${outputDir}`,
    `Checks: ${report.results.length}`,
    `Failures: ${failures.length}`,
    `Warnings: ${warnings.length}`
  ];
  for (const failure of failures.slice(0, 20)) {
    lines.push(`- [${failure.result.viewport} ${failure.result.path}] ${failure.message}${rectSummary(failure.rect)}`);
  }
  if (failures.length > 20) lines.push(`- ... ${failures.length - 20} more failure(s) in page-visual-qa-report.json`);
  return lines.join("\n");
}

function renderMarkdown(report, failures, warnings) {
  return [
    "# VIDSLOOM Page Visual QA",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall verdict: ${report.verdict.toUpperCase()}`,
    `Base URL: ${report.baseUrl}`,
    `Chrome: ${report.chromeExecutable}`,
    "",
    "Automated gates:",
    "- No document-level horizontal scrolling on checked viewports.",
    "- Text inside normal cards, buttons, forms, labels, and badges must not clip or overflow.",
    "- Public images and videos must load and render with non-zero dimensions.",
    "- Visible elements must not spill outside the viewport unless they are intentional scrollers.",
    "- Console and page runtime errors fail the gate.",
    "",
    "Checked viewports:",
    ...report.viewports.map((viewport) => `- ${viewport.name}: ${viewport.width}x${viewport.height}`),
    "",
    "Checked pages:",
    ...report.pages.map((page) => `- ${page.path}`),
    "",
    failures.length ? "## Failures" : "## Failures\n\nNone.",
    ...(failures.length
      ? failures.flatMap((failure) => [
          "",
          `- ${failure.result.viewport} ${failure.result.path}: ${failure.message}`,
          `  Screenshot: ${failure.result.screenshotPath}`
        ])
      : []),
    "",
    warnings.length ? "## Warnings" : "## Warnings\n\nNone.",
    ...(warnings.length
      ? warnings.slice(0, 80).flatMap((warning) => [
          "",
          `- ${warning.result.viewport} ${warning.result.path}: ${warning.message}`,
          `  Screenshot: ${warning.result.screenshotPath}`
        ])
      : []),
    "",
    "## Screenshots",
    "",
    ...report.results.flatMap((result) => [
      `### ${result.viewport} ${result.path}`,
      "",
      `Screenshot: ${result.screenshotPath}`,
      `Failures: ${result.failures.length}`,
      `Warnings: ${result.warnings.length}`,
      ""
    ])
  ].join("\n");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
