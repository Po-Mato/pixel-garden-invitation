import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isRetryableAndroidNavigationError,
  navigateAndroidChromeWithRetry
} from "./lib/androidDeviceReadiness.mjs";

test("Android navigation retries transient emulator network readiness failures", async () => {
  let calls = 0;
  const result = await navigateAndroidChromeWithRetry({
    targetUrl: "http://127.0.0.1:4179/",
    navigate: async () => { calls += 1; },
    verify: async () => {
      if (calls < 2) throw new Error("net::ERR_ADDRESS_UNREACHABLE");
    },
    wait: async () => undefined
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.attempts.map(({ outcome }) => outcome), ["retryable-failure", "ready"]);
});

test("Android navigation fails immediately for a non-network application error", async () => {
  await assert.rejects(() => navigateAndroidChromeWithRetry({
    targetUrl: "http://127.0.0.1:4179/",
    navigate: async () => undefined,
    verify: async () => { throw new Error("Unexpected app assertion"); },
    wait: async () => undefined
  }), /Unexpected app assertion/);
  assert.equal(isRetryableAndroidNavigationError(new Error("net::ERR_CONNECTION_REFUSED")), true);
  assert.equal(isRetryableAndroidNavigationError(new Error("Unexpected app assertion")), false);
});

test("Android workflow uses adb reverse for both audited servers", async () => {
  const workflow = await readFile(new URL("../.github/workflows/android-chrome-visual.yml", import.meta.url), "utf8");
  assert.match(workflow, /adb reverse tcp:4179 tcp:4179/);
  assert.match(workflow, /--url http:\/\/127\.0\.0\.1:4179\//);
});
