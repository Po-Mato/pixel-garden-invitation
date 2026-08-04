import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const placementContract = JSON.parse(readFileSync(
  new URL("../../client/src/game/worldForegroundPlacements.json", import.meta.url),
  "utf8"
));
const depthRecommendations = JSON.parse(readFileSync(
  new URL("../../client/src/game/worldForegroundDepthRecommendations.json", import.meta.url),
  "utf8"
));

export const mapDiagnosticsAuditViewports = Object.freeze([
  { id: "small-android", width: 360, height: 640 },
  { id: "iphone-portrait", width: 390, height: 844 },
  { id: "phone-landscape", width: 844, height: 390 }
]);

export const mapDiagnosticsZoneIds = Object.freeze(Object.keys(placementContract.zones));

export function auditMapDiagnosticsSnapshot(
  snapshot,
  viewport,
  expectedDepthCount,
  expectedRecommendedDepthCount = 0
) {
  const issues = [];
  const controls = snapshot.controlsRect;
  if (
    !controls
    || controls.x < -1
    || controls.y < -1
    || controls.x + controls.width > viewport.width + 1
    || controls.y + controls.height > viewport.height + 1
  ) issues.push("진단 도구 화면 이탈");
  if (!snapshot.overlayVisible) issues.push("진단 오버레이 숨김");
  if (snapshot.activeZoneId !== snapshot.selectedZoneId) issues.push("선택 구역과 활성 구역 불일치");
  if (snapshot.overlayZoneId !== snapshot.selectedZoneId) issues.push("선택 구역과 오버레이 구역 불일치");
  if (snapshot.depthCount !== expectedDepthCount) {
    issues.push(`깊이선 수 불일치 ${snapshot.depthCount}/${expectedDepthCount}`);
  }
  if (snapshot.recommendedDepthCount !== expectedRecommendedDepthCount) {
    issues.push(`추천 깊이선 수 불일치 ${snapshot.recommendedDepthCount}/${expectedRecommendedDepthCount}`);
  }
  if (snapshot.activeLayerCount !== 4) issues.push(`활성 진단 필터 수 불일치 ${snapshot.activeLayerCount}/4`);
  if (!snapshot.layers.every(Boolean)) issues.push("기본 진단 필터 비활성");
  if (snapshot.issueCount > 0) issues.push(`맵 지오메트리 문제 ${snapshot.issueCount}건`);
  return issues;
}

async function waitForServer(url, server, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite exited before audit: ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the map diagnostics audit server");
}

async function readSnapshot(page, selectedZoneId) {
  return page.evaluate((zoneId) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    const stage = document.querySelector(".world-map__stage");
    const overlay = document.querySelector(".world-geometry-audit");
    return {
      selectedZoneId: zoneId,
      activeZoneId: stage?.getAttribute("data-zone") ?? null,
      overlayZoneId: overlay?.getAttribute("data-zone") ?? null,
      overlayVisible: overlay instanceof HTMLElement && getComputedStyle(overlay).display !== "none",
      controlsRect: rect(".world-geometry-audit-controls"),
      depthCount: document.querySelectorAll(".world-geometry-audit__depth[data-depth-y]").length,
      recommendedDepthCount: document.querySelectorAll(".world-geometry-audit__depth--recommended").length,
      collisionCount: document.querySelectorAll(".world-geometry-audit__collision").length,
      issueCount: Number(overlay?.getAttribute("data-issue-count") ?? -1),
      activeLayerCount: document.querySelectorAll(".world-geometry-audit-layers button[aria-pressed=\"true\"]").length,
      layers: ["grid", "collision", "depth", "labels"].map((layer) => overlay?.getAttribute(`data-${layer}`) === "true")
    };
  }, selectedZoneId);
}

export async function runMapDiagnosticsBrowserAudit({ rootDir, outputDir, port = 4180 }) {
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/?mapAudit=1&mapAuditZone=lobby`;
  await mkdir(outputDir, { recursive: true });
  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const reports = [];
    try {
      for (const viewport of mapDiagnosticsAuditViewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          hasTouch: true,
          isMobile: true,
          deviceScaleFactor: 2
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
            version: 1,
            nickname: "진단감사",
            appearance: { presetId: "feminine-long-wave-dress" },
            updatedAt: new Date().toISOString()
          }));
          localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
            version: 1,
            completed: true,
            completedAt: new Date().toISOString()
          }));
        });
        await page.goto(url, { waitUntil: "networkidle" });
        const resumeGarden = page.locator(".entry-screen__resume-access");
        if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
        await page.locator(".game-world").waitFor({ state: "visible" });
        await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
        const selector = page.getByRole("combobox", { name: "진단 구역 즉시 이동" });
        await selector.waitFor({ state: "visible" });
        if (await selector.inputValue() !== "lobby") throw new Error(`${viewport.id}: 진단 공유 링크 초기 구역 불일치`);
        await page.keyboard.press("0");
        await page.waitForFunction(() => document.querySelector(".world-map__stage")?.getAttribute("data-zone") === "restroom");
        const gridFilter = page.getByRole("button", { name: "이동 격자 숨기기" });
        await gridFilter.click();
        if (await page.locator(".world-geometry-audit__tile").count() !== 0) {
          throw new Error(`${viewport.id}: 이동 격자 필터 비활성 실패`);
        }
        await page.getByRole("button", { name: "이동 격자 표시" }).click();

        for (const zoneId of mapDiagnosticsZoneIds) {
          await selector.selectOption(zoneId);
          await page.waitForFunction((expectedZoneId) => (
            document.querySelector(".world-map__stage")?.getAttribute("data-zone") === expectedZoneId
            && document.querySelector(".world-geometry-audit")?.getAttribute("data-zone") === expectedZoneId
            && document.querySelector(".world-map__stage")?.classList.contains("world-map__stage--background-loaded")
          ), zoneId, { timeout: 15_000 });
          await page.waitForTimeout(120);

          const snapshot = await readSnapshot(page, zoneId);
          const expectedDepthCount = placementContract.zones[zoneId].length;
          const recommendations = new Map(
            depthRecommendations.zones[zoneId].map(({ decorationId, depthY }) => [decorationId, depthY])
          );
          const expectedRecommendedDepthCount = placementContract.zones[zoneId].filter((placement) => (
            recommendations.get(placement.decorationId) !== undefined
            && recommendations.get(placement.decorationId) !== placement.depthY
          )).length;
          const issues = auditMapDiagnosticsSnapshot(
            snapshot,
            viewport,
            expectedDepthCount,
            expectedRecommendedDepthCount
          );
          const screenshotPath = path.join(outputDir, `map-diagnostics-${viewport.id}-${zoneId}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          reports.push({
            ...viewport,
            zoneId,
            expectedDepthCount,
            expectedRecommendedDepthCount,
            snapshot,
            issues,
            screenshotPath
          });
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }

    const reportPath = path.join(outputDir, "map-diagnostics-browser-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
    const issues = reports.flatMap((report) => report.issues.map((issue) => `${report.id}/${report.zoneId}: ${issue}`));
    if (issues.length > 0) throw new Error(`Map diagnostics browser audit failed:\n${issues.join("\n")}`);
    return { reports, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}
