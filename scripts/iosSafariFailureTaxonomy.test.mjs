import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyIosSafariFailure,
  decideIosSafariCaptureRetry,
  iosSafariCaptureRetryPolicy
} from "./lib/iosSafariFailureTaxonomy.mjs";

test("iOS Safari failure taxonomy separates product regressions from automation", () => {
  assert.deepEqual(
    classifyIosSafariFailure(new Error("game pixel ratio changed"), { phase: "baseline-comparison" }),
    {
      category: "product",
      kind: "product-visual-regression",
      phase: "baseline-comparison",
      retryable: false,
      message: "game pixel ratio changed"
    }
  );
  assert.equal(
    classifyIosSafariFailure(new Error("WebDriverAgent did not answer on port 8100"), { phase: "wda-session" }).kind,
    "automation-wda"
  );
  assert.equal(
    classifyIosSafariFailure(new Error("시뮬레이터 bootstatus 실패"), { phase: "safari-navigation" }).category,
    "infrastructure"
  );
});

test("native compositor failures remain retryable automation failures", () => {
  const failure = classifyIosSafariFailure(new Error("네이티브 캡처 자동 복구 실패"), { phase: "portrait-game" });
  assert.equal(failure.kind, "automation-compositor");
  assert.equal(failure.retryable, true);
});

test("automation and infrastructure failures receive exactly one retry", () => {
  assert.equal(iosSafariCaptureRetryPolicy.maximumAttempts, 2);
  assert.deepEqual(
    decideIosSafariCaptureRetry({
      attempt: 1,
      failure: { category: "automation", kind: "automation-wda", retryable: true }
    }),
    {
      shouldRetry: true,
      attempt: 1,
      nextAttempt: 2,
      maximumAttempts: 2,
      category: "automation",
      kind: "automation-wda",
      reason: "retryable-automation-failure"
    }
  );
  assert.equal(decideIosSafariCaptureRetry({
    attempt: 2,
    failure: { category: "infrastructure", kind: "infrastructure-simulator", retryable: true }
  }).shouldRetry, false);
});

test("product and unknown failures are never retried", () => {
  for (const category of ["product", "unknown"]) {
    const decision = decideIosSafariCaptureRetry({
      attempt: 1,
      failure: { category, kind: `${category}-failure`, retryable: category === "product" ? false : true }
    });
    assert.equal(decision.shouldRetry, false);
    assert.equal(decision.reason, "non-retryable-failure");
  }
});
