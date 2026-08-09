import test from "node:test";
import assert from "node:assert/strict";
import {
  auditPwaLogicalChunkBudgets,
  comparePwaCacheAssets,
  formatPwaCacheAssetTrendMarkdown,
  hydratePwaCacheAssetDigests,
  mergePwaCacheAssetHistory,
  logicalPwaAssetPath,
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

test("PWA cache trend pairs Vite hash replacements and compares content digests", () => {
  const previous = pwaCacheAssetSample(precache([
    { path: "./assets/GameWorld-AAAAAAAA.js", rawBytes: 100, transferBytes: 70, sha256: "a".repeat(64) },
    { path: "./assets/index-CCCCCCCC.css", rawBytes: 50, transferBytes: 30, sha256: "c".repeat(64) }
  ]), { sha: "old" });
  const current = pwaCacheAssetSample(precache([
    { path: "./assets/GameWorld-BBBBBBBB.js", rawBytes: 108, transferBytes: 74, sha256: "b".repeat(64) },
    { path: "./assets/index-DDDDDDDD.css", rawBytes: 50, transferBytes: 30, sha256: "c".repeat(64) }
  ]), { sha: "new" });

  const trend = comparePwaCacheAssets(current, previous);
  assert.deepEqual(trend.added, []);
  assert.deepEqual(trend.removed, []);
  assert.deepEqual(trend.replaced.map(({ previousPath, path, contentChanged, transferBytesDelta }) => (
    [previousPath, path, contentChanged, transferBytesDelta]
  )), [
    ["./assets/GameWorld-AAAAAAAA.js", "./assets/GameWorld-BBBBBBBB.js", true, 4],
    ["./assets/index-CCCCCCCC.css", "./assets/index-DDDDDDDD.css", false, 0]
  ]);
  const markdown = formatPwaCacheAssetTrendMarkdown(trend);
  assert.match(markdown, /해시가 교체된 번들/);
  assert.match(markdown, /동일 내용·해시만 변경/);
  assert.match(markdown, /내용 변경/);
});

test("PWA cache trend hydrates a legacy hashed bundle digest from the live baseline", async () => {
  const legacy = pwaCacheAssetSample(precache([
    { path: "./assets/GameWorld-AAAAAAAA.js", rawBytes: 3, transferBytes: 3 },
    { path: "./index.html", rawBytes: 4, transferBytes: 4 }
  ]), { sha: "legacy" });
  const requests = [];
  const hydrated = await hydratePwaCacheAssetDigests(
    legacy,
    "https://example.test/invitation/",
    async (url, init) => {
      requests.push([url.toString(), init]);
      return new Response("old", { status: 200 });
    }
  );
  assert.equal(hydrated.groups.core.assets[0].sha256, "cba06b5736faf67e54b07b561eae94395e774c517a7d910a54369e1263ccfbd4");
  assert.equal(hydrated.groups.core.assets[1].sha256, null);
  assert.deepEqual(requests, [[
    "https://example.test/invitation/assets/GameWorld-AAAAAAAA.js",
    { cache: "no-store" }
  ]]);
});

test("PWA logical chunk budget attributes hashed output to stable chunk names", () => {
  const previous = pwaCacheAssetSample(precache([
    { path: "./assets/index-AAAAAAAA.js", rawBytes: 120_000, transferBytes: 90_000, sha256: "a".repeat(64) }
  ]), { sha: "old" });
  const current = pwaCacheAssetSample(precache([
    { path: "./assets/index-BBBBBBBB.js", rawBytes: 124_000, transferBytes: 94_000, sha256: "b".repeat(64) }
  ]), { sha: "new" });
  const trend = comparePwaCacheAssets(current, previous);
  const budget = auditPwaLogicalChunkBudgets(current, trend);

  assert.equal(logicalPwaAssetPath(current.groups.core.assets[0]), "./assets/index.js");
  assert.equal(budget.status, "passed");
  assert.deepEqual(budget.evaluations.map(({ logicalPath, passed }) => [logicalPath, passed]), [
    ["./assets/index.js", true]
  ]);
});

test("PWA logical chunk budget blocks absolute, growth, and new-chunk regressions", () => {
  const previous = pwaCacheAssetSample(precache([
    { path: "./assets/index-AAAAAAAA.js", rawBytes: 100_000, transferBytes: 90_000, sha256: "a".repeat(64) }
  ]), { sha: "old" });
  const current = pwaCacheAssetSample(precache([
    { path: "./assets/index-BBBBBBBB.js", rawBytes: 180_000, transferBytes: 130_000, sha256: "b".repeat(64) },
    { path: "./assets/NewFeature-CCCCCCCC.js", rawBytes: 150_000, transferBytes: 70_000, sha256: "c".repeat(64) }
  ]), { sha: "new" });
  const budget = auditPwaLogicalChunkBudgets(current, comparePwaCacheAssets(current, previous));

  assert.equal(budget.status, "failed");
  assert.ok(budget.issues.some((issue) => issue.includes("index.js 전송 용량")));
  assert.ok(budget.issues.some((issue) => issue.includes("index.js 배포 증가")));
  assert.ok(budget.issues.some((issue) => issue.includes("NewFeature.js 새 청크")));
});
