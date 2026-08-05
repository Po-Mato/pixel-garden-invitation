import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  iosSafariBaselinePath,
  iosSafariVisualProfile,
  iosSafariVisualStates
} from "./lib/iosSafariVisualBaseline.mjs";

test("real iOS Safari baseline contract covers game and 200% directions scroll", () => {
  assert.deepEqual(iosSafariVisualProfile, {
    id: "iphone-16-pro-ios-18-5-safari",
    deviceName: "iPhone 16 Pro",
    runtime: "iOS 18.5",
    requiredDirectionsScroll: 160
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
});

test("iOS audit supports a signed physical iPhone session and native address-bar swipe", async () => {
  const source = await readFile(new URL("./check-ios-safari-visual-baselines.mjs", import.meta.url), "utf8");
  assert.match(source, /IOS_SAFARI_DEVICE_KIND/);
  assert.match(source, /IOS_DEVICE_UDID/);
  assert.match(source, /IOS_XCODE_ORG_ID/);
  assert.match(source, /performTouchSwipe/);
  assert.match(source, /pointerType: "touch"/);
});
