import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { migrateVisualBaselineProvenance } from "./lib/visualBaselineProvenanceMigration.mjs";
import { verifyVisualBaselineProvenance } from "./lib/visualBaselineProvenanceVerification.mjs";

const contract = {
  id: "fixture",
  metadataPath: "scripts/visual-baselines/fixture.json",
  provenanceVersion: 2,
  baselinePath: () => "scripts/visual-baselines/fixture.webp",
  singleSha: true
};
const trustedEnv = {
  GITHUB_ACTIONS: "true",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: "a".repeat(40),
  GITHUB_REPOSITORY: "owner/repo",
  GITHUB_SERVER_URL: "https://github.com"
};

async function fixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "visual-provenance-migration-"));
  const baselineDir = path.join(rootDir, "scripts/visual-baselines");
  await mkdir(baselineDir, { recursive: true });
  const baseline = Buffer.from("unchanged-approved-pixels");
  await writeFile(path.join(baselineDir, "fixture.webp"), baseline);
  await writeFile(path.join(baselineDir, "fixture.json"), `${JSON.stringify({
    version: 1,
    sha256: createHash("sha256").update(baseline).digest("hex")
  }, null, 2)}\n`);
  return { rootDir, baseline };
}

test("trusted migration upgrades metadata without changing approved baseline bytes", async () => {
  const { rootDir, baseline } = await fixture();
  try {
    const result = await migrateVisualBaselineProvenance({
      rootDir,
      reason: "현행 출처 스키마 승격",
      env: trustedEnv,
      now: new Date("2026-08-11T00:00:00.000Z"),
      contracts: [contract]
    });
    assert.deepEqual(await readFile(path.join(rootDir, contract.baselinePath())), baseline);
    assert.equal(result.after.summaries[0].status, "verified");
    const metadata = JSON.parse(await readFile(path.join(rootDir, contract.metadataPath), "utf8"));
    assert.equal(metadata.version, 2);
    assert.equal(metadata.provenance.subjectKind, "approved-baseline-set");
    assert.equal(metadata.provenanceApproval.baselinePixelsChanged, false);
    assert.equal((await verifyVisualBaselineProvenance({ rootDir, contracts: [contract] })).passed, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("visual baseline provenance migration rejects a local environment", async () => {
  const { rootDir } = await fixture();
  try {
    await assert.rejects(
      migrateVisualBaselineProvenance({ rootDir, reason: "local", env: {}, contracts: [contract] }),
      /신뢰된 GitHub Actions/
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
