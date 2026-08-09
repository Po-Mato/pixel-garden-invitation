import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const gameResourceBudgets = Object.freeze({
  base: {
    maxCssRequests: 2,
    maxCssGzipBytes: 112 * 1024,
    maxFontRequests: 11,
    maxFontBytes: 280 * 1024,
    maxGameWorldCssGzipBytes: 48 * 1024
  },
  directions: {
    maxAdditionalCssRequests: 0,
    maxAdditionalFontRequests: 2
  },
  vault: {
    maxAdditionalCssRequests: 4,
    maxAdditionalCssGzipBytes: 34 * 1024,
    maxAdditionalFontRequests: 4,
    maxAdditionalFontBytes: 140 * 1024
  },
  pwa: {
    maxCoreRawBytes: 3_300_000,
    maxCoreTransferBytes: 2_300_000,
    maxFeatureRawBytes: 1_100_000,
    maxFeatureTransferBytes: 320_000
  }
});

export function parsePwaPrecachePaths(source) {
  const match = source.match(/const PRECACHE_URLS = (\[[^;]+\]);/);
  if (!match) throw new Error("service-worker.js PRECACHE_URLS missing");
  const paths = JSON.parse(match[1]);
  if (!Array.isArray(paths) || paths.some((value) => typeof value !== "string")) {
    throw new Error("service-worker.js PRECACHE_URLS invalid");
  }
  return paths;
}

export function parsePwaFeaturePaths(source) {
  const match = source.match(/const FEATURE_URLS = (\[[^;]+\]);/);
  if (!match) throw new Error("service-worker.js FEATURE_URLS missing");
  const paths = JSON.parse(match[1]);
  if (!Array.isArray(paths) || paths.some((value) => typeof value !== "string")) {
    throw new Error("service-worker.js FEATURE_URLS invalid");
  }
  return paths;
}

const optionalStylePattern = /(?:game-vault-optional|WorldSecretMemorial|world-secret-memorial|wght-)/i;

function uniqueResources(resources) {
  return [...new Map(resources.map((resource) => [resource.path ?? resource.url, resource])).values()];
}

function resourcesOfKind(snapshot, kind) {
  return uniqueResources(snapshot.resources.filter((resource) => resource.kind === kind));
}

function resourceDelta(after, before, kind) {
  const previous = new Set(resourcesOfKind(before, kind).map(({ path: resourcePath }) => resourcePath));
  return resourcesOfKind(after, kind).filter(({ path: resourcePath }) => !previous.has(resourcePath));
}

function total(resources, field) {
  return resources.reduce((sum, resource) => sum + (Number(resource[field]) || 0), 0);
}

const compressiblePwaAssetPattern = /\.(?:css|html?|js|json|svg|txt|webmanifest|xml)$/i;

function pwaDistPath(resourcePath) {
  const relativePath = resourcePath.replace(/^\.\//, "");
  return relativePath || "index.html";
}

export function auditPwaCacheBudgets(precache, budgets = gameResourceBudgets.pwa) {
  const issues = [];
  const checkMaximum = (value, maximum, label) => {
    if (value > maximum) issues.push(`${label} ${value}/${maximum}`);
  };
  precache.core.missing.forEach((resourcePath) => issues.push(`핵심 오프라인 저장 자산 누락 ${resourcePath}`));
  precache.features.missing.forEach((resourcePath) => issues.push(`선택 기능 오프라인 저장 자산 누락 ${resourcePath}`));
  checkMaximum(precache.core.rawBytes, budgets.maxCoreRawBytes, "핵심 오프라인 캐시 원본 용량 초과");
  checkMaximum(precache.core.transferBytes, budgets.maxCoreTransferBytes, "핵심 오프라인 캐시 전송 용량 초과");
  checkMaximum(precache.features.rawBytes, budgets.maxFeatureRawBytes, "선택 기능 캐시 원본 용량 초과");
  checkMaximum(precache.features.transferBytes, budgets.maxFeatureTransferBytes, "선택 기능 캐시 전송 용량 초과");
  return issues;
}

export function summarizeGameResourceStates(states) {
  const baseCss = resourcesOfKind(states.base, "css");
  const baseFonts = resourcesOfKind(states.base, "font");
  const directionsCss = resourceDelta(states.directions, states.base, "css");
  const directionsFonts = resourceDelta(states.directions, states.base, "font");
  const vaultCss = resourceDelta(states.vault, states.directions, "css");
  const vaultFonts = resourceDelta(states.vault, states.directions, "font");
  return {
    base: {
      cssRequests: baseCss.length,
      cssGzipBytes: total(baseCss, "gzipBytes"),
      fontRequests: baseFonts.length,
      fontBytes: total(baseFonts, "bytes"),
      gameWorldCssGzipBytes: total(baseCss.filter(({ path: resourcePath }) => /GameWorld-.*\.css$/i.test(resourcePath)), "gzipBytes"),
      css: baseCss,
      fonts: baseFonts
    },
    directions: {
      additionalCssRequests: directionsCss.length,
      additionalFontRequests: directionsFonts.length,
      css: directionsCss,
      fonts: directionsFonts
    },
    vault: {
      additionalCssRequests: vaultCss.length,
      additionalCssGzipBytes: total(vaultCss, "gzipBytes"),
      additionalFontRequests: vaultFonts.length,
      additionalFontBytes: total(vaultFonts, "bytes"),
      css: vaultCss,
      fonts: vaultFonts
    }
  };
}

export function auditGameResourceBudgets(states, budgets = gameResourceBudgets) {
  const summary = summarizeGameResourceStates(states);
  const issues = [];
  const checkMaximum = (value, maximum, label) => {
    if (value > maximum) issues.push(`${label} ${value}/${maximum}`);
  };
  checkMaximum(summary.base.cssRequests, budgets.base.maxCssRequests, "기본 게임 CSS 요청 초과");
  checkMaximum(summary.base.cssGzipBytes, budgets.base.maxCssGzipBytes, "기본 게임 CSS gzip 초과");
  checkMaximum(summary.base.fontRequests, budgets.base.maxFontRequests, "기본 게임 폰트 요청 초과");
  checkMaximum(summary.base.fontBytes, budgets.base.maxFontBytes, "기본 게임 폰트 용량 초과");
  checkMaximum(
    summary.base.gameWorldCssGzipBytes,
    budgets.base.maxGameWorldCssGzipBytes,
    "GameWorld CSS gzip 초과"
  );
  if (summary.base.gameWorldCssGzipBytes === 0) issues.push("기본 게임 GameWorld CSS 측정 누락");
  summary.base.css.filter(({ path: resourcePath }) => optionalStylePattern.test(resourcePath)).forEach(({ path: resourcePath }) => {
    issues.push(`기본 게임 선택 기능 CSS 선로드 ${resourcePath}`);
  });
  checkMaximum(
    summary.directions.additionalCssRequests,
    budgets.directions.maxAdditionalCssRequests,
    "오시는 길 추가 CSS 요청 초과"
  );
  checkMaximum(
    summary.directions.additionalFontRequests,
    budgets.directions.maxAdditionalFontRequests,
    "오시는 길 추가 폰트 요청 초과"
  );
  summary.directions.css.filter(({ path: resourcePath }) => optionalStylePattern.test(resourcePath)).forEach(({ path: resourcePath }) => {
    issues.push(`오시는 길 선택 기능 CSS 선로드 ${resourcePath}`);
  });
  checkMaximum(
    summary.vault.additionalCssRequests,
    budgets.vault.maxAdditionalCssRequests,
    "게임 기록·설정 추가 CSS 요청 초과"
  );
  checkMaximum(
    summary.vault.additionalCssGzipBytes,
    budgets.vault.maxAdditionalCssGzipBytes,
    "게임 기록·설정 추가 CSS gzip 초과"
  );
  checkMaximum(
    summary.vault.additionalFontRequests,
    budgets.vault.maxAdditionalFontRequests,
    "게임 기록·설정 추가 폰트 요청 초과"
  );
  checkMaximum(
    summary.vault.additionalFontBytes,
    budgets.vault.maxAdditionalFontBytes,
    "게임 기록·설정 추가 폰트 용량 초과"
  );
  if (!summary.vault.css.some(({ path: resourcePath }) => /game-vault-optional-.*\.css$/i.test(resourcePath))) {
    issues.push("게임 기록·설정 선택 CSS 지연 로드 측정 누락");
  }
  return { summary, issues };
}

async function waitForServer(url, server, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function enrichResources(resources, distDir) {
  const enriched = [];
  for (const resource of uniqueResources(resources)) {
    const relativePath = decodeURIComponent(new URL(resource.url).pathname).replace(/^\/+/, "");
    const filePath = path.join(distDir, relativePath);
    let bytes = Number(resource.transferSize) || 0;
    let gzipBytes = 0;
    try {
      const file = await readFile(filePath);
      bytes = file.byteLength;
      if (resource.kind === "css") gzipBytes = gzipSync(file).byteLength;
    } catch {
      // Cross-origin API calls and browser internals are outside this static-asset budget.
    }
    enriched.push({ ...resource, path: relativePath, bytes, gzipBytes });
  }
  return enriched;
}

async function browserResourceSnapshot(page, id, distDir) {
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").flatMap((entry) => {
    const url = new URL(entry.name);
    const kind = url.pathname.endsWith(".css")
      ? "css"
      : /\.(?:woff2?|ttf|otf)$/i.test(url.pathname) ? "font" : "other";
    if (url.origin !== window.location.origin || kind === "other") return [];
    return [{ url: entry.name, kind, transferSize: entry.transferSize }];
  }));
  return { id, resources: await enrichResources(resources, distDir) };
}

async function inspectPwaCacheGroup(distDir, paths) {
  const missing = [];
  const assets = [];
  for (const resourcePath of paths) {
    const relativePath = pwaDistPath(resourcePath);
    try {
      const file = await readFile(path.join(distDir, relativePath));
      const transferBytes = compressiblePwaAssetPattern.test(relativePath)
        ? gzipSync(file).byteLength
        : file.byteLength;
      assets.push({
        path: resourcePath,
        rawBytes: file.byteLength,
        transferBytes,
        sha256: createHash("sha256").update(file).digest("hex")
      });
    } catch {
      missing.push(resourcePath);
    }
  }
  return {
    total: paths.length,
    rawBytes: total(assets, "rawBytes"),
    transferBytes: total(assets, "transferBytes"),
    missing,
    assets,
    largest: [...assets].sort((left, right) => right.transferBytes - left.transferBytes).slice(0, 10)
  };
}

export async function inspectPwaPrecache(distDir) {
  const source = await readFile(path.join(distDir, "service-worker.js"), "utf8");
  const [core, features] = await Promise.all([
    inspectPwaCacheGroup(distDir, parsePwaPrecachePaths(source)),
    inspectPwaCacheGroup(distDir, parsePwaFeaturePaths(source))
  ]);
  return { core, features, total: core.total + features.total };
}

export async function runGameResourceBudgetAudit({ rootDir, outputDir, port = 4183 }) {
  const distDir = path.join(rootDir, "client/dist");
  await stat(path.join(distDir, "index.html"));
  const precache = await inspectPwaPrecache(distDir);
  await mkdir(outputDir, { recursive: true });
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        hasTouch: true,
        isMobile: true,
        locale: "ko-KR",
        reducedMotion: "reduce",
        serviceWorkers: "block"
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
          version: 1,
          nickname: "하객 김승재",
          appearance: { presetId: "feminine-long-wave-dress" },
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
          version: 1,
          completed: true,
          completedAt: new Date().toISOString()
        }));
      });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const base = await browserResourceSnapshot(page, "base", distDir);

      await page.locator(".world-menu-button").click();
      await page.getByRole("button", { name: "길 찾기", exact: true }).click();
      await page.locator(".directions-sheet").waitFor({ state: "visible" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const directions = await browserResourceSnapshot(page, "directions", distDir);
      await page.locator(".bottom-sheet__header button").click();
      await page.locator(".directions-sheet").waitFor({ state: "hidden" });

      await page.locator(".world-hud__tools-toggle").click();
      await page.locator(".world-game-vault > summary").click();
      await page.locator(".world-game-vault__body").waitFor({ state: "visible" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const vault = await browserResourceSnapshot(page, "vault", distDir);
      const states = { base, directions, vault };
      const result = auditGameResourceBudgets(states);
      result.issues.push(...auditPwaCacheBudgets(precache));
      const reportPath = path.join(outputDir, "game-resource-budget-report.json");
      await writeFile(reportPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        budgets: gameResourceBudgets,
        precache,
        states,
        ...result
      }, null, 2)}\n`);
      await context.close();
      if (result.issues.length > 0) {
        throw new Error(`Game resource budget failed:\n${result.issues.join("\n")}`);
      }
      return { ...result, precache, reportPath };
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
  }
}
