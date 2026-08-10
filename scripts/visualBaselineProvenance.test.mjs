import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildVisualBaselineProvenance } from "./lib/visualBaselineProvenance.mjs";

test("visual baseline provenance binds source run, commit, and sorted capture checksum", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "visual-provenance-"));
  try {
    const game = path.join(directory, "game.png");
    const directions = path.join(directory, "directions.png");
    await Promise.all([writeFile(game, "game"), writeFile(directions, "directions")]);
    const provenance = await buildVisualBaselineProvenance({
      files: [
        { logicalPath: "game", filePath: game },
        { logicalPath: "directions", filePath: directions }
      ],
      captureReport: { runId: "123", runAttempt: 2, sha: "a".repeat(40) },
      env: { GITHUB_REPOSITORY: "owner/repo", GITHUB_SERVER_URL: "https://github.example" }
    });
    assert.equal(provenance.runId, "123");
    assert.equal(provenance.commitSha, "a".repeat(40));
    assert.equal(provenance.runUrl, "https://github.example/owner/repo/actions/runs/123");
    assert.match(provenance.artifactSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(provenance.files.map(({ logicalPath }) => logicalPath), ["directions", "game"]);
    assert.ok(provenance.files.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
