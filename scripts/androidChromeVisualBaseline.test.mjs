import assert from "node:assert/strict";
import test from "node:test";
import {
  androidChromeBaselinePath,
  androidChromeVisualProfile,
  androidChromeVisualStates
} from "./lib/androidChromeVisualBaseline.mjs";

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
