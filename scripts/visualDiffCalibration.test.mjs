import assert from "node:assert/strict";
import test from "node:test";
import { buildVisualDiffCalibration, seedVisualDiffCalibrationHistory } from "./lib/visualDiffCalibration.mjs";

const summary = (index) => ({
  sha: `sha-${index}`,
  generatedAt: `2026-08-${String(index).padStart(2, "0")}T00:00:00.000Z`,
  visualDifferences: {
    details: [
      { source: "android", engine: "chromium", state: "game", classification: { filteredNoiseShare: 0.82, budgetUsage: 0.12 } },
      { source: "ios", engine: "webkit", state: "game", classification: { filteredNoiseShare: 0.76, budgetUsage: 0.18 } }
    ]
  }
});

test("visual diff calibration activates only after five distinct releases per engine", () => {
  let history = { version: 1, snapshots: [] };
  for (let index = 1; index <= 4; index += 1) history = seedVisualDiffCalibrationHistory(history, [summary(index)]);
  assert.equal(buildVisualDiffCalibration(summary(4), history).calibration.engines.webkit.status, "warming");

  const result = buildVisualDiffCalibration(summary(5), history);
  assert.equal(result.calibration.status, "active");
  assert.equal(result.calibration.engines.chromium.sampleCount, 5);
  assert.equal(result.calibration.engines.webkit.sampleCount, 5);
  assert.ok(result.policies.chromium.rendererNoiseMinimumShare >= 0.5);
  assert.ok(result.policies.webkit.rendererNoiseMaximumBudgetUsage <= 0.6);
});

test("visual diff calibration deduplicates reruns of the same SHA", () => {
  const history = seedVisualDiffCalibrationHistory({ version: 1, snapshots: [] }, [summary(1), summary(1)]);
  assert.equal(history.snapshots.length, 1);
});
