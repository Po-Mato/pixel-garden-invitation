import assert from "node:assert/strict";
import test from "node:test";
import {
  androidChromeBaselinePath,
  androidChromeVisualProfile,
  androidChromeVisualStates
} from "./lib/androidChromeVisualBaseline.mjs";
import { readFile } from "node:fs/promises";

test("real Android Chrome baseline covers the game and directions scroll", () => {
  assert.deepEqual(androidChromeVisualProfile, {
    id: "pixel-7-api-35-chrome",
    deviceName: "Pixel 7",
    runtime: "Android 15 (API 35)",
    requiredDirectionsScroll: 0
  });
  assert.deepEqual(androidChromeVisualStates, [
    "game",
    "directions"
  ]);
  assert.match(
    androidChromeBaselinePath("/repo", "game"),
    /android-chrome-pixel-7-api-35-chrome-game\.webp$/
  );
});

test("real Android capture report records run provenance and network readiness attempts", async () => {
  const source = await readFile(new URL("./check-android-chrome-visual-baselines.mjs", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/android-chrome-visual.yml", import.meta.url), "utf8");
  assert.match(source, /runId: process\.env\.GITHUB_RUN_ID/);
  assert.match(source, /networkReadiness/);
  assert.match(source, /navigateAndroidChromeWithRetry/);
  assert.match(source, /ANDROID_CAPTURE_RETRY === "renderer-disconnect"/);
  assert.match(workflow, /Unable to receive message from renderer\|not connected to DevTools/);
  assert.match(workflow, /ANDROID_CAPTURE_RETRY=renderer-disconnect/);
  assert.match(workflow, /am force-stop com\.android\.chrome/);
});
