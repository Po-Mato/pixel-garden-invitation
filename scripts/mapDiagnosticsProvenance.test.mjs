import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMapDiagnosticsProvenance,
  buildMapDiagnosticsProvenanceSummary,
  verifyMapDiagnosticsProvenanceSubjects
} from "./lib/mapDiagnosticsProvenance.mjs";

test("diagnostic provenance hashes sorted subjects and emits a strict verification command", () => {
  const manifest = buildMapDiagnosticsProvenance([
    { path: "reports/z.json", source: "z" },
    { path: "reports/a.json", source: "a" }
  ], {
    sha: "a".repeat(40),
    runId: 12,
    repository: "Po-Mato/pixel-garden-invitation",
    generatedAt: "2026-08-05T00:00:00.000Z"
  });
  assert.deepEqual(manifest.subjects.map(({ path }) => path), ["reports/a.json", "reports/z.json"]);
  assert.match(manifest.subjects[0].sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.verification.command, /map-diagnostics-evidence-pack\.tgz/);
  assert.match(manifest.verification.offlineCommand, /--bundle map-diagnostics-attestation\.json/);
  assert.match(manifest.verification.offlineCommand, /--custom-trusted-root trusted_root\.jsonl/);
  assert.match(manifest.verification.command, /--repo Po-Mato\/pixel-garden-invitation/);
  assert.match(manifest.verification.command, /--signer-workflow Po-Mato\/pixel-garden-invitation\/.github\/workflows\/visual-regression.yml/);
  assert.match(manifest.verification.subjectCommand, /maps:diagnostics-evidence-pack-verify/);
  assert.deepEqual(verifyMapDiagnosticsProvenanceSubjects(manifest, [
    { path: "reports/a.json", source: "a" },
    { path: "reports/z.json", source: "z" }
  ]), { verifiedCount: 2 });
  const summary = buildMapDiagnosticsProvenanceSummary(manifest, { attestationUrl: "https://github.com/example/attestations/1" });
  assert.match(summary, /상태 \*\*signed\*\*/);
  assert.match(summary, /Sigstore 서명 Attestation/);
});

test("diagnostic provenance rejects unsafe and duplicate subject paths", () => {
  const options = { sha: "b".repeat(40), runId: 1, repository: "owner/repo" };
  assert.throws(() => buildMapDiagnosticsProvenance([{ path: "../secret", source: "x" }], options), /안전하지/);
  assert.throws(() => buildMapDiagnosticsProvenance([{ path: "a", source: "1" }, { path: "a", source: "2" }], options), /중복/);
  const manifest = buildMapDiagnosticsProvenance([{ path: "a", source: "1" }], options);
  assert.throws(() => verifyMapDiagnosticsProvenanceSubjects(manifest, [{ path: "a", source: "2" }]), /검증 실패/);
});
