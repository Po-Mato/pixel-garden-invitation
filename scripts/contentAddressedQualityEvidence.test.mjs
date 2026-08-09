import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  materializeContentAddressedQualityEvidence,
  packContentAddressedQualityEvidence
} from "./lib/contentAddressedQualityEvidence.mjs";

test("content-addressed evidence stores duplicate binary files once and restores them", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "quality-evidence-"));
  const inputDir = path.join(temporary, "input");
  const packageDir = path.join(temporary, "package");
  const restoredDir = path.join(temporary, "restored");
  await mkdir(path.join(inputDir, "nested"), { recursive: true });
  const pixels = Buffer.from([1, 2, 3, 4, 5, 6]);
  await Promise.all([
    writeFile(path.join(inputDir, "first.png"), pixels),
    writeFile(path.join(inputDir, "nested/second.png"), pixels),
    writeFile(path.join(inputDir, "report.json"), '{"status":"passed"}\n')
  ]);

  const manifest = await packContentAddressedQualityEvidence({ inputDir, outputDir: packageDir });
  assert.equal(manifest.totals.files, 3);
  assert.equal(manifest.totals.omittedDuplicateBytes, pixels.length);
  assert.equal(manifest.files.filter(({ storage }) => storage === "sha256").length, 2);
  assert.equal(new Set(manifest.files.filter(({ storage }) => storage === "sha256").map(({ storagePath }) => storagePath)).size, 1);

  await materializeContentAddressedQualityEvidence({ inputDir: packageDir, outputDir: restoredDir });
  assert.deepEqual(await readFile(path.join(restoredDir, "nested/second.png")), pixels);
  assert.equal(await readFile(path.join(restoredDir, "report.json"), "utf8"), '{"status":"passed"}\n');
});

test("content-addressed evidence rejects nested output and unsafe restore paths", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "quality-evidence-safe-"));
  await assert.rejects(
    packContentAddressedQualityEvidence({ inputDir: temporary, outputDir: path.join(temporary, "nested") }),
    /입력 폴더 밖/
  );
});

test("pack CLI accepts equals-style exclusions used by release workflows", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "quality-evidence-cli-"));
  const inputDir = path.join(temporary, "input");
  const packageDir = path.join(temporary, "package");
  await mkdir(inputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(inputDir, "current.png"), Buffer.from([1, 2, 3])),
    writeFile(path.join(inputDir, "current-diff.png"), Buffer.from([4, 5, 6]))
  ]);

  const result = spawnSync(process.execPath, [
    "scripts/pack-content-addressed-quality-evidence.mjs",
    "--input-dir", inputDir,
    "--output-dir", packageDir,
    "--exclude-suffix=-diff.png"
  ], { cwd: path.resolve("."), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(path.join(packageDir, "quality-evidence-index.json"), "utf8"));
  assert.deepEqual(manifest.files.map(({ logicalPath }) => logicalPath), ["current.png"]);
});

test("release workflows upload packaged evidence instead of duplicate binary trees", async () => {
  for (const name of ["pages.yml", "visual-regression.yml", "android-chrome-visual.yml", "ios-safari-visual.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
    assert.match(source, /pack-content-addressed-quality-evidence\.mjs/);
    assert.match(source, /\.quality-artifacts\//);
    assert.match(source, /\.quality-artifacts\/[\s\S]*include-hidden-files: true/);
  }
});
