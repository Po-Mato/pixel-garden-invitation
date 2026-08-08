import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { assessFrameTimingHeadroom, summarizeFrameTimings } from "./frameTimingMetrics.mjs";

export const mobileSoakProfiles = Object.freeze([
  { id: "android-chromium", engine: "chromium", device: "Pixel 7" },
  { id: "ios-webkit", engine: "webkit", device: "iPhone 13" },
  {
    id: "android-chromium-low-power-cold-thermal",
    engine: "chromium",
    device: "Pixel 7",
    powerMode: "battery",
    cacheMode: "cold",
    cpuThrottlingRate: 4,
    trace: true
  }
]);

export const mobileSoakZoneTransitionSequence = Object.freeze([
  { id: "neighborhood", label: "동네 거리" },
  { id: "lobby", label: "예식장 로비" },
  { id: "ceremony-hall", label: "예식홀" },
  { id: "banquet", label: "연회장" },
  { id: "bridal-room", label: "신부 대기실" },
  { id: "home", label: "우리 집" },
  { id: "neighborhood", label: "동네 거리" },
  { id: "lobby", label: "예식장 로비" },
  { id: "ceremony-hall", label: "예식홀" },
  { id: "banquet", label: "연회장" },
  { id: "bridal-room", label: "신부 대기실" },
  { id: "home", label: "우리 집" }
]);

export function summarizeFrameSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("Frame samples must contain at least one value");
  }
  const sorted = samples.map(Number).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianFps = sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
  return { samples: [...samples], medianFps, minimumFps: sorted[0], maximumFps: sorted.at(-1) };
}

export function summarizeMovementSamples(samples, settledSamples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new TypeError("Movement samples must contain at least two values");
  }
  const first = samples[0];
  const distanceFrom = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  const movementDistance = Math.max(...samples.map(({ position }) => distanceFrom(position, first.position)));
  const cameraDistance = Math.max(...samples.map(({ camera }) => distanceFrom(camera, first.camera)));
  const centeredSamples = [first, ...settledSamples];
  const maxCenterErrorPx = Math.max(...centeredSamples.map(({ centerError }) => Math.hypot(centerError.x, centerError.y)));
  const settledOrigin = settledSamples[0]?.visualCenter ?? samples.at(-1).visualCenter;
  const settledJitterPx = Math.max(0, ...settledSamples.map(({ visualCenter }) => (
    distanceFrom(visualCenter, settledOrigin)
  )));
  return {
    movementResponded: movementDistance >= 8,
    cameraFollowed: cameraDistance >= 4,
    movementDistance: Math.round(movementDistance * 10) / 10,
    cameraDistance: Math.round(cameraDistance * 10) / 10,
    maxCenterErrorPx: Math.round(maxCenterErrorPx * 100) / 100,
    settledJitterPx: Math.round(settledJitterPx * 100) / 100,
    samples,
    settledSamples
  };
}

export function assessMotionResponsiveness(metrics) {
  const issues = [];
  const frameBudgetMs = Number.isFinite(metrics.frameBudgetMs) ? metrics.frameBudgetMs : 1000 / 60;
  const inputLimitMs = Number.isFinite(metrics.inputLatencyLimitMs)
    ? metrics.inputLatencyLimitMs
    : Math.max(50, frameBudgetMs * 3);
  const settleLimitMs = Number.isFinite(metrics.settleLatencyLimitMs) ? metrics.settleLatencyLimitMs : 320;
  if (!Number.isFinite(metrics.inputLatencyMs)) issues.push("이동 입력 지연 측정 누락");
  else if (metrics.inputLatencyMs > inputLimitMs) issues.push(`이동 입력 지연 ${metrics.inputLatencyMs}ms`);
  if (!Number.isFinite(metrics.settleLatencyMs)) issues.push("카메라 안정화 시간 측정 누락");
  else if (metrics.settleLatencyMs > settleLimitMs) issues.push(`카메라 안정화 지연 ${metrics.settleLatencyMs}ms`);
  return issues;
}

export function summarizeZoneTransitionSamples(transitions, baselineLayout) {
  if (!Array.isArray(transitions) || transitions.length === 0) {
    throw new TypeError("Zone transition samples must contain at least one transition");
  }
  const layoutDelta = (layout) => Math.max(...["hud", "map"].flatMap((name) => (
    ["x", "y", "width", "height"].map((key) => Math.abs(layout[name][key] - baselineLayout[name][key]))
  )));
  const centerError = (sample) => Math.hypot(sample.centerError.x, sample.centerError.y);
  const cameraDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  const transitionDurations = transitions.map(({ durationMs }) => Number(durationMs)).filter(Number.isFinite);
  return {
    transitionCount: transitions.length,
    uniqueZoneIds: [...new Set(transitions.map(({ zoneId }) => zoneId))],
    maxTransitionDurationMs: transitionDurations.length > 0
      ? Math.round(Math.max(...transitionDurations) * 100) / 100
      : null,
    maxLayoutDeltaPx: Math.round(Math.max(...transitions.map(({ samples }) => (
      Math.max(...samples.map(({ layout }) => layoutDelta(layout)))
    ))) * 100) / 100,
    maxCenterErrorPx: Math.round(Math.max(...transitions.flatMap(({ samples }) => samples.map(centerError))) * 100) / 100,
    maxSettledCameraJitterPx: Math.round(Math.max(...transitions.map(({ samples }) => {
      const origin = samples[0].camera;
      return Math.max(...samples.map(({ camera }) => cameraDistance(camera, origin)));
    })) * 100) / 100,
    cameraBoundsValid: transitions.every(({ samples }) => samples.every(({ cameraBoundsValid }) => cameraBoundsValid)),
    layoutStable: transitions.every(({ samples }) => samples.every(({ horizontalOverflow }) => !horizontalOverflow)),
    lowPerformanceModeStable: transitions.every(({ samples }) => samples.every(({ quality }) => (
      (quality.mode === "lite" && quality.effects === "minimal")
      || (quality.reason === "battery" && quality.effects === "minimal")
    ))),
    transitions
  };
}

export function summarizeZoneBottlenecks(transitions) {
  if (!Array.isArray(transitions) || transitions.length === 0) {
    throw new TypeError("Zone bottleneck samples must contain at least one transition");
  }
  const grouped = new Map();
  for (const transition of transitions) {
    const current = grouped.get(transition.zoneId) ?? {
      durations: [],
      frameDeltas: [],
      imageDecodeReady: [],
      imageResourceLoad: [],
      decodedBodySizes: []
    };
    current.durations.push(Number(transition.durationMs));
    current.frameDeltas.push(...(transition.frameDeltas ?? []));
    if (Number.isFinite(transition.imageDecode?.readyMs)) current.imageDecodeReady.push(transition.imageDecode.readyMs);
    if (Number.isFinite(transition.imageDecode?.resourceLoadMs)) current.imageResourceLoad.push(transition.imageDecode.resourceLoadMs);
    if (Number.isFinite(transition.imageDecode?.decodedBodySize)) current.decodedBodySizes.push(transition.imageDecode.decodedBodySize);
    grouped.set(transition.zoneId, current);
  }
  const zones = [...grouped.entries()].map(([zoneId, samples]) => {
    const timings = summarizeFrameTimings(samples.frameDeltas);
    return {
      zoneId,
      transitionCount: samples.durations.length,
      averageTransitionDurationMs: Math.round(samples.durations.reduce((sum, value) => sum + value, 0) / samples.durations.length * 100) / 100,
      maximumTransitionDurationMs: Math.round(Math.max(...samples.durations) * 100) / 100,
      imageDecodeSampleCount: samples.imageDecodeReady.length,
      maximumImageDecodeReadyMs: samples.imageDecodeReady.length > 0
        ? Math.round(Math.max(...samples.imageDecodeReady) * 100) / 100
        : null,
      maximumImageResourceLoadMs: samples.imageResourceLoad.length > 0
        ? Math.round(Math.max(...samples.imageResourceLoad) * 100) / 100
        : null,
      maximumDecodedBodySize: samples.decodedBodySizes.length > 0
        ? Math.max(...samples.decodedBodySizes)
        : null,
      ...timings
    };
  }).sort((left, right) => right.p99FrameMs - left.p99FrameMs
    || right.maximumTransitionDurationMs - left.maximumTransitionDurationMs);
  const decodeZones = [...zones].filter(({ imageDecodeSampleCount }) => imageDecodeSampleCount > 0)
    .sort((left, right) => right.maximumImageDecodeReadyMs - left.maximumImageDecodeReadyMs);
  return {
    worstZoneId: zones[0].zoneId,
    worstDecodeZoneId: decodeZones[0]?.zoneId ?? null,
    maximumImageDecodeReadyMs: decodeZones[0]?.maximumImageDecodeReadyMs ?? null,
    zones
  };
}

export function assessMobileSoakMetrics(metrics) {
  const issues = [];
  if (metrics.pageErrors.length > 0) issues.push(`페이지 오류 ${metrics.pageErrors.length}개`);
  if (metrics.failedRequests.length > 0) issues.push(`요청 실패 ${metrics.failedRequests.length}개`);
  if (!metrics.touchResponded) issues.push("반복 터치 무응답");
  if (!metrics.layoutStable) issues.push("반복 조작 후 HUD 또는 맵 화면 틀어짐");
  if (!metrics.typographyFallbackReady) issues.push("안드로이드 한글 폰트 대체 누락");
  if (!metrics.sheetContained) issues.push("큰 글자 바텀시트 화면 이탈");
  if (metrics.movementResponded === false) issues.push("실제 캐릭터 이동 무응답");
  if (metrics.cameraFollowed === false) issues.push("실제 이동 중 카메라 추적 없음");
  if (Number.isFinite(metrics.maxCenterErrorPx) && metrics.maxCenterErrorPx > 1.25) {
    issues.push(`이동 후 캐릭터 중심 오차 ${metrics.maxCenterErrorPx}px`);
  }
  if (Number.isFinite(metrics.settledJitterPx) && metrics.settledJitterPx > 0.75) {
    issues.push(`이동 정지 후 카메라 미세 흔들림 ${metrics.settledJitterPx}px`);
  }
  if (metrics.motionResponse && metrics.motionResponseTimingPolicy !== "availability-only") {
    assessMotionResponsiveness(metrics.motionResponse).forEach((issue) => issues.push(issue));
  }
  if (metrics.zoneTransitions) {
    if (metrics.zoneTransitions.transitionCount < 12) issues.push(`구역 전환 표본 부족 ${metrics.zoneTransitions.transitionCount}/12`);
    if (metrics.zoneTransitions.uniqueZoneIds.length < 6) issues.push(`구역 전환 범위 부족 ${metrics.zoneTransitions.uniqueZoneIds.length}/6`);
    if (metrics.zoneTransitions.maxLayoutDeltaPx > 1) issues.push(`구역 전환 HUD/맵 틀어짐 ${metrics.zoneTransitions.maxLayoutDeltaPx}px`);
    if (metrics.zoneTransitions.maxCenterErrorPx > 1.25) issues.push(`구역 전환 캐릭터 중심 오차 ${metrics.zoneTransitions.maxCenterErrorPx}px`);
    if (metrics.zoneTransitions.maxSettledCameraJitterPx > 0.75) issues.push(`구역 전환 후 카메라 흔들림 ${metrics.zoneTransitions.maxSettledCameraJitterPx}px`);
    if (!metrics.zoneTransitions.cameraBoundsValid) issues.push("구역 전환 카메라 맵 경계 이탈");
    if (!metrics.zoneTransitions.layoutStable) issues.push("구역 전환 중 가로 화면 넘침");
    if (!metrics.zoneTransitions.lowPerformanceModeStable) issues.push("구역 전환 중 저사양 렌더링 모드 이탈");
    if (metrics.zoneTransitions.maxTransitionDurationMs > 2_000) {
      issues.push(`구역 전환 완료 지연 ${metrics.zoneTransitions.maxTransitionDurationMs}ms`);
    }
    if (metrics.zoneTransitionFrameTimings && metrics.zoneTransitionTimingPolicy !== "completion-latency") {
      assessFrameTimingHeadroom(metrics.zoneTransitionFrameTimings, metrics.baselineFrameTimings)
        .forEach((issue) => issues.push(`구역 전환 ${issue}`));
    }
  }
  if (metrics.expectedPowerMode === "battery") {
    if (metrics.automaticQuality?.reason !== "battery") issues.push("저전력 배터리 모드 자동 감지 실패");
    if (metrics.automaticQuality?.effects !== "minimal") issues.push("저전력 효과 최소화 실패");
    if (!metrics.zoneBottlenecks?.worstZoneId) issues.push("저전력 최악 구역 프레임 추적 누락");
  }
  if (metrics.expectedCacheMode === "cold") {
    if (!metrics.environmentEmulation?.cacheDisabled) issues.push("저전력 cold cache 적용 실패");
    if (metrics.environmentEmulation?.cpuThrottlingRate !== metrics.expectedCpuThrottlingRate) {
      issues.push("저전력 thermal CPU 제한 적용 실패");
    }
    const decodeSamples = metrics.zoneBottlenecks?.zones.reduce((sum, zone) => sum + zone.imageDecodeSampleCount, 0) ?? 0;
    if (decodeSamples < 12) issues.push(`cold cache 최초 이미지 decode 표본 부족 ${decodeSamples}/12`);
    if (!metrics.zoneBottlenecks?.worstDecodeZoneId) issues.push("최초 이미지 decode 최악 구역 추적 누락");
    if (Number.isFinite(metrics.zoneBottlenecks?.maximumImageDecodeReadyMs)
      && metrics.zoneBottlenecks.maximumImageDecodeReadyMs > 2_000) {
      issues.push(`최초 이미지 decode 준비 지연 ${metrics.zoneBottlenecks.maximumImageDecodeReadyMs}ms`);
    }
    if (!metrics.traceConfigured) issues.push("cold cache thermal trace 누락");
  }
  const baselineFps = Number.isFinite(metrics.baselineFps) ? metrics.baselineFps : 60;
  const relativeFps = baselineFps > 0 ? metrics.averageFps / baselineFps : 0;
  if ((baselineFps >= 45 && metrics.averageFps < 45) || (baselineFps < 45 && relativeFps < 0.75)) {
    issues.push(`낮은 프레임 ${metrics.averageFps} FPS (러너 기준 ${baselineFps} FPS)`);
  }
  if (metrics.frameTimings) {
    assessFrameTimingHeadroom(metrics.frameTimings, metrics.baselineFrameTimings)
      .forEach((issue) => issues.push(issue));
  }
  if (metrics.heapGrowthRatio !== null && metrics.heapGrowthRatio > 0.35) issues.push(`메모리 증가 ${Math.round(metrics.heapGrowthRatio * 100)}%`);
  return issues;
}

async function waitForServer(url, process, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) throw new Error(`Vite exited before soak audit: ${process.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the mobile soak audit server");
}

async function sampleFrames(page, durationMs) {
  return page.evaluate((duration) => new Promise((resolve) => {
    let frames = 0;
    const frameDeltas = [];
    const startedAt = performance.now();
    let previousFrameAt = startedAt;
    const tick = (now) => {
      frames += 1;
      frameDeltas.push(now - previousFrameAt);
      previousFrameAt = now;
      if (now - startedAt >= duration) {
        resolve({
          fps: Math.round(frames / Math.max(1, now - startedAt) * 1000),
          frameDeltas
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), durationMs);
}

async function sampleFrameSeries(page, durationMs, sampleCount = 3) {
  const sampleDurationMs = Math.max(750, Math.floor(durationMs / sampleCount));
  await page.waitForTimeout(250);
  const samples = [];
  const frameDeltas = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = await sampleFrames(page, sampleDurationMs);
    samples.push(sample.fps);
    frameDeltas.push(...sample.frameDeltas);
  }
  return {
    ...summarizeFrameSamples(samples),
    timings: summarizeFrameTimings(frameDeltas)
  };
}

async function heapUsed(page) {
  return page.evaluate(() => {
    const memory = performance.memory;
    return typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null;
  });
}

async function sampleMovingFrameSeries(page, durationMs, sampleCount = 3) {
  const result = await page.evaluate(async ({ duration, count }) => {
    const player = document.querySelector(".world-player:not(.player--remote)");
    const sprite = player?.querySelector(".character-sprite--world");
    const map = document.querySelector(".world-map");
    const stage = document.querySelector(".world-map__stage");
    const joystick = document.querySelector(".virtual-joystick");
    if (
      !(player instanceof HTMLElement)
      || !(sprite instanceof HTMLElement)
      || !(map instanceof HTMLElement)
      || !(stage instanceof HTMLElement)
      || !(joystick instanceof HTMLElement)
    ) throw new Error("Movement sample elements are unavailable");
    const read = (phase) => {
      const playerStyle = getComputedStyle(player);
      const spriteRect = sprite.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();
      const stageTransform = getComputedStyle(stage).transform;
      const matrix = stageTransform === "none"
        ? { m41: 0, m42: 0 }
        : new DOMMatrixReadOnly(stageTransform);
      const centerOffsetX = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-offset-x")) || 0;
      const centerY = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-y")) || spriteRect.height / 2;
      const visualCenter = {
        x: spriteRect.x + spriteRect.width / 2 + centerOffsetX,
        y: spriteRect.y + centerY
      };
      const viewportCenter = {
        x: mapRect.x + mapRect.width / 2,
        y: mapRect.y + mapRect.height / 2
      };
      const rawCenterError = {
        x: visualCenter.x - viewportCenter.x,
        y: visualCenter.y - viewportCenter.y
      };
      const logicalWidth = Number(stage.dataset.logicalWidth) || stage.offsetWidth;
      const logicalHeight = Number(stage.dataset.logicalHeight) || stage.offsetHeight;
      const centerable = {
        x: logicalWidth > mapRect.width + 1
          && matrix.m41 < -0.5
          && matrix.m41 > mapRect.width - logicalWidth + 0.5,
        y: logicalHeight > mapRect.height + 1
          && matrix.m42 < -0.5
          && matrix.m42 > mapRect.height - logicalHeight + 0.5
      };
      return {
        phase,
        position: {
          x: Number.parseFloat(player.style.left),
          y: Number.parseFloat(player.style.top)
        },
        camera: { x: matrix.m41, y: matrix.m42 },
        visualCenter,
        viewportCenter,
        centerable,
        rawCenterError,
        centerError: {
          x: centerable.x ? rawCenterError.x : 0,
          y: centerable.y ? rawCenterError.y : 0
        }
      };
    };

    const dispatchKey = (type, key) => joystick.dispatchEvent(new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true
    }));
    const samples = [read("before")];
    joystick.focus();
    const inputStartedAt = performance.now();
    dispatchKey("keydown", "ArrowRight");
    let inputLatencyMs = null;
    while (performance.now() - inputStartedAt <= 300) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const current = read("input-latency");
      if (Math.hypot(
        current.position.x - samples[0].position.x,
        current.position.y - samples[0].position.y
      ) >= 0.5) {
        inputLatencyMs = performance.now() - inputStartedAt;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(720, Math.max(360, duration / 7))));
    dispatchKey("keyup", "ArrowRight");
    await new Promise((resolve) => setTimeout(resolve, 96));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    samples.push(read("movement-proof"));

    const frameCounts = Array.from({ length: count }, () => 0);
    const frameDeltas = [];
    const sampleDuration = duration / count;
    const segmentDuration = Math.max(240, Math.min(500, Math.floor(duration / 10)));
    let currentKey = "ArrowRight";
    let currentSegment = 0;
    let previousFrameAt = null;
    dispatchKey("keydown", currentKey);
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        if (previousFrameAt !== null) frameDeltas.push(now - previousFrameAt);
        previousFrameAt = now;
        const elapsed = now - startedAt;
        const bucket = Math.min(count - 1, Math.floor(elapsed / sampleDuration));
        frameCounts[bucket] += 1;
        const nextSegment = Math.floor(elapsed / segmentDuration);
        if (nextSegment !== currentSegment) {
          dispatchKey("keyup", currentKey);
          currentSegment = nextSegment;
          currentKey = currentSegment % 2 === 0 ? "ArrowRight" : "ArrowLeft";
          dispatchKey("keydown", currentKey);
        }
        if (elapsed >= duration) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.push(read("before-release"));
    const releaseStartedAt = performance.now();
    dispatchKey("keyup", currentKey);
    let previousCamera = read("release").camera;
    let stableFrameCount = 0;
    let settleLatencyMs = null;
    while (performance.now() - releaseStartedAt <= 600) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const current = read("settle-probe");
      const cameraDelta = Math.hypot(current.camera.x - previousCamera.x, current.camera.y - previousCamera.y);
      previousCamera = current.camera;
      stableFrameCount = cameraDelta <= 0.1 ? stableFrameCount + 1 : 0;
      if (stableFrameCount >= 3) {
        settleLatencyMs = performance.now() - releaseStartedAt;
        break;
      }
    }
    const settledSamples = [];
    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      settledSamples.push(read(`settled-${index + 1}`));
    }
    return {
      frameSamples: frameCounts.map((frames) => Math.round(frames / sampleDuration * 1000)),
      frameDeltas,
      samples,
      settledSamples,
      inputLatencyMs: inputLatencyMs === null ? null : Math.round(inputLatencyMs * 100) / 100,
      settleLatencyMs: settleLatencyMs === null ? null : Math.round(settleLatencyMs * 100) / 100
    };
  }, { duration: durationMs, count: sampleCount });
  const timings = summarizeFrameTimings(result.frameDeltas);
  return {
    frames: {
      ...summarizeFrameSamples(result.frameSamples),
      timings,
      detectedRefreshHz: Math.round(1000 / timings.p50FrameMs)
    },
    movement: {
      ...summarizeMovementSamples(result.samples, result.settledSamples),
      inputLatencyMs: result.inputLatencyMs,
      settleLatencyMs: result.settleLatencyMs
    }
  };
}

async function captureZoneTransitionInPage(page, target, { auditImageDecode = false } = {}) {
  return page.evaluate(async ({ target: { id: targetId, label: targetLabel }, auditImageDecode: shouldAuditImageDecode }) => {
    const transitionStartedAt = performance.now();
    const resourceStartIndex = performance.getEntriesByType("resource").length;
    let traceActive = true;
    let previousFrameAt = performance.now();
    const frameDeltas = [];
    const tick = (now) => {
      if (!traceActive) return;
      frameDeltas.push(now - previousFrameAt);
      previousFrameAt = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const waitFor = async (predicate, message) => {
      const startedAt = performance.now();
      while (!predicate()) {
        if (performance.now() - startedAt > 15_000) throw new Error(message);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };
    const button = [...document.querySelectorAll("button")].find((candidate) => (
      candidate.getAttribute("aria-label") === `${targetLabel} 바로 이동`
    ));
    if (!(button instanceof HTMLButtonElement)) throw new Error(`${targetLabel} 이동 버튼을 찾을 수 없어요`);
    button.click();
    await waitFor(
      () => document.querySelector(".world-map__stage")?.getAttribute("data-zone") === targetId,
      `${targetLabel} 구역 전환 시간 초과`
    );
    const backgroundImage = document.querySelector('.world-map__stage[data-zone="' + targetId + '"] .world-map-artwork__background');
    const decodeStartedAt = performance.now();
    const decodePromise = shouldAuditImageDecode && backgroundImage instanceof HTMLImageElement
      ? backgroundImage.decode().then(() => ({ succeeded: true, readyMs: performance.now() - decodeStartedAt }))
        .catch(() => ({ succeeded: false, readyMs: performance.now() - decodeStartedAt }))
      : Promise.resolve(null);
    await waitFor(
      () => document.querySelector(".world-map__stage")?.classList.contains("world-map__stage--background-loaded") === true,
      `${targetLabel} 배경 로드 시간 초과`
    );
    const toolsToggle = document.querySelector(".world-hud__tools-toggle");
    if (toolsToggle instanceof HTMLButtonElement && toolsToggle.getAttribute("aria-expanded") === "true") {
      toolsToggle.click();
    }
    await new Promise((resolve) => setTimeout(resolve, 90));

    const read = (samplePhase) => {
    const player = document.querySelector(".world-player:not(.player--remote)");
    const sprite = player?.querySelector(".character-sprite--world");
    const map = document.querySelector(".world-map");
    const stage = document.querySelector(".world-map__stage");
    const hud = document.querySelector(".world-hud");
    if (!(player instanceof HTMLElement) || !(sprite instanceof HTMLElement) || !(map instanceof HTMLElement)
      || !(stage instanceof HTMLElement) || !(hud instanceof HTMLElement)) {
      throw new Error("Zone transition sample elements are unavailable");
    }
    const toRect = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const mapRect = map.getBoundingClientRect();
    const spriteRect = sprite.getBoundingClientRect();
    const playerStyle = getComputedStyle(player);
    const transform = getComputedStyle(stage).transform;
    const matrix = transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
    const zoom = matrix.a || 1;
    const logicalWidth = Number(stage.dataset.logicalWidth) || stage.offsetWidth;
    const logicalHeight = Number(stage.dataset.logicalHeight) || stage.offsetHeight;
    const scaledWidth = logicalWidth * zoom;
    const scaledHeight = logicalHeight * zoom;
    const xBounds = { min: Math.min(0, mapRect.width - scaledWidth), max: Math.max(0, mapRect.width - scaledWidth) };
    const yBounds = { min: Math.min(0, mapRect.height - scaledHeight), max: Math.max(0, mapRect.height - scaledHeight) };
    const centerOffsetX = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-offset-x")) || 0;
    const centerY = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-y")) || spriteRect.height / 2;
    const visualCenter = {
      x: spriteRect.x + spriteRect.width / 2 + centerOffsetX * zoom,
      y: spriteRect.y + centerY * zoom
    };
    const viewportCenter = { x: mapRect.x + mapRect.width / 2, y: mapRect.y + mapRect.height / 2 };
    const centerable = {
      x: scaledWidth > mapRect.width + 1 && matrix.m41 < -0.5 && matrix.m41 > mapRect.width - scaledWidth + 0.5,
      y: scaledHeight > mapRect.height + 1 && matrix.m42 < -0.5 && matrix.m42 > mapRect.height - scaledHeight + 0.5
    };
    return {
      phase: samplePhase,
      zoneId: stage.dataset.zone,
      camera: { x: matrix.m41, y: matrix.m42, zoom },
      centerError: {
        x: centerable.x ? visualCenter.x - viewportCenter.x : 0,
        y: centerable.y ? visualCenter.y - viewportCenter.y : 0
      },
      cameraBoundsValid: matrix.m41 >= xBounds.min - 1 && matrix.m41 <= xBounds.max + 1
        && matrix.m42 >= yBounds.min - 1 && matrix.m42 <= yBounds.max + 1,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      layout: { hud: toRect(hud), map: toRect(map) },
      quality: {
        mode: document.documentElement.dataset.performanceMode ?? null,
        reason: document.documentElement.dataset.performanceReason ?? null,
        effects: document.documentElement.dataset.effectsQuality ?? null
      }
    };
    };
    const samples = [];
    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(read(`settled-${index + 1}`));
    }
    traceActive = false;
    const decodeResult = await decodePromise;
    const resourceEntries = performance.getEntriesByType("resource").slice(resourceStartIndex);
    const backgroundUrl = backgroundImage instanceof HTMLImageElement ? backgroundImage.currentSrc || backgroundImage.src : "";
    const backgroundPath = backgroundUrl ? new URL(backgroundUrl).pathname : "";
    const imageResource = [...resourceEntries].reverse().find((entry) => {
      if (entry.name === backgroundUrl) return true;
      try {
        return backgroundPath !== "" && new URL(entry.name).pathname === backgroundPath;
      } catch {
        return false;
      }
    });
    return {
      durationMs: Math.round((performance.now() - transitionStartedAt) * 100) / 100,
      frameDeltas,
      samples,
      imageDecode: decodeResult ? {
        succeeded: decodeResult.succeeded,
        readyMs: Math.round(decodeResult.readyMs * 100) / 100,
        resourceLoadMs: imageResource ? Math.round(imageResource.duration * 100) / 100 : null,
        transferSize: imageResource && "transferSize" in imageResource ? imageResource.transferSize : null,
        decodedBodySize: imageResource && "decodedBodySize" in imageResource ? imageResource.decodedBodySize : null,
        url: backgroundUrl ? new URL(backgroundUrl).pathname : null
      } : null
    };
  }, { target, auditImageDecode });
}

async function sampleZoneTransitionSeries(page, baselineLayout, options = {}) {
  const transitions = [];
  const frameDeltas = [];
  for (const target of mobileSoakZoneTransitionSequence) {
    const toggle = page.locator(".world-hud__tools-toggle");
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.tap();
    const vault = page.locator(".world-game-vault");
    if (await vault.getAttribute("open") === null) await vault.locator(":scope > summary").tap();
    // WebKit pauses rendering around cross-process automation calls. Keep the click, load wait,
    // settled frames, and geometry reads inside one browser task so the audit does not create jank.
    const { durationMs, frameDeltas: transitionFrameDeltas, samples, imageDecode } = await captureZoneTransitionInPage(page, target, options);
    frameDeltas.push(...transitionFrameDeltas);
    transitions.push({
      zoneId: target.id,
      durationMs,
      samples,
      imageDecode,
      frameDeltas: transitionFrameDeltas,
      frameTimings: summarizeFrameTimings(transitionFrameDeltas)
    });
  }
  return {
    metrics: summarizeZoneTransitionSamples(transitions, baselineLayout),
    frameTimings: summarizeFrameTimings(frameDeltas)
  };
}

export async function runMobileDeviceSoakAudit({
  rootDir,
  outputDir,
  port = 4179,
  durationMs = 5_000,
  interactionCount = 18,
  profiles = mobileSoakProfiles,
  throwOnIssues = true,
  reportFileName = "mobile-device-soak-report.json"
}) {
  const server = spawn("pnpm", ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    env: { ...process.env, BROWSER: "none" },
    stdio: "pipe"
  });
  const url = `http://127.0.0.1:${port}/`;
  await mkdir(outputDir, { recursive: true });
  try {
    await waitForServer(url, server);
    const playwright = await import("playwright");
    const reports = [];
    for (const profile of profiles) {
      const browser = await playwright[profile.engine].launch({ headless: true });
      const context = await browser.newContext({ ...playwright.devices[profile.device] });
      const tracePath = profile.trace ? path.join(outputDir, `${profile.id}-trace.zip`) : null;
      if (tracePath) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      await context.route("http://127.0.0.1:8787/**", (route) => route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}"
      }));
      const page = await context.newPage();
      const environmentEmulation = {
        cacheDisabled: false,
        cpuThrottlingRate: 1,
        thermalProxy: false
      };
      if (profile.engine === "chromium" && (profile.cacheMode === "cold" || profile.cpuThrottlingRate)) {
        const session = await context.newCDPSession(page);
        if (profile.cacheMode === "cold") {
          await session.send("Network.enable");
          await session.send("Network.setCacheDisabled", { cacheDisabled: true });
          environmentEmulation.cacheDisabled = true;
        }
        if (profile.cpuThrottlingRate) {
          await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuThrottlingRate });
          environmentEmulation.cpuThrottlingRate = profile.cpuThrottlingRate;
          environmentEmulation.thermalProxy = true;
        }
      }
      const baselineFrames = await sampleFrameSeries(page, durationMs);
      const pageErrors = [];
      const failedRequests = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        const failure = request.failure()?.errorText ?? "unknown";
        if (!failure.includes("ERR_ABORTED") && !failure.includes("cancelled")) failedRequests.push(`${request.url()} ${failure}`);
      });
      await page.addInitScript(({ powerMode }) => {
        Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => powerMode === "battery" ? 8 : 4 });
        if (powerMode === "battery") {
          Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
          Object.defineProperty(navigator, "getBattery", {
            configurable: true,
            value: async () => ({ charging: false, level: 0.08, addEventListener() {}, removeEventListener() {} })
          });
        }
        localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
          version: 1,
          nickname: "장시간감사",
          appearance: { presetId: "feminine-long-wave-dress" },
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({ version: 1, completed: true }));
      }, { powerMode: profile.powerMode ?? "constrained" });
      await page.goto(url, { waitUntil: "networkidle" });
      const resumeGarden = page.locator(".entry-screen__resume-access");
      if (await resumeGarden.isVisible().catch(() => false)) {
        await resumeGarden.click();
      }
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
      if (profile.powerMode === "battery") {
        await page.waitForFunction(() => document.documentElement.dataset.performanceReason === "battery"
          && document.documentElement.dataset.effectsQuality === "minimal");
      }
      const readStableLayout = () => page.evaluate(() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) return null;
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        return { hud: read(".world-hud"), map: read(".world-map") };
      });
      const layoutBefore = await readStableLayout();
      await page.locator(".world-hud__tools-toggle").tap();
      await page.locator(".world-game-vault > summary").tap();
      await page.getByRole("button", { name: /빠른 도구 편집/ }).tap();
      await page.locator(".game-quick-dock__settings").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "게임 도구 닫기" }).tap();
      const beforeHeap = await heapUsed(page);
      let touchResponded = true;
      for (let index = 0; index < interactionCount; index += 1) {
        const toggle = page.locator(".world-hud__tools-toggle");
        await toggle.tap();
        touchResponded = touchResponded && await toggle.getAttribute("aria-expanded") === "true";
        await toggle.tap();
        touchResponded = touchResponded && await toggle.getAttribute("aria-expanded") === "false";
      }
      const layoutAfter = await readStableLayout();
      const layoutStable = ["hud", "map"].every((name) => {
        const before = layoutBefore[name];
        const after = layoutAfter[name];
        return before && after && ["x", "y", "width", "height"].every((key) => Math.abs(before[key] - after[key]) <= 1);
      });
      await page.evaluate(() => { document.documentElement.dataset.textScale = "xlarge"; });
      await page.locator(".world-menu-button").tap();
      await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "오시는 길", exact: true }).tap();
      const sheet = page.locator(".bottom-sheet");
      await sheet.waitFor({ state: "visible" });
      const invitationMetrics = await page.evaluate(() => {
        const world = document.querySelector(".game-world");
        const heading = document.querySelector(".bottom-sheet__header h2");
        const sheetElement = document.querySelector(".bottom-sheet");
        if (!(world instanceof HTMLElement) || !(heading instanceof HTMLElement) || !(sheetElement instanceof HTMLElement)) {
          return { typographyFallbackReady: false, sheetContained: false };
        }
        const uiFamily = getComputedStyle(world).fontFamily;
        const displayFamily = getComputedStyle(heading).fontFamily;
        const rect = sheetElement.getBoundingClientRect();
        return {
          typographyFallbackReady: /Noto Sans (?:CJK )?KR/.test(uiFamily) && /Noto Serif (?:CJK )?KR/.test(displayFamily),
          sheetContained: rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
            && sheetElement.scrollWidth <= sheetElement.clientWidth + 1
        };
      });
      await page.locator(".bottom-sheet__header button").tap();
      await sheet.waitFor({ state: "hidden" });
      await page.locator('.world-menu-sheet button[aria-label="초대장 메뉴 닫기"]').tap();
      await page.locator(".world-menu-sheet").waitFor({ state: "hidden" });
      await page.locator(".virtual-joystick").waitFor({ state: "visible" });
      await page.evaluate(() => { delete document.documentElement.dataset.textScale; });
      const movingFrameSeries = await sampleMovingFrameSeries(page, durationMs);
      const applicationFrames = movingFrameSeries.frames;
      const movementMetrics = movingFrameSeries.movement;
      const zoneTransitionSeries = await sampleZoneTransitionSeries(page, layoutBefore, {
        auditImageDecode: profile.cacheMode === "cold"
      });
      const zoneBottlenecks = summarizeZoneBottlenecks(zoneTransitionSeries.metrics.transitions);
      const averageFps = applicationFrames.medianFps;
      const baselineFps = baselineFrames.medianFps;
      const automaticQuality = await page.evaluate(() => ({
        mode: document.documentElement.dataset.performanceMode ?? null,
        reason: document.documentElement.dataset.performanceReason ?? null,
        effects: document.documentElement.dataset.effectsQuality ?? null
      }));
      const afterHeap = await heapUsed(page);
      const heapGrowthRatio = beforeHeap && afterHeap ? Math.max(0, (afterHeap - beforeHeap) / beforeHeap) : null;
      const metrics = {
        pageErrors,
        failedRequests,
        touchResponded,
        layoutStable,
        ...invitationMetrics,
        ...movementMetrics,
        motionResponse: {
          inputLatencyMs: movementMetrics.inputLatencyMs,
          settleLatencyMs: movementMetrics.settleLatencyMs,
          frameBudgetMs: applicationFrames.timings.frameBudgetMs,
          detectedRefreshHz: applicationFrames.detectedRefreshHz,
          inputLatencyLimitMs: profile.cpuThrottlingRate ? 80 : undefined,
          settleLatencyLimitMs: profile.cpuThrottlingRate ? 320 : undefined
        },
        // Linux Playwright WebKit can defer synthetic keyboard-driven style updates even
        // while movement and camera follow complete. Physical iOS evidence owns latency.
        motionResponseTimingPolicy: profile.engine === "webkit" ? "availability-only" : "frame-budget",
        zoneTransitions: zoneTransitionSeries.metrics,
        zoneBottlenecks,
        zoneTransitionFrameTimings: zoneTransitionSeries.frameTimings,
        // Linux Playwright WebKit uses software rasterization and collapses a full map swap into
        // a handful of non-device-representative frames. Enforce completion latency here; the
        // separate Appium iOS Safari workflow owns real Safari frame-tail enforcement.
        // CPU throttling is a deterministic thermal stress proxy, not a hardware compositor.
        // Keep frame tails in the trace/report and gate the user-visible transition completion.
        zoneTransitionTimingPolicy: profile.engine === "webkit" || profile.cpuThrottlingRate
          ? "completion-latency"
          : "frame-headroom",
        averageFps,
        baselineFps,
        frameRatio: baselineFps > 0 ? averageFps / baselineFps : null,
        frameSamples: applicationFrames.samples,
        baselineFrameSamples: baselineFrames.samples,
        frameTimings: applicationFrames.timings,
        baselineFrameTimings: baselineFrames.timings,
        automaticQuality,
        expectedPowerMode: profile.powerMode ?? null,
        expectedCacheMode: profile.cacheMode ?? null,
        expectedCpuThrottlingRate: profile.cpuThrottlingRate ?? 1,
        environmentEmulation,
        traceConfigured: Boolean(tracePath),
        beforeHeap,
        afterHeap,
        heapGrowthRatio
      };
      const issues = assessMobileSoakMetrics(metrics);
      const screenshotPath = path.join(outputDir, `${profile.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      if (tracePath) await context.tracing.stop({ path: tracePath });
      reports.push({ ...profile, durationMs, interactionCount, metrics, issues, screenshotPath, tracePath });
      await context.close();
      await browser.close();
    }
    const reportPath = path.join(outputDir, reportFileName);
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
    const issues = reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`));
    if (throwOnIssues && issues.length) throw new Error(`Mobile device soak audit failed:\n${issues.join("\n")}`);
    return { reports, reportPath, issues };
  } finally {
    server.kill("SIGTERM");
  }
}
