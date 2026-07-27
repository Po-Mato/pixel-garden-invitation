import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  compareMobileGameVisualAudit,
  renderMobileGameVisualAudit
} from "./lib/mobileGameVisualAuditRenderer.mjs";

test("renders every map and every guest direction into a nonblank mobile regression sheet", async () => {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tempDir = await mkdtemp(path.join(tmpdir(), "mobile-game-audit-"));
  const outputPath = path.join(tempDir, "audit.png");
    const alteredPath = path.join(tempDir, "altered.png");
    const diffPath = path.join(tempDir, "diff.png");
  const baselinePath = path.join(rootDir, "scripts/visual-baselines/mobile-game-visual-regression.webp");

  try {
    const result = await renderMobileGameVisualAudit({ rootDir, outputPath });
    const metadata = await sharp(outputPath).metadata();
    const stats = await sharp(outputPath).stats();

    assert.equal(result.mapZoneIds.length, 10);
    assert.equal(result.characterPresetIds.length, 12);
    assert.equal(result.directionSampleCount, 48);
    assert.equal(metadata.width, result.outputWidth);
    assert.equal(metadata.height, result.outputHeight);
    assert.ok(stats.channels.some((channel) => channel.stdev > 10));
    assert.ok((await readFile(outputPath)).length > 100_000);

    const comparison = await compareMobileGameVisualAudit({ currentPath: outputPath, baselinePath });
    assert.ok(comparison.changedRatio <= comparison.maxChangedRatio);

    const changedRegion = await sharp({
      create: { width: 180, height: 180, channels: 4, background: "#ff0066ff" }
    }).png().toBuffer();
    await sharp(outputPath).composite([{ input: changedRegion, left: 80, top: 100 }]).png().toFile(alteredPath);
    await assert.rejects(
      compareMobileGameVisualAudit({ currentPath: alteredPath, baselinePath, diffPath }),
      /mobile visual regression changed/
    );
    const diffMetadata = await sharp(diffPath).metadata();
    assert.equal(diffMetadata.width, result.outputWidth);
    const diffPixels = await sharp(diffPath).ensureAlpha().raw().toBuffer();
    assert.ok(diffPixels.includes(Buffer.from([255, 24, 92, 255])));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
