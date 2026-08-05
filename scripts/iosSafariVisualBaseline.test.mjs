import assert from "node:assert/strict";
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
    "directions-text-200-bottom"
  ]);
  assert.match(
    iosSafariBaselinePath("/repo", "game"),
    /ios-safari-iphone-16-pro-ios-18-5-safari-game\.webp$/
  );
});
