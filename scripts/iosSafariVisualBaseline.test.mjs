import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  iosSafariBaselinePath,
  iosSafariSentinelPixelRatio,
  iosSafariVisualProfile,
  iosSafariVisualStates
} from "./lib/iosSafariVisualBaseline.mjs";

test("real iOS Safari baseline contract covers game and 200% directions scroll", () => {
  assert.deepEqual(iosSafariVisualProfile, {
    id: "iphone-16-pro-ios-18-5-safari",
    deviceName: "iPhone 16 Pro",
    runtime: "iOS 18.5",
    requiredDirectionsScroll: 160,
    maxLandscapePlayerCenterErrorPx: 2
  });
  assert.deepEqual(iosSafariVisualStates, [
    "game",
    "directions-text-200",
    "directions-text-200-middle",
    "directions-text-200-bottom",
    "game-landscape-chrome-expanded",
    "game-landscape-chrome-collapsed"
  ]);
  assert.match(
    iosSafariBaselinePath("/repo", "game"),
    /ios-safari-iphone-16-pro-ios-18-5-safari-game\.webp$/
  );
});

test("landscape capture closes stacked invitation dialogs before rotating", async () => {
  const source = await readFile(new URL("./check-ios-safari-visual-baselines.mjs", import.meta.url), "utf8");
  assert.match(source, /world-menu-sheet button\[aria-label="초대장 메뉴 닫기"\]/);
  assert.match(source, /맵 대화상자 정리/);
  assert.match(source, /실제 Safari 맵 위 대화상자 잔존/);
});

test("portrait game capture discards a stale lazy-loading framebuffer", async () => {
  const source = await readFile(new URL("./check-ios-safari-visual-baselines.mjs", import.meta.url), "utf8");
  assert.match(source, /!document\.querySelector\("\.screen-loading"\)/);
  assert.match(source, /async function stabilizeGameFrameCapture\(\)/);
  assert.match(source, /ios-safari-native-compositor-sentinel/);
  assert.match(source, /visibleRatio >= 0\.2/);
  assert.match(source, /settledRatio <= 0\.02/);
  assert.match(source, /await screenshot\("game", stabilizedGameFrame\.frame\)/);
  assert.match(source, /compositorFaultInjection/);
  assert.match(source, /scheduled-background-fault-injection/);
  assert.match(source, /mobile: backgroundApp/);
  assert.match(source, /recoveryDurationMs/);
  assert.match(source, /appium\/device\/activate_app/);
  assert.match(source, /await sessionCommand\("POST", "\/refresh"\)/);
  assert.match(source, /await createSafariSession\(\)/);
  assert.match(source, /네이티브 캡처 자동 복구 실패/);
});

test("native compositor sentinel ratio tolerates screenshot color conversion", () => {
  const pixels = Uint8Array.from([
    255, 0, 255, 255,
    214, 72, 232, 255,
    199, 0, 255, 255,
    255, 81, 255, 255
  ]);
  assert.equal(iosSafariSentinelPixelRatio(pixels, 4), 0.5);
  assert.equal(iosSafariSentinelPixelRatio(new Uint8Array(), 4), 0);
  assert.throws(() => iosSafariSentinelPixelRatio(pixels, 2), /at least three channels/);
});

test("collapsed Safari chrome audit keeps the playing shell pinned and saves evidence before validation", async () => {
  const source = await readFile(new URL("./check-ios-safari-visual-baselines.mjs", import.meta.url), "utf8");
  assert.match(source, /playingShell\.style\.position = "fixed"/);
  assert.match(source, /captureReport\.landscape\.collapseSetup = await evaluate/);
  assert.match(
    source,
    /await screenshot\("game-landscape-chrome-collapsed"\);\s+assertLandscapeMetrics\(captureReport\.landscape\.collapsed\)/
  );
  assert.match(source, /startLandscapeViewportTrace/);
  assert.match(source, /visualViewport\.resize/);
  assert.match(source, /summarizeFrameTimings\(viewportTrace\.frameDeltas\)/);
  assert.match(source, /p95\/p99/);
  assert.match(source, /playerCenter/);
  assert.match(source, /maxLandscapePlayerCenterErrorPx/);
  assert.match(source, /실제 Safari 캐릭터 중심 오차/);
  assert.match(source, /captureLandscapeInteriorCenterProbe/);
  assert.match(source, /zoneId: "neighborhood"/);
  assert.match(source, /position: \{ x: 585, y: 375 \}/);
  assert.match(source, /playerCenter\.centerable\.x/);
  assert.match(source, /playerCenter\.centerable\.y/);
  assert.match(source, /가로 내부 이동 후 캐릭터 중심 오차/);
  assert.match(source, /"\.world-hud__tools"/);
  assert.match(source, /captureReport\.landscape\.toolsExpanded = await captureLandscapeMetrics\("game-landscape-tools-expanded"\)/);
  assert.match(source, /await screenshot\("game-landscape-tools-expanded"\)/);
  assert.match(source, /assertLandscapeMetrics\(captureReport\.landscape\.toolsExpanded, \{ requireHudTools: true \}\)/);
  assert.match(source, /실제 Safari 펼친 안내 패널 측정 누락/);
});

test("iOS audit supports a signed physical iPhone session and native address-bar swipe", async () => {
  const source = await readFile(new URL("./check-ios-safari-visual-baselines.mjs", import.meta.url), "utf8");
  assert.match(source, /IOS_SAFARI_DEVICE_KIND/);
  assert.match(source, /IOS_DEVICE_UDID/);
  assert.match(source, /IOS_XCODE_ORG_ID/);
  assert.match(source, /performTouchSwipe/);
  assert.match(source, /pointerType: "touch"/);
});

test("iOS CI pins the stable Node runtime and recovers Simulator URL activation", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ios-safari-visual.yml", import.meta.url), "utf8");
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.match(workflow, /simctl bootstatus/);
  assert.match(workflow, /IOS_URL_WARMED=false/);
  assert.match(workflow, /simctl shutdown/);
  assert.match(workflow, /Appium will perform the authoritative navigation/);
  assert.match(workflow, /download-wda/);
  assert.doesNotMatch(workflow, /mkdir -p "\$WDA_CACHE_DIR"/);
  assert.match(workflow, /mkdir -p "\$\(dirname "\$WDA_CACHE_DIR"\)"/);
  assert.match(workflow, /appium-3\.6\.0-xcuitest-11\.4\.0-v4/);
  assert.match(workflow, /\.cache\/ios-safari-appium/);
  assert.match(workflow, /npm install --prefix "\$APPIUM_CACHE_DIR"/);
  assert.doesNotMatch(workflow, /npm install --global appium/);
  assert.match(workflow, /bridge-install-duration-ms/);
  assert.match(workflow, /appium-cache-hit/);
  assert.match(workflow, /success\(\).*ios-automation-cache\.outputs\.cache-hit/);
  assert.match(workflow, /IOS_PREBUILT_WDA_PATH/);
  assert.match(workflow, /actions\/cache\/save@v5/);
  assert.match(workflow, /cron: "17 3 \* \* 1"/);
  assert.match(workflow, /cron: "47 4 1 \* \*"/);
  assert.match(workflow, /github\.event\.schedule == '47 4 1 \* \*'/);
  assert.match(workflow, /recreate-session/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /seed-ios-safari-stability-history\.mjs/);
  assert.match(workflow, /ios-safari-stability-v2-/);
  assert.match(workflow, /ios-safari-stability-history-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /compositor-fault-injection/);
  assert.match(workflow, /COMPOSITOR_RECOVERY_DURATION_MS/);
  assert.match(workflow, /COMPOSITOR_RECOVERY_STRATEGY/);
});
