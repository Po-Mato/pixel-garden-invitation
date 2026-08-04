import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const placementContract = JSON.parse(readFileSync(
  new URL("../../client/src/game/worldForegroundPlacements.json", import.meta.url),
  "utf8"
));
const foregroundRecommendations = JSON.parse(readFileSync(
  new URL("../../client/src/game/worldForegroundRecommendations.json", import.meta.url),
  "utf8"
));

export const mapDiagnosticsAuditViewports = Object.freeze([
  { id: "small-android", width: 360, height: 640 },
  { id: "iphone-portrait", width: 390, height: 844 },
  { id: "phone-landscape", width: 844, height: 390 }
]);

export const mapDiagnosticsZoneIds = Object.freeze(Object.keys(placementContract.zones));

export const mapDiagnosticsReviewTarget = Object.freeze(mapDiagnosticsZoneIds.flatMap((zoneId) => {
  const recommendations = new Map(
    foregroundRecommendations.zones[zoneId].map((recommendation) => [recommendation.decorationId, recommendation])
  );
  return placementContract.zones[zoneId].flatMap((placement) => {
    const recommendation = recommendations.get(placement.decorationId);
    if (!recommendation) return [];
    const depthChanged = recommendation.depthY !== placement.depthY;
    const collisionChanged = JSON.stringify(recommendation.collision ?? null) !== JSON.stringify(placement.collision ?? null);
    if (!depthChanged && !collisionChanged) return [];
    return [{
      zoneId,
      decorationId: placement.decorationId,
      key: `${zoneId}/${placement.decorationId}`,
      operationCount: Number(depthChanged) + Number(collisionChanged),
      depthChanged,
      collisionChanged
    }];
  });
})[0] ?? null);

export function auditMapDiagnosticsSnapshot(
  snapshot,
  viewport,
  expectedDepthCount,
  expectedRecommendedDepthCount = 0,
  expectedCurrentCollisionCount = 0,
  expectedRecommendedCollisionCount = 0,
  expectedHeatmapCount = 0
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
  if (snapshot.currentForegroundCollisionCount !== expectedCurrentCollisionCount) {
    issues.push(`현재 전경 충돌 수 불일치 ${snapshot.currentForegroundCollisionCount}/${expectedCurrentCollisionCount}`);
  }
  if (snapshot.recommendedForegroundCollisionCount !== expectedRecommendedCollisionCount) {
    issues.push(`추천 전경 충돌 수 불일치 ${snapshot.recommendedForegroundCollisionCount}/${expectedRecommendedCollisionCount}`);
  }
  if (snapshot.heatmapCount !== expectedHeatmapCount) issues.push(`차이 히트맵 수 불일치 ${snapshot.heatmapCount}/${expectedHeatmapCount}`);
  if (snapshot.activeLayerCount !== 5) issues.push(`활성 진단 필터 수 불일치 ${snapshot.activeLayerCount}/5`);
  if (!snapshot.layers.every(Boolean)) issues.push("기본 진단 필터 비활성");
  if (!["color", "pattern", "contrast"].includes(snapshot.heatmapMode)) issues.push("히트맵 접근성 모드 불일치");
  if (snapshot.policyStatus !== "passed") {
    issues.push(`맵 지오메트리 정책 차단 B${snapshot.blockingCount}/W${snapshot.warningCount}`);
  }
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
      currentForegroundCollisionCount: document.querySelectorAll(".world-geometry-audit__foreground-collision--current").length,
      recommendedForegroundCollisionCount: document.querySelectorAll(".world-geometry-audit__foreground-collision--recommended").length,
      heatmapCount: document.querySelectorAll(".world-geometry-audit__heatmap").length,
      collisionCount: document.querySelectorAll(".world-geometry-audit__collision").length,
      issueCount: Number(overlay?.getAttribute("data-issue-count") ?? -1),
      blockingCount: Number(overlay?.getAttribute("data-blocking-count") ?? -1),
      warningCount: Number(overlay?.getAttribute("data-warning-count") ?? -1),
      policyStatus: overlay?.getAttribute("data-policy-status") ?? null,
      heatmapMode: overlay?.getAttribute("data-heatmap-mode") ?? null,
      activeLayerCount: document.querySelectorAll(".world-geometry-audit-layers button[aria-pressed=\"true\"]").length,
      layers: ["grid", "collision", "depth", "heatmap", "labels"].map((layer) => overlay?.getAttribute(`data-${layer}`) === "true")
    };
  }, selectedZoneId);
}

export async function runMapDiagnosticsBrowserAudit({ rootDir, outputDir, port = 4180 }) {
  if (!mapDiagnosticsReviewTarget) throw new Error("맵 진단 브라우저 감사에 사용할 미해결 전경 추천이 없습니다");
  const reviewTarget = mapDiagnosticsReviewTarget;
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/?mapAudit=1&mapAuditZone=lobby&mapAuditHeatmap=color`;
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
          deviceScaleFactor: 2,
          acceptDownloads: true
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

        if (viewport.id === "small-android") {
          await selector.selectOption(reviewTarget.zoneId);
          await page.waitForFunction((zoneId) => (
            document.querySelector(".world-map__stage")?.getAttribute("data-zone") === zoneId
            && document.querySelector(".world-map__stage")?.classList.contains("world-map__stage--background-loaded")
          ), reviewTarget.zoneId, { timeout: 15_000 });
          const heatmapMode = page.getByRole("combobox", { name: "히트맵 표시 방식" });
          await heatmapMode.selectOption("pattern");
          if (
            await page.locator(".world-geometry-audit").getAttribute("data-heatmap-mode") !== "pattern"
            || !new URL(page.url()).searchParams.get("mapAuditHeatmap")?.includes("pattern")
          ) throw new Error(`${viewport.id}: 색각 패턴 히트맵 상태 저장 실패`);
          await heatmapMode.selectOption("contrast");
          if (await page.locator(".world-geometry-audit").getAttribute("data-heatmap-mode") !== "contrast") {
            throw new Error(`${viewport.id}: 고대비 히트맵 전환 실패`);
          }
          await page.screenshot({ path: path.join(outputDir, `map-diagnostics-small-android-${reviewTarget.zoneId}-contrast.png`), fullPage: true });
          await heatmapMode.selectOption("pattern");
          await page.getByRole("button", { name: "전경 추천 검토 열기" }).click();
          await page.getByRole("button", { name: `${reviewTarget.decorationId} 추천 승인` }).click();
          const reviewState = await page.evaluate(() => ({
            query: new URL(window.location.href).searchParams.get("mapAuditReview"),
            stored: localStorage.getItem("wedding-game:map-foreground-review:v1")
          }));
          if (!reviewState.query?.includes(`a:${reviewTarget.key}`) || !reviewState.stored?.includes("accepted")) {
            throw new Error(`${viewport.id}: 추천 승인 상태 URL·로컬 저장 실패`);
          }
          const acceptedGhost = page.locator(
            `.world-geometry-audit__foreground-collision--recommended[data-decoration-id="${reviewTarget.decorationId}"]`
          );
          if (await acceptedGhost.getAttribute("data-review-decision") !== "accepted") {
            throw new Error(`${viewport.id}: 추천 충돌 승인 상태가 오버레이에 반영되지 않음`);
          }
          const patchDownloadPromise = page.waitForEvent("download");
          await page.getByRole("button", { name: "승인 추천 JSON patch 저장, 1개 선택" }).click();
          const patchDownload = await patchDownloadPromise;
          const patchPath = await patchDownload.path();
          const patch = JSON.parse(await readFile(patchPath, "utf8"));
          if (
            patch.acceptedPlacementKeys?.[0] !== reviewTarget.key
            || patch.operationCount !== reviewTarget.operationCount
            || !/^[a-f0-9]{64}$/.test(patch.sourceChecksum ?? "")
          ) {
            throw new Error(`${viewport.id}: 선택 patch 내용 불일치`);
          }
          await page.getByLabel("검토 JSON patch 불러오기").setInputFiles(patchPath);
          await page.getByText("PATCH PREVIEW", { exact: true }).waitFor({ state: "visible" });
          if (
            await page.locator(".world-geometry-audit").getAttribute("data-patch-preview") !== "true"
            || (reviewTarget.collisionChanged
              && await page.locator(`.world-geometry-audit__foreground-collision--recommended[data-decoration-id="${reviewTarget.decorationId}"]`).count() !== 1)
          ) throw new Error(`${viewport.id}: 불러온 patch 시각 미리보기 불일치`);
          const bundleDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
          await page.getByRole("button", { name: "현재 화면 진단 번들 저장" }).click();
          const bundleDownload = await bundleDownloadPromise;
          const bundlePath = await bundleDownload.path();
          const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
          if (
            bundle.version !== 2
            || bundle.zone?.id !== reviewTarget.zoneId
            || bundle.selectedPatch?.operationCount !== reviewTarget.operationCount
            || !bundle.screenshot?.dataUrl?.startsWith("data:image/png;base64,")
            || !bundle.viewerUrl?.endsWith("/map-diagnostic-bundle-viewer.html")
            || bundle.heatmapMode !== "pattern"
            || bundle.sourceContract?.checksum !== bundle.selectedPatch?.sourceChecksum
            || !/^[a-f0-9]{64}$/.test(bundle.integrity?.checksum ?? "")
          ) throw new Error(`${viewport.id}: 화면 진단 번들 내용 불일치`);
          await heatmapMode.selectOption("contrast");
          const candidateDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
          await page.getByRole("button", { name: "현재 화면 진단 번들 저장" }).click();
          const candidateDownload = await candidateDownloadPromise;
          const candidatePath = await candidateDownload.path();
          const candidateBundle = JSON.parse(await readFile(candidatePath, "utf8"));
          if (
            candidateBundle.heatmapMode !== "contrast"
            || candidateBundle.integrity?.checksum === bundle.integrity.checksum
            || candidateBundle.diagnosticUrl === bundle.diagnosticUrl
          ) throw new Error(`${viewport.id}: 비교용 고대비 진단 번들 내용 불일치`);
          await heatmapMode.selectOption("pattern");
          const viewerPagePromise = context.waitForEvent("page");
          await page.getByRole("button", { name: "진단 번들 뷰어 열기" }).click();
          const viewerPage = await viewerPagePromise;
          await viewerPage.getByText("DROP 1–2 DIAGNOSTIC JSON").waitFor({ state: "visible" });
          await viewerPage.locator("#file-input").setInputFiles({
            name: "tampered-diagnostic.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify({ ...bundle, zone: { ...bundle.zone, label: "변조" } }))
          });
          await viewerPage.getByText(/무결성 검증에 실패했습니다/).waitFor({ state: "visible" });
          await viewerPage.locator("#file-input").setInputFiles(bundlePath);
          await viewerPage.getByText("PASSED", { exact: true }).waitFor({ state: "visible" });
          if (await viewerPage.locator("#operations tr").count() !== reviewTarget.operationCount) {
            throw new Error(`${viewport.id}: 진단 번들 뷰어 patch 렌더링 불일치`);
          }
          const viewerState = await viewerPage.evaluate(() => ({
            reportHidden: document.querySelector("#report")?.hasAttribute("hidden"),
            dropHidden: document.querySelector("#drop-zone")?.hasAttribute("hidden"),
            screenshotLoaded: Boolean(document.querySelector("#screenshot")?.complete)
          }));
          if (viewerState.reportHidden || !viewerState.dropHidden || !viewerState.screenshotLoaded) {
            throw new Error(`${viewport.id}: 진단 번들 뷰어 로드 상태 불일치`);
          }
          await viewerPage.locator("#compare-input").setInputFiles(candidatePath);
          await viewerPage.locator("#comparison-count").waitFor({ state: "visible" });
          const comparisonCount = Number.parseInt(await viewerPage.locator("#comparison-count").textContent() ?? "0", 10);
          if (comparisonCount < 2) throw new Error(`${viewport.id}: 진단 번들 차이 항목 누락`);
          const comparisonChanges = await viewerPage.locator("#comparison-changes").textContent();
          if (!comparisonChanges?.includes("HEATMAP") || !comparisonChanges.includes("SCREENSHOT")) {
            throw new Error(`${viewport.id}: 히트맵·스크린샷 차이 분류 누락`);
          }
          if (await viewerPage.locator("#comparison").getAttribute("hidden") !== null) {
            throw new Error(`${viewport.id}: 진단 번들 A/B 비교 렌더링 실패`);
          }
          await viewerPage.locator("#blink-toggle").dispatchEvent("click");
          if (await viewerPage.locator("#blink-toggle").getAttribute("aria-pressed") !== "true") {
            throw new Error(`${viewport.id}: 번들 깜빡임 비교 활성화 실패`);
          }
          await viewerPage.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
          await viewerPage.keyboard.press("b");
          await viewerPage.locator("#mix-range").evaluate((element) => {
            element.value = "65";
            element.dispatchEvent(new Event("input", { bubbles: true }));
          });
          if (!await viewerPage.locator("#visual-status").textContent().then((text) => text?.includes("65%"))) {
            throw new Error(`${viewport.id}: 비교 투명도 조절 실패`);
          }
          await viewerPage.keyboard.press("d");
          if (
            await viewerPage.locator("#diff-toggle").getAttribute("aria-pressed") !== "true"
            || !await viewerPage.locator("#pixel-score").textContent().then((text) => text?.includes("PIXEL Δ"))
          ) throw new Error(`${viewport.id}: 픽셀 차이 비교 활성화 실패`);
          const deltaDownloadPromise = viewerPage.waitForEvent("download", { timeout: 30_000 });
          await viewerPage.locator("#download-delta").dispatchEvent("click");
          const deltaDownload = await deltaDownloadPromise;
          const deltaPath = await deltaDownload.path();
          const deltaBundleText = await readFile(deltaPath, "utf8");
          const deltaBundle = JSON.parse(deltaBundleText);
          if (
            deltaBundle.kind !== "world-diagnostic-delta"
            || deltaBundle.changes.length !== comparisonCount
            || deltaBundle.reproductionUrl !== candidateBundle.diagnosticUrl
            || deltaBundleText.includes("data:image/png;base64,")
            || !/^[a-f0-9]{64}$/.test(deltaBundle.integrity?.checksum ?? "")
          ) throw new Error(`${viewport.id}: 경량 차이 번들 내용 불일치`);
          await context.grantPermissions(["clipboard-write"], { origin: new URL(viewerPage.url()).origin });
          await viewerPage.locator("#copy-repro").focus();
          await viewerPage.keyboard.press("Enter");
          await viewerPage.getByText("REPRO URL COPIED", { exact: true }).waitFor({ state: "visible" });
          if (await viewerPage.locator("#open-repro").getAttribute("href") !== candidateBundle.diagnosticUrl) {
            throw new Error(`${viewport.id}: 비교 재현 링크 불일치`);
          }
          await viewerPage.waitForTimeout(350);
          await viewerPage.screenshot({ path: path.join(outputDir, "map-diagnostic-bundle-viewer-loaded.png"), fullPage: true });
          await viewerPage.locator("#reset").dispatchEvent("click");
          await viewerPage.locator("#file-input").setInputFiles(deltaPath);
          await viewerPage.getByText("LIGHTWEIGHT DELTA EVIDENCE", { exact: true }).waitFor({ state: "visible" });
          if (!await viewerPage.locator("#delta-integrity").textContent().then((text) => text?.startsWith("VERIFIED"))) {
            throw new Error(`${viewport.id}: 경량 차이 번들 다시 열기 실패`);
          }
          await viewerPage.close();
          await page.getByRole("button", { name: "불러온 Patch 미리보기 지우기" }).click();
          await page.getByRole("button", { name: `${reviewTarget.decorationId} 추천 승인` }).click();
          const clearedReviewState = await page.evaluate(() => ({
            query: new URL(window.location.href).searchParams.has("mapAuditReview"),
            stored: localStorage.getItem("wedding-game:map-foreground-review:v1")
          }));
          if (clearedReviewState.query || clearedReviewState.stored !== null) {
            throw new Error(`${viewport.id}: 추천 검토 상태 초기화 실패`);
          }
          await page.getByRole("button", { name: "전경 추천 검토 열기" }).click();
        }

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
            foregroundRecommendations.zones[zoneId].map((recommendation) => [recommendation.decorationId, recommendation])
          );
          const expectedRecommendedDepthCount = placementContract.zones[zoneId].filter((placement) => (
            recommendations.get(placement.decorationId)?.depthY !== undefined
            && recommendations.get(placement.decorationId)?.depthY !== placement.depthY
          )).length;
          const collisionChanged = (placement) => {
            const recommended = recommendations.get(placement.decorationId)?.collision ?? null;
            const current = placement.collision ?? null;
            return JSON.stringify(current) !== JSON.stringify(recommended);
          };
          const expectedCurrentCollisionCount = placementContract.zones[zoneId]
            .filter((placement) => collisionChanged(placement) && placement.collision).length;
          const expectedRecommendedCollisionCount = placementContract.zones[zoneId]
            .filter((placement) => collisionChanged(placement) && recommendations.get(placement.decorationId)?.collision).length;
          const expectedHeatmapCount = placementContract.zones[zoneId].reduce((count, placement) => {
            const recommendation = recommendations.get(placement.decorationId);
            if (!recommendation) return count;
            return count
              + (recommendation.depthY !== placement.depthY ? 1 : 0)
              + (collisionChanged(placement) ? 1 : 0);
          }, 0);
          const issues = auditMapDiagnosticsSnapshot(
            snapshot,
            viewport,
            expectedDepthCount,
            expectedRecommendedDepthCount,
            expectedCurrentCollisionCount,
            expectedRecommendedCollisionCount,
            expectedHeatmapCount
          );
          const screenshotPath = path.join(outputDir, `map-diagnostics-${viewport.id}-${zoneId}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          reports.push({
            ...viewport,
            zoneId,
            expectedDepthCount,
            expectedRecommendedDepthCount,
            expectedCurrentCollisionCount,
            expectedRecommendedCollisionCount,
            expectedHeatmapCount,
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
