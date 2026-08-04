import assert from "node:assert/strict";
import test from "node:test";
import { buildMapDiagnosticsProvenance } from "./lib/mapDiagnosticsProvenance.mjs";
import {
  buildMapDiagnosticsEvidencePack,
  createMapDiagnosticsEvidencePack,
  readMapDiagnosticsEvidencePack,
  verifyMapDiagnosticsEvidencePack
} from "./lib/mapDiagnosticsEvidencePack.mjs";

const subjects = [
  { path: ".superpowers/visual-regression/a.json", source: Buffer.from("a") },
  { path: ".superpowers/visual-regression/b.json", source: Buffer.from("b") }
];
const manifest = buildMapDiagnosticsProvenance(subjects, {
  sha: "a".repeat(40), runId: 10, repository: "owner/repo", generatedAt: "2026-08-05T00:00:00.000Z"
});
const manifestSource = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

test("evidence pack preserves the manifest and every checksum-bound subject", () => {
  const pack = createMapDiagnosticsEvidencePack(manifestSource, subjects);
  const result = verifyMapDiagnosticsEvidencePack(pack);
  assert.equal(result.verifiedCount, 2);
  assert.equal(result.manifest.source.sha, "a".repeat(40));
  assert.match(result.packChecksum, /^[a-f0-9]{64}$/);
  assert.deepEqual([...readMapDiagnosticsEvidencePack(pack).keys()], [
    "map-diagnostics-provenance.json",
    "VERIFY.md",
    "SHA256SUMS",
    "subjects/.superpowers/visual-regression/a.json",
    "subjects/.superpowers/visual-regression/b.json"
  ]);
});

test("evidence pack rejects a checksum mismatch and unsafe archive entries", () => {
  const mismatched = buildMapDiagnosticsEvidencePack([
    { path: "map-diagnostics-provenance.json", source: manifestSource },
    { path: "VERIFY.md", source: "verify" },
    { path: "SHA256SUMS", source: `${manifest.subjects.map(({ path, sha256 }) => `${sha256}  subjects/${path}`).join("\n")}\n` },
    { path: "subjects/.superpowers/visual-regression/a.json", source: "tampered" },
    { path: "subjects/.superpowers/visual-regression/b.json", source: "b" }
  ]);
  assert.throws(() => verifyMapDiagnosticsEvidencePack(mismatched), /검증 실패/);
  assert.throws(() => buildMapDiagnosticsEvidencePack([{ path: "../escape", source: "x" }]), /안전하지/);
});
