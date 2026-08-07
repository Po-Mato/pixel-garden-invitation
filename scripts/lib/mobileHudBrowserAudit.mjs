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

const portraitCollisionWidths = [
  { width: 320, height: 568, deviceScaleFactor: 2 },
  { width: 360, height: 780, deviceScaleFactor: 3 },
  { width: 390, height: 844, deviceScaleFactor: 3 },
  { width: 430, height: 932, deviceScaleFactor: 3 }
];

const collisionTextScales = [
  { suffix: "100", textPercent: 100, textScale: null },
  { suffix: "150", textPercent: 150, textScale: "xlarge" },
  { suffix: "200", textPercent: 200, textScale: "ios-200" }
];

export const mobileHudCollisionMatrixProfiles = Object.freeze([
  ...portraitCollisionWidths.flatMap((viewport) => collisionTextScales.map((scale) => ({
    id: `portrait-${viewport.width}-text-${scale.suffix}`,
    ...viewport,
    ...scale,
    orientation: "portrait"
  }))),
  {
    id: "landscape-568x320-text-100",
    width: 568,
    height: 320,
    deviceScaleFactor: 2,
    textPercent: 100,
    textScale: null,
    orientation: "landscape"
  },
  {
    id: "landscape-844x390-text-150",
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    textPercent: 150,
    textScale: "xlarge",
    orientation: "landscape"
  },
  {
    id: "landscape-932x430-text-200",
    width: 932,
    height: 430,
    deviceScaleFactor: 3,
    textPercent: 200,
    textScale: "ios-200",
    orientation: "landscape"
  }
]);

export const longVenueAuditProfiles = Object.freeze([
  { id: "venue-320-portrait", width: 320, height: 568, orientation: "portrait" },
  { id: "venue-568-landscape", width: 568, height: 320, orientation: "landscape" }
]);

export const largeTextAccessibilityProfiles = Object.freeze([
  { id: "compact-portrait-320-text-200", width: 320, height: 568, orientation: "portrait", textScale: "ios-200" },
  { id: "compact-landscape-568x320-text-200", width: 568, height: 320, orientation: "landscape", textScale: "ios-200" }
]);

export const remoteNameplateCrowdScenarios = Object.freeze([
  { id: "left-edge-3", count: 3, edge: "left" },
  { id: "right-edge-5", count: 5, edge: "right" },
  { id: "bottom-edge-8", count: 8, edge: "bottom" },
  { id: "world-ui-8", count: 8, edge: "center", obstacle: true }
]);

export const hudLongTextFixture = Object.freeze({
  zone: "MJ컨벤션 외부",
  destination: "지하철 오시는 길"
});

export const worldLabelAuditScenarios = Object.freeze([
  { id: "home-center", zoneId: "home", position: { x: 285, y: 375 } },
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
  ["context", "controls"],
  ["tools", "minimap"],
  ["tools", "collection"],
  ["tools", "context"],
  ["tools", "controls"],
  ["tools", "toolsToggle"],
  ["tools", "hudStatus"]
];

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

export function auditRemoteNameplateCrowd(report, overlapTolerance = 1) {
  const issues = [];
  if (report.labels.length !== report.count) {
    issues.push(`이름표 수 불일치 ${report.labels.length}/${report.count}`);
  }
  report.labels.forEach((label) => {
    if (!label.contained) issues.push(`${label.id} 맵 화면 이탈`);
    if (!label.singleLine) issues.push(`${label.id} 여러 줄 표시`);
    if (!label.ellipsisReady) issues.push(`${label.id} 긴 이름 생략 실패`);
    if (!label.fullNameAvailable) issues.push(`${label.id} 전체 이름 접근 불가`);
    if (label.avoidsObstacles === false) issues.push(`${label.id} 월드 UI와 겹침`);
  });
  for (let leftIndex = 0; leftIndex < report.labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < report.labels.length; rightIndex += 1) {
      const left = report.labels[leftIndex];
      const right = report.labels[rightIndex];
      if (overlapArea(left.rect, right.rect) > overlapTolerance) {
        issues.push(`${left.id}/${right.id} 이름표 겹침`);
      }
    }
  }
  return issues;
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

export function auditHudTextContainment(entries) {
  return entries.flatMap(({ id, text, clippedInline, clippedBlock, lineCount, maxLines }) => {
    if (!text) return [];
    const issues = [];
    if (clippedInline || clippedBlock) issues.push(`${id} 문구 잘림`);
    if (Number.isFinite(lineCount) && Number.isFinite(maxLines) && lineCount > maxLines) {
      issues.push(`${id} 문구 과도한 줄바꿈`);
    }
    return issues;
  });
}

export function auditInvitationQualityMetrics(metrics) {
  const issues = [];
  const { floatingSpot, typography, largeTextSheet } = metrics;
  if (!floatingSpot?.hitTargetPreserved) issues.push("월드 안내 터치 영역 축소");
  if (!floatingSpot?.visuallyCompact) issues.push("월드 안내 카드 크기 초과");
  if (!floatingSpot?.contentContained) issues.push("월드 안내 문구 넘침");
  if (!typography?.koreanFallbackReady) issues.push("안드로이드 한글 폰트 대체 누락");
  if (!typography?.uiFontReady) issues.push("시스템 한글 UI 폰트 준비 실패");
  if (!typography?.bundledDisplayFontReady) issues.push("번들 한글 명조 폰트 로드 실패");
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

export function auditPlayerNameplate(metrics) {
  const issues = [];
  if (!metrics?.singleLine) issues.push("캐릭터 이름표 줄바꿈");
  if (!metrics?.contained) issues.push("캐릭터 이름표 영역 이탈");
  if (!metrics?.ellipsisReady) issues.push("긴 캐릭터 이름 말줄임 누락");
  if (!metrics?.fullNameAvailable) issues.push("캐릭터 전체 이름 접근 불가");
  return issues;
}

export function auditLongVenueLayout(metrics) {
  const issues = [];
  if (!metrics?.sheetContained) issues.push("오시는 길 시트 화면 이탈");
  if (!metrics?.contentContained) issues.push("오시는 길 긴 문구 가로 넘침");
  if (!metrics?.venueTextComplete) issues.push("예식장 전체 문구 누락");
  if (!metrics?.venueLinesReady) issues.push("예식장 문구 과도한 줄바꿈");
  if (!metrics?.addressLinesReady) issues.push("예식장 주소 과도한 줄바꿈");
  if (!metrics?.copyTargetReady) issues.push("주소 복사 터치 영역 부족");
  return issues;
}

export function auditLargeTextAccessibilityFlow(report) {
  const issues = [];
  if (!report.dialogNamed) issues.push("오시는 길 대화상자 이름 누락");
  if (!report.modal) issues.push("오시는 길 모달 의미 누락");
  if (!report.underlyingContentInert) issues.push("오시는 길 뒤 콘텐츠 스크린리더 격리 실패");
  if (!report.initialFocusOnHeading) issues.push("오시는 길 제목 초기 포커스 실패");
  if (!report.focusTrapWrapped) issues.push("오시는 길 포커스 순환 실패");
  if (!report.focusRestored) issues.push("오시는 길 닫기 후 메뉴 포커스 복원 실패");
  if (!report.menuRemainedOpen) issues.push("오시는 길 닫기 후 상위 메뉴 유실");
  if (!report.sheetContained) issues.push("200% 오시는 길 시트 화면 이탈");
  if (!report.contentContained) issues.push("200% 오시는 길 내용 가로 넘침");
  if (!report.touchTargetsReady) issues.push("200% 오시는 길 터치 영역 부족");
  const expectedOrder = ["닫기", "주소 복사", "네이버지도", "카카오맵", "Google 지도"];
  if (!expectedOrder.every((name, index) => report.focusOrder[index] === name)) {
    issues.push("오시는 길 스크린리더 탐색 순서 불일치");
  }
  return issues;
}

export function auditRealtimeResilience(report, tolerance = 1) {
  const issues = [];
  if (!report.phases.includes("connecting")) issues.push("실시간 지연 상태 미검증");
  if (!report.phases.includes("reconnecting")) issues.push("실시간 거부 상태 미검증");
  if (!report.dotCompact) issues.push("실시간 상태 점 크기 증가");
  if (!report.layoutStable || report.maximumLayoutDelta > tolerance) issues.push("실시간 장애 중 레이아웃 이동");
  if (report.closedConnectionFeedback.length > 0) issues.push("실시간 장애 문구가 닫힌 HUD 밖에 노출됨");
  if (report.blockingSurfaces.length > 0) issues.push("실시간 장애가 초대장 이용을 가로막음");
  if (!report.expandedStatus?.includes("초대장 이용 가능")) issues.push("실시간 장애 비차단 안내 누락");
  if (report.pageErrors.length > 0) issues.push(`실시간 장애 중 페이지 오류 ${report.pageErrors.join(" | ")}`);
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
      controls: ".world-control-dock",
      tools: ".world-hud__tools",
      toolsToggle: ".world-hud__tools-toggle",
      hudStatus: ".world-hud__status"
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

async function hudTextContainment(page) {
  return page.evaluate(() => [
    ["현재 구역", ".world-zone-summary strong", 2],
    ["안내 버튼", ".world-hud__tools-toggle > span", 1],
    ["다음 목적지", ".world-destination-guide strong", 2]
  ].flatMap(([id, selector, maxLines]) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) return [];
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return [];
    const lineHeight = Number.parseFloat(style.lineHeight);
    const clipsInline = style.overflowX !== "visible";
    const clipsBlock = style.overflowY !== "visible";
    const blockTolerance = Number.isFinite(lineHeight) ? Math.max(2, lineHeight * 0.25) : 2;
    const lineCount = lineHeight > 0
      ? Math.max(1, Math.round(element.getBoundingClientRect().height / lineHeight))
      : 1;
    return [{
      id,
      text: element.textContent?.trim() ?? "",
      clippedInline: clipsInline && element.scrollWidth > element.clientWidth + 1,
      clippedBlock: clipsBlock && element.scrollHeight > element.clientHeight + blockTolerance,
      lineCount,
      maxLines,
      client: { width: element.clientWidth, height: element.clientHeight },
      scroll: { width: element.scrollWidth, height: element.scrollHeight }
    }];
  }));
}

async function measurePlayerNameplate(page) {
  return page.evaluate(async () => {
    const element = document.querySelector(".world-player__name");
    const owner = element?.closest(".world-player");
    if (!(element instanceof HTMLElement) || !(owner instanceof HTMLElement)) return null;
    const originalText = element.textContent ?? "";
    const originalTitle = element.title;
    const stressName = "모바일초대장긴하객이름";
    element.textContent = stressName;
    element.title = stressName;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const ownerRect = owner.getBoundingClientRect();
    const lineHeight = Number.parseFloat(style.lineHeight);
    const contentHeight = rect.height
      - Number.parseFloat(style.paddingTop)
      - Number.parseFloat(style.paddingBottom)
      - Number.parseFloat(style.borderTopWidth)
      - Number.parseFloat(style.borderBottomWidth);
    const metrics = {
      text: stressName,
      singleLine: style.whiteSpace === "nowrap" && (!Number.isFinite(lineHeight) || contentHeight <= lineHeight + 1),
      contained: rect.left >= ownerRect.left - 1 && rect.right <= ownerRect.right + 1,
      ellipsisReady: style.overflow === "hidden" && style.textOverflow === "ellipsis" && element.scrollWidth > element.clientWidth,
      fullNameAvailable: element.title === stressName,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    };
    element.textContent = originalText;
    element.title = originalTitle;
    return metrics;
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
          uiFontReady: false,
          bundledDisplayFontReady: false,
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
        uiFontReady: /-apple-system|BlinkMacSystemFont|Apple SD Gothic Neo|Noto Sans (?:CJK )?KR|Malgun Gothic|system-ui/.test(uiFamily),
        bundledDisplayFontReady: document.fonts.check('700 16px "Noto Serif KR Critical"', "오시는 길"),
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

async function runRemoteNameplateCrowdAudit({ browser, url, outputDir }) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
    locale: "ko-KR",
    colorScheme: "light",
    reducedMotion: "reduce",
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  const reports = [];
  await page.addInitScript(() => {
    localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
      version: 1,
      nickname: "이름표감사",
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
    const resumeGarden = page.locator(".entry-screen__resume-access");
    if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
    await page.locator(".game-world").waitFor({ state: "visible" });
    await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
    await page.addStyleTag({ content: `
      .remote-nameplate-audit-layer {
        position: absolute;
        inset: 0;
        z-index: 90;
        overflow: hidden;
        pointer-events: none;
      }
      .remote-nameplate-audit-layer .remote-nameplate-audit-guest {
        display: block;
        width: 0;
        height: 0;
        transform: none !important;
        transition: none !important;
      }
      .remote-nameplate-audit-layer .world-player__name {
        position: absolute;
        top: 0;
        left: -32px;
        width: 64px;
        max-width: 64px;
        transition: none !important;
      }
      .remote-nameplate-audit-obstacle {
        position: absolute;
        border: 1px solid rgba(92, 72, 78, 0.45);
        background: rgba(255, 253, 249, 0.92);
        color: #514348;
        font-size: 10px;
        font-weight: 800;
        display: grid;
        place-items: center;
      }
    ` });
    for (const scenario of remoteNameplateCrowdScenarios) {
      await page.evaluate(async ({ count, edge, obstacle: obstacleEnabled }) => {
        document.querySelector(".remote-nameplate-audit-layer")?.remove();
        const map = document.querySelector(".world-map");
        if (!(map instanceof HTMLElement)) throw new Error("world map missing");
        const width = map.clientWidth;
        const height = map.clientHeight;
        const anchor = edge === "left"
          ? { x: 18, y: Math.round(height * 0.54) }
          : edge === "right"
            ? { x: width - 18, y: Math.round(height * 0.34) }
            : edge === "bottom"
              ? { x: Math.round(width / 2), y: height - 22 }
              : { x: Math.round(width / 2), y: Math.round(height * 0.44) };
        const safeBottom = height - Math.min(104, height * 0.22);
        const guests = Array.from({ length: count }, (_, index) => ({
          guestId: `visual-edge-${index + 1}`,
          x: anchor.x + (index % 2),
          y: anchor.y + (index % 2)
        }));
        const module = await import("/src/game/remoteGuestNameplates.ts");
        const obstacles = obstacleEnabled ? [{
          id: "world-spot",
          left: anchor.x - 56,
          right: anchor.x + 56,
          top: anchor.y - 24,
          bottom: anchor.y + 42
        }] : [];
        const placements = module.placeRemoteGuestNameplates(guests, {
          left: 4,
          right: width - 4,
          top: 4,
          bottom: safeBottom
        }, obstacles);
        const layer = document.createElement("div");
        layer.className = "remote-nameplate-audit-layer";
        layer.dataset.count = String(count);
        layer.dataset.safeBottom = String(safeBottom);
        for (const [index, guest] of guests.entries()) {
          const placement = placements.get(guest.guestId);
          const fullName = `모바일초대장긴하객이름${index + 1}`;
          const owner = document.createElement("div");
          owner.className = "world-player player player--remote remote-nameplate-audit-guest";
          owner.dataset.auditGuestId = guest.guestId;
          if (placement?.crowded) owner.dataset.nameplateCrowded = "true";
          owner.style.left = `${guest.x}px`;
          owner.style.top = `${guest.y}px`;
          owner.style.setProperty("--remote-name-offset-x", `${placement?.x ?? 0}px`);
          owner.style.setProperty("--remote-name-offset-y", `${placement?.y ?? 0}px`);
          const name = document.createElement("span");
          name.className = "world-player__name";
          name.textContent = fullName;
          name.title = fullName;
          owner.append(name);
          layer.append(owner);
        }
        for (const obstacle of obstacles) {
          const blocked = document.createElement("span");
          blocked.className = "remote-nameplate-audit-obstacle";
          blocked.dataset.auditObstacle = obstacle.id;
          blocked.textContent = "월드 안내";
          blocked.style.left = `${obstacle.left}px`;
          blocked.style.top = `${obstacle.top}px`;
          blocked.style.width = `${obstacle.right - obstacle.left}px`;
          blocked.style.height = `${obstacle.bottom - obstacle.top}px`;
          layer.append(blocked);
        }
        map.append(layer);
        await document.fonts.ready;
      }, scenario);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => {
        const layer = document.querySelector(".remote-nameplate-audit-layer");
        if (!(layer instanceof HTMLElement)) throw new Error("nameplate audit layer missing");
        const layerRect = layer.getBoundingClientRect();
        const safeBottom = Number(layer.dataset.safeBottom) || layer.clientHeight;
        const obstacleRects = [...layer.querySelectorAll("[data-audit-obstacle]")]
          .map((element) => element.getBoundingClientRect());
        const labels = [...layer.querySelectorAll(".world-player__name")].map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const owner = element.closest("[data-audit-guest-id]");
          return {
            id: owner?.getAttribute("data-audit-guest-id") ?? "unknown",
            contained: rect.left >= layerRect.left - 1
              && rect.right <= layerRect.right + 1
              && rect.top >= layerRect.top - 1
              && rect.bottom <= layerRect.top + safeBottom + 1,
            singleLine: style.whiteSpace === "nowrap" && element.scrollHeight <= element.clientHeight + 1,
            ellipsisReady: style.overflow === "hidden"
              && style.textOverflow === "ellipsis"
              && element.scrollWidth > element.clientWidth,
            fullNameAvailable: element.title === element.textContent,
            avoidsObstacles: obstacleRects.every((obstacle) => (
              rect.right <= obstacle.left
                || obstacle.right <= rect.left
                || rect.bottom <= obstacle.top
                || obstacle.bottom <= rect.top
            )),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
        });
        return { labels, mapRect: { x: layerRect.x, y: layerRect.y, width: layerRect.width, height: layerRect.height } };
      });
      const report = { ...scenario, ...metrics };
      const issues = auditRemoteNameplateCrowd(report);
      const screenshotPath = path.join(outputDir, `remote-nameplates-${scenario.id}.png`);
      await page.locator(".world-map").screenshot({ path: screenshotPath, scale: "css" });
      reports.push({ ...report, issues, screenshotPath });
    }
  } finally {
    await context.close();
  }
  return {
    scenarios: remoteNameplateCrowdScenarios,
    reports,
    issues: reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`))
  };
}

async function runRealtimeResilienceAudit({ browser, url, outputDir }) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
    locale: "ko-KR",
    colorScheme: "light",
    reducedMotion: "reduce",
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
      version: 1,
      nickname: "연결감사",
      appearance: { presetId: "feminine-long-wave-dress" },
      updatedAt: new Date().toISOString()
    }));
    localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
      version: 1,
      completed: true,
      completedAt: new Date().toISOString()
    }));

    class DelayedDeniedWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      CONNECTING = 0;
      OPEN = 1;
      CLOSING = 2;
      CLOSED = 3;
      readyState = DelayedDeniedWebSocket.CONNECTING;
      bufferedAmount = 0;
      extensions = "";
      protocol = "";
      binaryType = "blob";
      onopen = null;
      onerror = null;
      onclose = null;
      onmessage = null;
      url;

      constructor(url) {
        super();
        this.url = String(url);
        window.setTimeout(() => {
          if (this.readyState !== DelayedDeniedWebSocket.CONNECTING) return;
          this.dispatchEvent(new Event("error"));
          this.readyState = DelayedDeniedWebSocket.CLOSED;
          this.dispatchEvent(new CloseEvent("close", { code: 1006, wasClean: false }));
        }, 900);
      }

      send() {}

      close() {
        if (this.readyState === DelayedDeniedWebSocket.CLOSED) return;
        this.readyState = DelayedDeniedWebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent("close", { code: 1000, wasClean: true }));
      }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: DelayedDeniedWebSocket });
  });

  const readState = async () => page.evaluate(() => {
    const readRect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const dot = document.querySelector(".world-hud__tools-toggle .realtime-pill");
    const dotRect = dot instanceof HTMLElement ? dot.getBoundingClientRect() : null;
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const status = dot?.className.match(/realtime-pill--([a-z-]+)/)?.[1] ?? "missing";
    const closedConnectionFeedback = [...document.querySelectorAll(".world-travel-status-row, .pwa-status, [role=alert]")]
      .filter(visible)
      .map((element) => element.textContent?.trim() ?? "")
      .filter((text) => /같이 걷기.*(?:연결|재연결)|(?:연결|재연결).*같이 걷기/.test(text));
    const blockingSurfaces = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], .bottom-sheet-backdrop')]
      .filter(visible)
      .map((element) => element.className || element.getAttribute("role") || "unknown");
    return {
      status,
      layout: {
        world: readRect(".game-world"),
        map: readRect(".world-map"),
        hud: readRect(".world-hud"),
        controls: readRect(".world-controls")
      },
      dot: dotRect ? { width: dotRect.width, height: dotRect.height } : null,
      closedConnectionFeedback: [...new Set(closedConnectionFeedback)],
      blockingSurfaces
    };
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const resumeGarden = page.locator(".entry-screen__resume-access");
    if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
    await page.locator(".game-world").waitFor({ state: "visible" });
    await page.locator('.world-hud__tools-toggle .realtime-pill[aria-label^="같이 걷기 연결 중"]').waitFor({ state: "visible" });
    const delayed = await readState();
    await page.waitForFunction(() => (
      document.querySelector(".world-hud__tools-toggle .realtime-pill")
        ?.classList.contains("realtime-pill--reconnecting")
    ));
    const denied = await readState();
    await page.locator(".world-hud__tools-toggle").click();
    const expandedStatus = await page.locator(".world-hud__tools .realtime-pill").innerText();
    await page.locator(".world-hud__tools-toggle").click();
    const layoutDeltas = Object.keys(delayed.layout).flatMap((key) => {
      const before = delayed.layout[key];
      const after = denied.layout[key];
      if (!before && !after) return [0];
      return before && after ? [
        Math.abs(before.x - after.x),
        Math.abs(before.y - after.y),
        Math.abs(before.width - after.width),
        Math.abs(before.height - after.height)
      ] : [Number.POSITIVE_INFINITY];
    });
    const maximumLayoutDelta = Math.max(...layoutDeltas);
    const report = {
      phases: [delayed.status, denied.status],
      delayed,
      denied,
      dotCompact: [delayed.dot, denied.dot].every((dot) => dot && dot.width <= 10 && dot.height <= 10),
      maximumLayoutDelta,
      layoutStable: Number.isFinite(maximumLayoutDelta) && maximumLayoutDelta <= 1,
      closedConnectionFeedback: [...new Set([
        ...delayed.closedConnectionFeedback,
        ...denied.closedConnectionFeedback
      ])],
      blockingSurfaces: [...new Set([...delayed.blockingSurfaces, ...denied.blockingSurfaces])],
      expandedStatus,
      pageErrors,
      screenshotPath: path.join(outputDir, "realtime-delayed-denied.png")
    };
    report.issues = auditRealtimeResilience(report);
    await page.screenshot({ path: report.screenshotPath, fullPage: false, scale: "css" });
    return report;
  } finally {
    await context.close();
  }
}

async function runMobileHudCollisionMatrix({ browser, url, outputDir }) {
  const reports = [];
  for (const profile of mobileHudCollisionMatrixProfiles) {
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
        nickname: "중첩감사",
        appearance: { presetId: "feminine-long-wave-dress" },
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
        version: 1,
        completed: true,
        completedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
        version: 1,
        zoneId: "home",
        position: { x: 285, y: 555 },
        direction: "down",
        guideCheckpointId: null,
        updatedAt: new Date().toISOString()
      }));
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
      await page.addStyleTag({ content: `
        html.hud-collision-matrix-freeze *,
        html.hud-collision-matrix-freeze *::before,
        html.hud-collision-matrix-freeze *::after {
          animation: none !important;
          caret-color: transparent !important;
          transition: none !important;
        }
      ` });
      await setAuditTextScale(page, profile.textScale);
      await page.evaluate(() => {
        document.documentElement.classList.add("hud-collision-matrix-freeze");
        return document.fonts.ready;
      });
      const longTextStress = profile.id === "portrait-320-text-100" || profile.id === "landscape-568x320-text-100";
      if (longTextStress) {
        await page.evaluate((fixture) => {
          const zone = document.querySelector(".world-zone-summary strong");
          const destination = document.querySelector(".world-destination-guide strong");
          if (zone) zone.textContent = fixture.zone;
          if (destination) destination.textContent = fixture.destination;
        }, hudLongTextFixture);
      }
      const baseRectangles = await visibleRectangles(page);
      const baseIssues = auditMobileHudRectangles(baseRectangles, profile);
      const hudText = await hudTextContainment(page);
      const textIssues = profile.orientation === "landscape" || longTextStress ? auditHudTextContainment(hudText) : [];
      await page.locator(".world-hud__tools-toggle").click();
      await page.locator(".world-hud__tools").waitFor({ state: "visible" });
      const toolsRectangles = await visibleRectangles(page);
      const toolsIssues = auditMobileHudRectangles(toolsRectangles, profile);
      const issues = [
        ...baseIssues.map((issue) => `기본 상태 ${issue}`),
        ...textIssues.map((issue) => `기본 상태 ${issue}`),
        ...toolsIssues.map((issue) => `안내 도구 상태 ${issue}`)
      ];
      let screenshotPath = null;
      if (issues.length > 0) {
        screenshotPath = path.join(outputDir, `hud-collision-${profile.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
      }
      reports.push({ ...profile, longTextStress, baseRectangles, toolsRectangles, hudText, issues, screenshotPath });
    } finally {
      await context.close();
    }
  }
  return {
    profiles: mobileHudCollisionMatrixProfiles,
    reports,
    issues: reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`))
  };
}

async function runLongVenueAudit({ browser, url }) {
  const reports = [];
  for (const profile of longVenueAuditProfiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      hasTouch: true,
      isMobile: true,
      locale: "ko-KR",
      reducedMotion: "reduce",
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
        version: 1,
        nickname: "장소문구감사",
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
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-menu-button").click();
      await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "오시는 길", exact: true }).click();
      await page.locator(".directions-sheet").waitFor({ state: "visible" });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(({ width, height }) => {
        const sheet = document.querySelector(".bottom-sheet");
        const content = document.querySelector(".directions-sheet");
        const venue = document.querySelector(".directions-sheet__venue strong");
        const address = document.querySelector(".directions-sheet__venue span");
        const copy = document.querySelector(".directions-sheet__venue > button");
        if (![sheet, content, venue, address, copy].every((element) => element instanceof HTMLElement)) return null;
        const sheetRect = sheet.getBoundingClientRect();
        const lineCount = (element) => {
          const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
          return lineHeight > 0 ? Math.max(1, Math.round(element.getBoundingClientRect().height / lineHeight)) : 1;
        };
        const venueLines = lineCount(venue);
        const addressLines = lineCount(address);
        return {
          venueText: venue.textContent?.trim() ?? "",
          addressText: address.textContent?.trim() ?? "",
          venueLines,
          addressLines,
          sheetContained: sheetRect.x >= -1 && sheetRect.y >= -1 && sheetRect.right <= width + 1 && sheetRect.bottom <= height + 1,
          contentContained: content.scrollWidth <= content.clientWidth + 1 && sheet.scrollWidth <= sheet.clientWidth + 1,
          venueTextComplete: venue.textContent?.includes("MJ컨벤션 5층 파티오볼룸") ?? false,
          venueLinesReady: venueLines <= 3,
          addressLinesReady: addressLines <= 3,
          copyTargetReady: copy.getBoundingClientRect().height >= 43
        };
      }, profile);
      reports.push({ ...profile, metrics, issues: auditLongVenueLayout(metrics) });
    } finally {
      await context.close();
    }
  }
  return {
    profiles: longVenueAuditProfiles,
    reports,
    issues: reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`))
  };
}

async function runLargeTextAccessibilityAudit({ browser, url, outputDir }) {
  const reports = [];
  for (const profile of largeTextAccessibilityProfiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      hasTouch: true,
      isMobile: true,
      locale: "ko-KR",
      reducedMotion: "reduce",
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
        version: 1,
        nickname: "접근성감사",
        appearance: { presetId: "feminine-long-wave-dress" },
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({ version: 1, completed: true }));
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) await resumeGarden.click();
      await page.locator(".game-world").waitFor({ state: "visible" });
      await setAuditTextScale(page, profile.textScale);
      await page.locator(".world-menu-button").click();
      const menu = page.locator(".world-menu-sheet");
      await menu.waitFor({ state: "visible" });
      const directionsTrigger = menu.getByRole("button", { name: "오시는 길", exact: true });
      await directionsTrigger.focus();
      await directionsTrigger.click();
      const dialog = page.getByRole("dialog", { name: "오시는 길" });
      await dialog.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "오시는 길");
      const metrics = await page.evaluate(({ width, height }) => {
        const sheet = document.querySelector(".bottom-sheet");
        const body = sheet?.querySelector(".bottom-sheet__body");
        const root = document.querySelector("#root");
        if (!(sheet instanceof HTMLElement) || !(body instanceof HTMLElement)) return null;
        const rect = sheet.getBoundingClientRect();
        const focusable = [...sheet.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
          .filter((element) => element instanceof HTMLElement && getComputedStyle(element).visibility !== "hidden");
        const nameOf = (element) => element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ") || "";
        return {
          dialogNamed: sheet.getAttribute("aria-labelledby") !== null,
          modal: sheet.getAttribute("aria-modal") === "true",
          underlyingContentInert: root?.hasAttribute("inert") === true,
          initialFocusOnHeading: document.activeElement === sheet.querySelector("h2"),
          sheetContained: rect.x >= -1 && rect.y >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1,
          contentContained: sheet.scrollWidth <= sheet.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1,
          touchTargetsReady: focusable.every((element) => element.getBoundingClientRect().height >= 43),
          focusOrder: focusable.map(nameOf)
        };
      }, profile);
      const focusable = dialog.locator("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
      await focusable.last().focus();
      await page.keyboard.press("Tab");
      const focusTrapWrapped = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "닫기");
      const screenshotPath = path.join(outputDir, `large-text-accessibility-${profile.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
      await dialog.getByRole("button", { name: "닫기" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim().replace(/\s+/g, " ") === "오시는 길");
      const finalState = await page.evaluate(() => ({
        focusRestored: document.activeElement?.textContent?.trim().replace(/\s+/g, " ") === "오시는 길",
        menuRemainedOpen: document.querySelector(".world-menu-sheet") !== null
      }));
      const report = { ...profile, ...metrics, ...finalState, focusTrapWrapped, screenshotPath };
      reports.push({ ...report, issues: auditLargeTextAccessibilityFlow(report) });
    } finally {
      await context.close();
    }
  }
  return {
    profiles: largeTextAccessibilityProfiles,
    reports,
    issues: reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`))
  };
}

export async function runMobileHudBrowserAudit({ rootDir, outputDir, port = 4178, deviceBaselineMode = "compare" }) {
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: rootDir,
      env: { ...process.env, BROWSER: "none", VITE_WORKER_URL: "https://realtime-audit.invalid" },
      stdio: "pipe"
    }
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
    let collisionMatrix = { reports: [], issues: [], profiles: [] };
    let longVenueAudit = { reports: [], issues: [], profiles: [] };
    let largeTextAccessibilityAudit = { reports: [], issues: [], profiles: [] };
    let remoteNameplateCrowd = { reports: [], issues: [], scenarios: [] };
    let realtimeResilience = { issues: [] };
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
        const playerNameplate = await measurePlayerNameplate(page);
        auditPlayerNameplate(playerNameplate).forEach((issue) => issues.push(issue));
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
        const toolsRectangles = await visibleRectangles(page);
        auditMobileHudRectangles(toolsRectangles, viewport).forEach((issue) => issues.push(`expanded-tools ${issue}`));
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
        reports.push({ ...viewport, engine, rectangles, worldLabels, playerNameplate, movementLayout, dynamicViewport, toolsRect, toolsRectangles, touchResponse, invitationQuality, deviceVisualBaselines, issues, screenshotPath, toolsScreenshotPath });
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
      collisionMatrix = await runMobileHudCollisionMatrix({
        browser: await browserFor("chromium"),
        url,
        outputDir
      });
      longVenueAudit = await runLongVenueAudit({
        browser: await browserFor("chromium"),
        url
      });
      largeTextAccessibilityAudit = await runLargeTextAccessibilityAudit({
        browser: await browserFor("chromium"),
        url,
        outputDir
      });
      remoteNameplateCrowd = await runRemoteNameplateCrowdAudit({
        browser: await browserFor("chromium"),
        url,
        outputDir
      });
      realtimeResilience = await runRealtimeResilienceAudit({
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
      typographyScaleAudit,
      collisionMatrix,
      longVenueAudit,
      largeTextAccessibilityAudit,
      remoteNameplateCrowd,
      realtimeResilience
    }, null, 2)}\n`);
    const issues = [
      ...reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`)),
      ...zoneLabelSweep.issues,
      ...typographyScaleAudit.issues,
      ...collisionMatrix.issues,
      ...longVenueAudit.issues,
      ...largeTextAccessibilityAudit.issues,
      ...remoteNameplateCrowd.issues,
      ...realtimeResilience.issues
    ];
    if (issues.length > 0) throw new Error(`Mobile HUD browser audit failed:\n${issues.join("\n")}`);
    return { reports, zoneLabelSweep, typographyScaleAudit, collisionMatrix, longVenueAudit, largeTextAccessibilityAudit, remoteNameplateCrowd, realtimeResilience, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}
