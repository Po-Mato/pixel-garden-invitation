import assert from "node:assert/strict";
import test from "node:test";
import { classifyIosSafariFailure } from "./lib/iosSafariFailureTaxonomy.mjs";

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
