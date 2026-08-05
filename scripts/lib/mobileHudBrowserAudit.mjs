import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  compareMobileDeviceVisualBaseline,
  mobileDeviceVisualBaselineProfiles,
  mobileDeviceVisualBaselineStates
} from "./mobileDeviceVisualBaseline.mjs";

export const mobileHudAuditViewports = Object.freeze([
  { id: "iphone-portrait", width: 390, height: 844 },
  { id: "small-android", width: 360, height: 640 },
  { id: "phone-landscape", width: 844, height: 390 },
  { id: "tablet-portrait", width: 768, height: 1024 },
  { id: "tablet-landscape", width: 1024, height: 768 },
  {
    id: "galaxy-s23-font-150",
    width: 360,
    height: 780,
    deviceScaleFactor: 3,
    platform: "android",
    textScale: "xlarge"
  },
  {
    id: "iphone-15-dynamic-type",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    platform: "ios",
    textScale: "xlarge"
  }
]);

export function compactDynamicViewport(viewport) {
  const reduction = viewport.height >= 600 ? 120 : 48;
  return { width: viewport.width, height: Math.max(320, viewport.height - reduction) };
}

export function summarizeTouchLatency(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("Touch latency samples must contain at least one value");
  }
  const sorted = samples.map(Number).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) * 5) / 10
    : sorted[middle];
}

const overlapPairs = [
  ["hud", "controls"],
  ["hud", "minimap"],
  ["hud", "context"],
  ["minimap", "controls"],
  ["minimap", "context"],
  ["collection", "controls"],
  ["collection", "context"],
  ["context", "controls"]
];

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

export function auditWorldLabelRectangles(labels, overlapTolerance = 8) {
  const issues = [];
  for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
      const left = labels[leftIndex];
      const right = labels[rightIndex];
      if (overlapArea(left.rect, right.rect) > overlapTolerance) {
        issues.push(`${left.id}/${right.id} 라벨 겹침`);
      }
    }
  }
  return issues;
}

export function auditMobileHudRectangles(rectangles, viewport, overlapTolerance = 36) {
  const issues = [];
  for (const [name, rect] of Object.entries(rectangles)) {
    if (!rect) continue;
    if (
      rect.x < -1
      || rect.y < -1
      || rect.x + rect.width > viewport.width + 1
      || rect.y + rect.height > viewport.height + 1
    ) issues.push(`${name} 화면 이탈`);
  }
  for (const [leftName, rightName] of overlapPairs) {
    const left = rectangles[leftName];
    const right = rectangles[rightName];
    if (left && right && overlapArea(left, right) > overlapTolerance) {
      issues.push(`${leftName}/${rightName} 겹침`);
    }
  }
  return issues;
}

export function auditInvitationQualityMetrics(metrics) {
  const issues = [];
  const { floatingSpot, typography, largeTextSheet } = metrics;
  if (!floatingSpot?.hitTargetPreserved) issues.push("월드 안내 터치 영역 축소");
  if (!floatingSpot?.visuallyCompact) issues.push("월드 안내 카드 크기 초과");
  if (!floatingSpot?.contentContained) issues.push("월드 안내 문구 넘침");
  if (!typography?.koreanFallbackReady) issues.push("안드로이드 한글 폰트 대체 누락");
  if (!typography?.bundledFontsReady) issues.push("번들 한글 폰트 로드 실패");
  if (!typography?.fontResourcesSameOrigin) issues.push("한글 폰트 외부 출처 요청");
  if (!largeTextSheet?.contained) issues.push("큰 글자 바텀시트 화면 이탈");
  if (!largeTextSheet?.contentContained) issues.push("큰 글자 바텀시트 가로 넘침");
  if (!largeTextSheet?.touchTargetsReady) issues.push("큰 글자 바텀시트 터치 영역 부족");
  return issues;
}

async function waitForServer(url, process, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) throw new Error(`Vite exited before audit: ${process.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The development server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the mobile HUD audit server");
}

async function visibleRectangles(page) {
  return page.evaluate(() => {
    const selectors = {
      hud: ".world-hud",
      minimap: ".world-minimap",
      collection: ".world-collection-progress",
      context: ".world-context-action",
      controls: ".world-control-dock"
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return [name, null];
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [name, null];
      const rect = element.getBoundingClientRect();
      return [name, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
    }));
  });
}

async function visibleWorldLabels(page) {
  return page.evaluate(() => {
    const definitions = [
      ["spot", ".world-spot__card"],
      ["portal", ".world-portal__label"],
      ["npc", ".wedding-npc__label"]
    ];
    return definitions.flatMap(([kind, selector]) => (
      [...document.querySelectorAll(selector)].flatMap((element, index) => {
        if (!(element instanceof HTMLElement)) return [];
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.1) return [];
        const rect = element.getBoundingClientRect();
        return [{ id: `${kind}:${index}`, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }];
      })
    ));
  });
}

async function measureMovementLayoutStability(page) {
  const readLayout = () => page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return { hud: read(".world-hud"), map: read(".world-map") };
  });
  const before = await readLayout();
  const joystick = page.locator(".virtual-joystick");
  await joystick.focus();
  try {
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(700);
  } finally {
    await page.keyboard.up("ArrowRight").catch(() => undefined);
  }
  const during = await readLayout();
  await page.waitForTimeout(120);
  const after = await readLayout();
  const stable = ["hud", "map"].every((name) => {
    const baseline = before[name];
    return baseline && [during[name], after[name]].every((rect) => (
      rect
      && ["x", "y", "width", "height"].every((key) => Math.abs(rect[key] - baseline[key]) <= 1)
    ));
  });
  return { before, during, after, stable };
}

async function measureDynamicViewportAdaptation(page, viewport) {
  const readWorld = () => page.evaluate(() => {
    const element = document.querySelector(".game-world");
    if (!(element instanceof HTMLElement)) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const before = await readWorld();
  const compact = compactDynamicViewport(viewport);
  await page.setViewportSize(compact);
  await page.waitForTimeout(240);
  const compactWorld = await readWorld();
  const compactRectangles = await visibleRectangles(page);
  const compactIssues = auditMobileHudRectangles(compactRectangles, compact);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(240);
  const after = await readWorld();
  const restored = Boolean(before && after && ["x", "y", "width", "height"].every(
    (key) => Math.abs(before[key] - after[key]) <= 1
  ));
  return { before, compact, compactWorld, compactRectangles, compactIssues, after, restored };
}

async function measureJoystickTouchResponse(page, context) {
  const box = await page.locator(".virtual-joystick").boundingBox();
  if (!box) return { latencyMs: null, responded: false };
  const x = box.x + box.width - 4;
  const y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  const samples = [];
  try {
    for (let index = 0; index < 3; index += 1) {
      const startedAt = performance.now();
      let responded = false;
      try {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: index + 1 }]
        });
        await page.waitForFunction(() => (
          document.querySelector(".virtual-joystick__thumb")?.style.getPropertyValue("--joystick-x").trim() === "1"
        ), undefined, { timeout: 500 });
        responded = true;
      } catch {
        responded = false;
      } finally {
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }).catch(() => undefined);
      }
      const latencyMs = Math.round((performance.now() - startedAt) * 10) / 10;
      samples.push({ latencyMs, responded });
      await page.waitForFunction(() => (
        document.querySelector(".virtual-joystick__thumb")?.style.getPropertyValue("--joystick-x").trim() === "0"
      ), undefined, { timeout: 500 }).catch(() => undefined);
    }
  } finally {
    await session.detach().catch(() => undefined);
  }
  return {
    latencyMs: summarizeTouchLatency(samples.map((sample) => sample.latencyMs)),
    responded: samples.every((sample) => sample.responded),
    samples
  };
}

async function captureStableDeviceScreenshot(page, screenshotPath) {
  await page.evaluate(() => { document.documentElement.classList.add("device-visual-baseline-freeze"); });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
  await page.evaluate(() => { document.documentElement.classList.remove("device-visual-baseline-freeze"); });
}

async function measureInvitationQuality(page, viewport, sheetScreenshotPath, deviceSheetCurrentPath = null) {
  const floatingSpot = await page.evaluate(() => {
    const hitTarget = document.querySelector(".world-spot");
    const card = hitTarget?.querySelector(".world-spot__card");
    if (!(hitTarget instanceof HTMLElement) || !(card instanceof HTMLElement)) return null;
    const hitRect = hitTarget.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      hitRect: { width: hitRect.width, height: hitRect.height },
      cardRect: { width: cardRect.width, height: cardRect.height },
      hitTargetPreserved: hitRect.width >= 44 && hitRect.height >= 44,
      visuallyCompact: cardRect.width <= 100 && cardRect.height <= 68,
      contentContained: card.scrollWidth <= card.clientWidth + 1 && card.scrollHeight <= card.clientHeight + 1
    };
  });

  const previousTextScale = await page.evaluate(() => document.documentElement.dataset.textScale ?? null);
  await page.evaluate(() => { document.documentElement.dataset.textScale = "xlarge"; });
  await page.locator(".world-menu-button").click();
  await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "오시는 길", exact: true }).click();
  const sheet = page.locator(".bottom-sheet");
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: sheetScreenshotPath, fullPage: false });
  if (deviceSheetCurrentPath) await captureStableDeviceScreenshot(page, deviceSheetCurrentPath);
  const { typography, largeTextSheet } = await page.evaluate(({ width, height }) => {
    const world = document.querySelector(".game-world");
    const heading = document.querySelector(".bottom-sheet__header h2");
    const sheetElement = document.querySelector(".bottom-sheet");
    if (!(world instanceof HTMLElement) || !(heading instanceof HTMLElement) || !(sheetElement instanceof HTMLElement)) {
      return {
        typography: {
          uiFamily: "",
          displayFamily: "",
          koreanFallbackReady: false,
          bundledFontsReady: false,
          fontResourcesSameOrigin: false
        },
        largeTextSheet: { contained: false, contentContained: false, touchTargetsReady: false }
      };
    }
    const uiFamily = getComputedStyle(world).fontFamily;
    const displayFamily = getComputedStyle(heading).fontFamily;
    const fontResources = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".woff2"));
    const rect = sheetElement.getBoundingClientRect();
    const controls = [...sheetElement.querySelectorAll("button, a[href]")].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    return {
      typography: {
        uiFamily,
        displayFamily,
        koreanFallbackReady: /Noto Sans (?:CJK )?KR/.test(uiFamily) && /Noto Serif (?:CJK )?KR/.test(displayFamily),
        bundledFontsReady:
          document.fonts.check('700 16px "Noto Sans KR Variable"', "오시는 길")
          && document.fonts.check('700 16px "Noto Serif KR Variable"', "오시는 길"),
        fontResourcesSameOrigin:
          fontResources.length > 0
          && fontResources.every((name) => new URL(name, location.href).origin === location.origin),
        fontResourceCount: fontResources.length
      },
      largeTextSheet: {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        contained: rect.x >= -1 && rect.y >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1,
        contentContained: sheetElement.scrollWidth <= sheetElement.clientWidth + 1,
        touchTargetsReady: controls.length > 0 && controls.every((element) => element.getBoundingClientRect().height >= 43)
      }
    };
  }, viewport);
  await page.locator(".bottom-sheet__header button").click();
  await sheet.waitFor({ state: "hidden" });
  await page.evaluate((textScale) => {
    if (textScale) document.documentElement.dataset.textScale = textScale;
    else delete document.documentElement.dataset.textScale;
  }, previousTextScale);
  return { floatingSpot, typography, largeTextSheet, sheetScreenshotPath };
}

export async function runMobileHudBrowserAudit({ rootDir, outputDir, port = 4178, deviceBaselineMode = "compare" }) {
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/`;
  await mkdir(outputDir, { recursive: true });
  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const reports = [];
    try {
      for (const viewport of mobileHudAuditViewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          hasTouch: true,
          isMobile: true,
          locale: "ko-KR",
          colorScheme: "light",
          reducedMotion: "reduce",
          deviceScaleFactor: viewport.deviceScaleFactor ?? (viewport.id.startsWith("tablet") ? 1.5 : 2)
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
            version: 1,
            nickname: "화면감사",
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
        if (await resumeGarden.isVisible().catch(() => false)) {
          await resumeGarden.click();
        }
        await page.locator(".game-world").waitFor({ state: "visible" });
        await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
        await page.addStyleTag({ content: `
          html.device-visual-baseline-freeze *,
          html.device-visual-baseline-freeze *::before,
          html.device-visual-baseline-freeze *::after {
            animation: none !important;
            caret-color: transparent !important;
            transition: none !important;
          }
        ` });
        if (viewport.textScale) {
          await page.evaluate((textScale) => {
            document.documentElement.dataset.textScale = textScale;
          }, viewport.textScale);
        }
        const rectangles = await visibleRectangles(page);
        const issues = auditMobileHudRectangles(rectangles, viewport);
        const worldLabels = await visibleWorldLabels(page);
        auditWorldLabelRectangles(worldLabels).forEach((issue) => issues.push(issue));
        const deviceBaselineEnabled = mobileDeviceVisualBaselineProfiles.includes(viewport.id);
        const deviceVisualBaselines = deviceBaselineEnabled ? {
          game: {
            currentPath: path.join(outputDir, `mobile-device-${viewport.id}-game-current.png`)
          },
          "directions-xlarge": {
            currentPath: path.join(outputDir, `mobile-device-${viewport.id}-directions-xlarge-current.png`)
          }
        } : null;
        if (deviceVisualBaselines) {
          await page.evaluate(() => document.fonts.ready);
          await captureStableDeviceScreenshot(page, deviceVisualBaselines.game.currentPath);
        }
        const movementLayout = await measureMovementLayoutStability(page);
        if (!movementLayout.stable) issues.push("이동 중 HUD 또는 맵 화면 틀어짐");
        const dynamicViewport = await measureDynamicViewportAdaptation(page, viewport);
        dynamicViewport.compactIssues.forEach((issue) => issues.push(`주소창 축소 화면 ${issue}`));
        if (!dynamicViewport.restored) issues.push("주소창·회전 후 화면 복원 실패");
        const touchResponse = await measureJoystickTouchResponse(page, context);
        if (!touchResponse.responded) issues.push("joystick 터치 무응답");
        if (touchResponse.latencyMs !== null && touchResponse.latencyMs > 120) issues.push(`joystick 터치 지연 ${touchResponse.latencyMs}ms`);
        const screenshotPath = path.join(outputDir, `mobile-hud-${viewport.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        await page.locator(".world-hud__tools-toggle").click();
        const toolsPanel = page.locator(".world-hud__tools");
        await toolsPanel.waitFor({ state: "visible" });
        const toolsRect = await toolsPanel.boundingBox();
        if (
          !toolsRect
          || toolsRect.x < -1
          || toolsRect.y < -1
          || toolsRect.x + toolsRect.width > viewport.width + 1
          || toolsRect.y + toolsRect.height > viewport.height + 1
        ) issues.push("expanded-tools 화면 이탈");
        const toolsScreenshotPath = path.join(outputDir, `mobile-hud-${viewport.id}-tools.png`);
        await page.screenshot({ path: toolsScreenshotPath, fullPage: false });
        await page.locator(".world-hud__tools-toggle").click();
        const sheetScreenshotPath = path.join(outputDir, `mobile-hud-${viewport.id}-directions-xlarge.png`);
        const invitationQuality = await measureInvitationQuality(
          page,
          viewport,
          sheetScreenshotPath,
          deviceVisualBaselines?.["directions-xlarge"].currentPath
        );
        auditInvitationQualityMetrics(invitationQuality).forEach((issue) => issues.push(issue));
        if (deviceVisualBaselines && deviceBaselineMode === "compare") {
          for (const state of mobileDeviceVisualBaselineStates) {
            const diffPath = path.join(outputDir, `mobile-device-${viewport.id}-${state}-diff.png`);
            try {
              const comparison = await compareMobileDeviceVisualBaseline({
                rootDir,
                profileId: viewport.id,
                state,
                currentPath: deviceVisualBaselines[state].currentPath,
                diffPath
              });
              deviceVisualBaselines[state].comparison = comparison;
              if (!comparison.passed) {
                issues.push(`${state} 픽셀 변경률 ${(comparison.changedRatio * 100).toFixed(3)}%`);
              }
            } catch (error) {
              issues.push(`${state} 기기 시각 기준선 오류: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        reports.push({ ...viewport, rectangles, worldLabels, movementLayout, dynamicViewport, toolsRect, touchResponse, invitationQuality, deviceVisualBaselines, issues, screenshotPath, toolsScreenshotPath });
        await context.close();
      }
    } finally {
      await browser.close();
    }
    const reportPath = path.join(outputDir, "mobile-hud-browser-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
    const issues = reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`));
    if (issues.length > 0) throw new Error(`Mobile HUD browser audit failed:\n${issues.join("\n")}`);
    return { reports, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}
