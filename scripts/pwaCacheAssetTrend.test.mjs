import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePwaCacheAssets,
  formatPwaCacheAssetTrendMarkdown,
  mergePwaCacheAssetHistory,
  pwaCacheAssetSample
} from "./lib/pwaCacheAssetTrend.mjs";

function precache(coreAssets, featureAssets = []) {
  const group = (assets) => ({
    total: assets.length,
    rawBytes: assets.reduce((sum, asset) => sum + asset.rawBytes, 0),
    transferBytes: assets.reduce((sum, asset) => sum + asset.transferBytes, 0),
    assets
  });
  return { core: group(coreAssets), features: group(featureAssets) };
}

test("PWA cache asset trend identifies new, changed, and removed files per deployment", () => {
  const previous = pwaCacheAssetSample(precache([
    { path: "./index.html", rawBytes: 100, transferBytes: 70 },
    { path: "./old.js", rawBytes: 80, transferBytes: 50 }
  ]), { sha: "old", generatedAt: "2026-08-08T00:00:00.000Z" });
  const current = pwaCacheAssetSample(precache([
    { path: "./index.html", rawBytes: 110, transferBytes: 75 },
    { path: "./new.js", rawBytes: 60, transferBytes: 40 }
  ]), { sha: "new", generatedAt: "2026-08-09T00:00:00.000Z" });
  const trend = comparePwaCacheAssets(current, previous);
  assert.equal(trend.status, "compared");
  assert.deepEqual(trend.added.map(({ path }) => path), ["./new.js"]);
  assert.deepEqual(trend.changed.map(({ path, transferBytesDelta }) => [path, transferBytesDelta]), [
    ["./index.html", 5]
  ]);
  assert.deepEqual(trend.removed.map(({ path }) => path), ["./old.js"]);
  assert.equal(trend.groups.core.transferBytesDelta, -5);
  assert.match(formatPwaCacheAssetTrendMarkdown(trend), /새로 캐시에 들어온 파일/);
  assert.match(formatPwaCacheAssetTrendMarkdown(trend), /`\.\/new\.js`/);
});

test("PWA cache history replaces duplicate deployment SHAs and retains new deployments", () => {
  const sample = (sha, runId) => pwaCacheAssetSample(precache([]), { sha, runId, generatedAt: sha });
  const merged = mergePwaCacheAssetHistory([
    sample("one", "1"),
    sample("two", "2")
  ], sample("two", "3"));
  assert.deepEqual(merged.map(({ sha, runId }) => [sha, runId]), [
    ["one", "1"],
    ["two", "3"]
  ]);
});
