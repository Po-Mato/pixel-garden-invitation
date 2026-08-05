import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  compareMobileDeviceVisualBaseline,
  mobileDeviceVisualBaselineProfiles,
  mobileDeviceVisualBaselineStates
} from "./mobileDeviceVisualBaseline.mjs";
import { runTypographyScaleAudit } from "./typographyScaleAudit.mjs";

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
  },
  {
    id: "iphone-15-webkit-dynamic-type",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    platform: "ios",
    engine: "webkit",
    textScale: "xlarge"
  },
  {
    id: "iphone-15-webkit-text-200",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    platform: "ios",
    engine: "webkit",
    textScale: "ios-200",
    requiredSheetScroll: 160
  }
]);

export const worldLabelAuditScenarios = Object.freeze([
  { id: "home-center", zoneId: "home", position: { x: 285, y: 555 } },
  { id: "neighborhood-west", zoneId: "neighborhood", position: { x: 135, y: 375 } },
  { id: "neighborhood-east", zoneId: "neighborhood", position: { x: 1095, y: 375 } },
  { id: "station-west", zoneId: "subway-station", position: { x: 135, y: 435 } },
  { id: "station-east", zoneId: "subway-station", position: { x: 705, y: 435 } },
  { id: "train-west", zoneId: "subway-train", position: { x: 135, y: 285 } },
  { id: "train-east", zoneId: "subway-train", position: { x: 1305, y: 285 } },
  { id: "venue-north", zoneId: "venue-exterior", position: { x: 465, y: 135 } },
  { id: "venue-south", zoneId: "venue-exterior", position: { x: 465, y: 765 } },
  { id: "lobby-center", zoneId: "lobby", position: { x: 525, y: 405 } },
  { id: "bridal-center", zoneId: "bridal-room", position: { x: 345, y: 405 } },
  { id: "hall-altar", zoneId: "ceremony-hall", position: { x: 375, y: 315 } },
  { id: "hall-entry", zoneId: "ceremony-hall", position: { x: 375, y: 1785 } },
  { id: "banquet-west", zoneId: "banquet", position: { x: 135, y: 465 } },
  { id: "banquet-east", zoneId: "banquet", position: { x: 1065, y: 465 } },
  { id: "banquet-guestbook", zoneId: "banquet", position: { x: 945, y: 735 } },
  { id: "restroom-entry", zoneId: "restroom", position: { x: 135, y: 345 } }
]);

export const worldLabelAuditProfiles = Object.freeze([
  { id: "iphone-portrait", width: 393, height: 852, deviceScaleFactor: 2 },
  { id: "compact-android", width: 360, height: 640, deviceScaleFactor: 3 },
  { id: "phone-landscape", width: 844, height: 390, deviceScaleFactor: 2 }
]);

export const iosText200AuditCss = `
  html[data-text-scale="ios-200"] {
    -webkit-text-size-adjust: 200%;
    text-size-adjust: 200%;
  }
  html[data-text-scale="ios-200"] .bottom-sheet {
    width: min(calc(100% - 16px), 420px);
    max-height: calc(100dvh - 12px - env(safe-area-inset-top));
    padding: 14px;
  }
  html[data-text-scale="ios-200"] .bottom-sheet__header {
    align-items: flex-start;
  }
  html[data-text-scale="ios-200"] .bottom-sheet__header h2 {
    font-size: 30px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  html[data-text-scale="ios-200"] .bottom-sheet__body {
    font-size: 200%;
  }
  html[data-text-scale="ios-200"] .bottom-sheet__body :is(p, li, a, button, label, dt, dd, time, span, strong) {
    font-size: 1em;
    line-height: 1.55;
  }
  html[data-text-scale="ios-200"] .directions-sheet__venue,
  html[data-text-scale="ios-200"] .directions-sheet__phone {
    grid-template-columns: var(--directions-icon-column) minmax(0, 1fr);
  }
  html[data-text-scale="ios-200"] :is(.directions-sheet__venue > button, .directions-sheet__phone > a) {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 56px;
  }
  html[data-text-scale="ios-200"] .directions-sheet__maps {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const iosSafariText200AuditCss = iosText200AuditCss.replace(`
  html[data-text-scale="ios-200"] .bottom-sheet__body {
    font-size: 200%;
  }
`, "");

export function compactDynamicViewport(viewport) {
  const reduction = viewport.height >= 600 ? 120 : 48;
  return { width: viewport.width, height: Math.max(320, viewport.height - reduction) };
}

export function dynamicViewportResizeApplied(target, actual, tolerance = 1) {
  return Boolean(actual && ["width", "height"].every(
    (key) => Math.abs(target[key] - actual[key]) <= tolerance
  ));
}

export function dynamicViewportLayoutApplied(target, actualViewport, world) {
  return dynamicViewportResizeApplied(target, actualViewport)
    && dynamicViewportResizeApplied(target, world);
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

export function auditWorldLabelZoneSweep(reports, expectedZoneIds, expectedProfileIds = []) {
  const issues = [];
  const profileIds = expectedProfileIds.length > 0 ? expectedProfileIds : [null];
  for (const profileId of profileIds) {
    const profileReports = profileId === null ? reports : reports.filter((report) => report.profileId === profileId);
    const coveredZoneIds = new Set(profileReports.map(({ zoneId }) => zoneId));
    const profilePrefix = profileId === null ? "" : `${profileId}/`;
    for (const zoneId of expectedZoneIds) {
      if (!coveredZoneIds.has(zoneId)) issues.push(`${profilePrefix}${zoneId}: 라벨 감사 누락`);
    }
    for (const report of profileReports) {
      const reportId = `${profilePrefix}${report.id}`;
      if (report.candidateCount === 0) issues.push(`${reportId}: 라벨 후보 없음`);
      auditWorldLabelRectangles(report.visibleLabels).forEach((issue) => issues.push(`${reportId}: ${issue}`));
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
  if (
    Number.isFinite(largeTextSheet?.requiredScrollRange)
    && largeTextSheet.requiredScrollRange > 0
    && largeTextSheet.actualScrollRange < largeTextSheet.requiredScrollRange
  ) issues.push("iOS 200% 큰 글자 바텀시트 실제 스크롤 범위 부족");
  for (const [state, scroll] of Object.entries(metrics.scrollStates ?? {})) {
    if (!scroll.reached) issues.push(`${state} 스크롤 위치 도달 실패`);
  }
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
        const owner = element.closest("[data-label-visibility]");
        const rect = element.getBoundingClientRect();
        const label = owner?.getAttribute("aria-label") ?? element.textContent?.trim() ?? String(index);
        return [{
          id: `${kind}:${label}`,
          visibility: owner?.getAttribute("data-label-visibility") ?? null,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }];
      })
    ));
  });
}

async function worldLabelVisibilitySummary(page) {
  return page.evaluate(() => {
    const owners = [...document.querySelectorAll("[data-label-visibility]")];
    return {
      candidateCount: owners.length,
      fullCount: owners.filter((element) => element.getAttribute("data-label-visibility") === "full").length,
      quietCount: owners.filter((element) => element.getAttribute("data-label-visibility") === "quiet").length
    };
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
  const actualViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const compactWorld = await readWorld();
  const supported = dynamicViewportLayoutApplied(compact, actualViewport, compactWorld);
  const compactRectangles = await visibleRectangles(page);
  const compactIssues = supported ? auditMobileHudRectangles(compactRectangles, compact) : [];
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(240);
  const after = await readWorld();
  const restored = Boolean(before && after && ["x", "y", "width", "height"].every(
    (key) => Math.abs(before[key] - after[key]) <= 1
  ));
  return { before, compact, actualViewport, supported, compactWorld, compactRectangles, compactIssues, after, restored };
}

async function measureJoystickTouchResponse(page, context, engine = "chromium") {
  if (engine !== "chromium") {
    return { latencyMs: null, responded: true, samples: [], method: "webkit-soak-covered" };
  }
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

async function setAuditTextScale(page, textScale) {
  if (textScale === "ios-200") {
    await page.addStyleTag({ content: iosText200AuditCss });
  }
  await page.evaluate((scale) => {
    if (scale) document.documentElement.dataset.textScale = scale;
    else delete document.documentElement.dataset.textScale;
  }, textScale);
}

async function measureInvitationQuality(page, viewport, sheetScreenshotPath, deviceSheetCurrentPaths = null) {
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
  await setAuditTextScale(page, viewport.textScale ?? "xlarge");
  await page.locator(".world-menu-button").click();
  await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "오시는 길", exact: true }).click();
  const sheet = page.locator(".bottom-sheet");
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: sheetScreenshotPath, fullPage: false });
  const scrollStates = {};
  for (const [state, ratio] of [
    ["directions-xlarge", 0],
    ["directions-xlarge-middle", 0.5],
    ["directions-xlarge-bottom", 1]
  ]) {
    await sheet.evaluate((element, targetRatio) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.round(maxScroll * targetRatio);
    }, ratio);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const scroll = await sheet.evaluate((element, targetRatio) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const target = Math.round(maxScroll * targetRatio);
      return {
        scrollTop: element.scrollTop,
        maxScroll,
        target,
        ratio: maxScroll > 0 ? element.scrollTop / maxScroll : 0,
        reached: Math.abs(element.scrollTop - target) <= 2
      };
    }, ratio);
    scrollStates[state] = scroll;
    if (deviceSheetCurrentPaths?.[state]?.currentPath) {
      await captureStableDeviceScreenshot(page, deviceSheetCurrentPaths[state].currentPath);
    }
  }
  await sheet.evaluate((element) => { element.scrollTop = 0; });
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
  largeTextSheet.actualScrollRange = Math.max(0, ...Object.values(scrollStates).map(({ maxScroll }) => maxScroll));
  largeTextSheet.requiredScrollRange = viewport.requiredSheetScroll ?? 0;
  await page.locator(".bottom-sheet__header button").click();
  await sheet.waitFor({ state: "hidden" });
  await page.evaluate((textScale) => {
    if (textScale) document.documentElement.dataset.textScale = textScale;
    else delete document.documentElement.dataset.textScale;
  }, previousTextScale);
  return { floatingSpot, typography, largeTextSheet, scrollStates, sheetScreenshotPath };
}

async function runWorldLabelZoneSweep({ browser, url, outputDir }) {
  const reports = [];
  for (const profile of worldLabelAuditProfiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      hasTouch: true,
      isMobile: true,
      locale: "ko-KR",
      colorScheme: "light",
      reducedMotion: "reduce",
      deviceScaleFactor: profile.deviceScaleFactor
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
        version: 1,
        nickname: "라벨감사",
        appearance: { presetId: "feminine-long-wave-dress" },
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
        version: 1,
        completed: true,
        completedAt: new Date().toISOString()
      }));
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      for (const scenario of worldLabelAuditScenarios) {
        await page.evaluate(({ zoneId, position }) => {
          localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
            version: 1,
            zoneId,
            position,
            direction: "down",
            guideCheckpointId: null,
            updatedAt: new Date().toISOString()
          }));
        }, scenario);
        await page.reload({ waitUntil: "domcontentloaded" });
        const resumeGarden = page.locator(".entry-screen__resume-access");
        if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
        await page.locator(`.world-map__stage[data-zone="${scenario.zoneId}"]`).waitFor({ state: "visible" });
        await page.locator(`.world-map__stage--background-loaded[data-zone="${scenario.zoneId}"]`).waitFor({
          state: "visible",
          timeout: 15_000
        });
        await page.addStyleTag({ content: `
          html.world-label-zone-freeze *,
          html.world-label-zone-freeze *::before,
          html.world-label-zone-freeze *::after {
            animation: none !important;
            caret-color: transparent !important;
            transition: none !important;
          }
        ` });
        await page.evaluate(() => {
          document.documentElement.classList.add("world-label-zone-freeze");
          return document.fonts.ready;
        });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const visibleLabels = await visibleWorldLabels(page);
        const visibility = await worldLabelVisibilitySummary(page);
        const screenshotPath = path.join(outputDir, `world-label-${profile.id}-${scenario.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
        reports.push({ ...scenario, profileId: profile.id, width: profile.width, height: profile.height, ...visibility, visibleLabels, screenshotPath });
      }
    } finally {
      await context.close();
    }
  }
  const expectedZoneIds = [...new Set(worldLabelAuditScenarios.map(({ zoneId }) => zoneId))];
  const expectedProfileIds = worldLabelAuditProfiles.map(({ id }) => id);
  return {
    reports,
    issues: auditWorldLabelZoneSweep(reports, expectedZoneIds, expectedProfileIds),
    expectedZoneIds,
    profiles: worldLabelAuditProfiles
  };
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
    const playwright = await import("playwright");
    const browsers = new Map();
    const browserFor = async (engine) => {
      if (!browsers.has(engine)) browsers.set(engine, await playwright[engine].launch({ headless: true }));
      return browsers.get(engine);
    };
    const reports = [];
    let zoneLabelSweep = { reports: [], issues: [], expectedZoneIds: [] };
    let typographyScaleAudit = { reports: [], issues: [], profiles: [] };
    try {
      for (const viewport of mobileHudAuditViewports) {
        const engine = viewport.engine ?? "chromium";
        const browser = await browserFor(engine);
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
          html.device-visual-baseline-freeze .world-travel-status-row,
          html.device-visual-baseline-freeze .world-route-arrival-card {
            display: none !important;
          }
        ` });
        if (viewport.textScale) await setAuditTextScale(page, viewport.textScale);
        const rectangles = await visibleRectangles(page);
        const issues = auditMobileHudRectangles(rectangles, viewport);
        const worldLabels = await visibleWorldLabels(page);
        auditWorldLabelRectangles(worldLabels).forEach((issue) => issues.push(issue));
        const deviceBaselineEnabled = mobileDeviceVisualBaselineProfiles.includes(viewport.id);
        const deviceVisualBaselines = deviceBaselineEnabled
          ? Object.fromEntries(mobileDeviceVisualBaselineStates.map((state) => [state, {
            currentPath: path.join(outputDir, `mobile-device-${viewport.id}-${state}-current.png`)
          }]))
          : null;
        if (deviceVisualBaselines) {
          await page.evaluate(() => document.fonts.ready);
          await captureStableDeviceScreenshot(page, deviceVisualBaselines.game.currentPath);
        }
        const movementLayout = await measureMovementLayoutStability(page);
        if (!movementLayout.stable) issues.push("이동 중 HUD 또는 맵 화면 틀어짐");
        const dynamicViewport = await measureDynamicViewportAdaptation(page, viewport);
        dynamicViewport.compactIssues.forEach((issue) => issues.push(`주소창 축소 화면 ${issue}`));
        if (!dynamicViewport.restored) issues.push("주소창·회전 후 화면 복원 실패");
        const touchResponse = await measureJoystickTouchResponse(page, context, engine);
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
          deviceVisualBaselines
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
        reports.push({ ...viewport, engine, rectangles, worldLabels, movementLayout, dynamicViewport, toolsRect, touchResponse, invitationQuality, deviceVisualBaselines, issues, screenshotPath, toolsScreenshotPath });
        await context.close();
      }
      zoneLabelSweep = await runWorldLabelZoneSweep({
        browser: await browserFor("chromium"),
        url,
        outputDir
      });
      typographyScaleAudit = await runTypographyScaleAudit({
        browser: await browserFor("chromium"),
        url,
        outputDir
      });
    } finally {
      await Promise.all([...browsers.values()].map((browser) => browser.close()));
    }
    const reportPath = path.join(outputDir, "mobile-hud-browser-report.json");
    await writeFile(reportPath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      reports,
      zoneLabelSweep,
      typographyScaleAudit
    }, null, 2)}\n`);
    const issues = [
      ...reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`)),
      ...zoneLabelSweep.issues,
      ...typographyScaleAudit.issues
    ];
    if (issues.length > 0) throw new Error(`Mobile HUD browser audit failed:\n${issues.join("\n")}`);
    return { reports, zoneLabelSweep, typographyScaleAudit, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}
