import { createHash } from "node:crypto";

export const mapDiagnosticsProvenanceMarker = "<!-- map-diagnostics-provenance -->";

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function safeRelativePath(filePath) {
  if (typeof filePath !== "string" || filePath === "" || filePath.startsWith("/") || filePath.split(/[\\/]/).includes("..")) {
    throw new Error(`출처 증명 대상 경로가 안전하지 않습니다: ${filePath}`);
  }
  return filePath.replaceAll("\\", "/");
}

export function buildMapDiagnosticsProvenance(subjects, {
  sha,
  runId,
  repository,
  workflow = ".github/workflows/visual-regression.yml",
  generatedAt = new Date().toISOString()
}) {
  if (!/^[a-f0-9]{7,64}$/i.test(sha ?? "")) throw new Error("출처 증명 sha가 필요합니다");
  if (!repository?.includes("/")) throw new Error("출처 증명 repository는 owner/name 형식이어야 합니다");
  if (!Array.isArray(subjects) || subjects.length === 0) throw new Error("출처 증명 대상 파일이 필요합니다");
  const entries = subjects.map(({ path, source }) => {
    const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source);
    return { path: safeRelativePath(path), size: buffer.byteLength, sha256: sha256(buffer) };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(entries.map(({ path }) => path)).size !== entries.length) throw new Error("출처 증명 대상 경로가 중복되었습니다");
  return {
    kind: "map-diagnostics-provenance",
    version: 1,
    generatedAt,
    source: { repository, sha, workflow, runId: String(runId ?? "local") },
    subjects: entries,
    verification: {
      command: `gh attestation verify map-diagnostics-provenance.json --repo ${repository} --signer-workflow ${repository}/${workflow}`,
      subjectCommand: "pnpm maps:diagnostics-provenance-verify -- --manifest map-diagnostics-provenance.json",
      issuer: "https://token.actions.githubusercontent.com",
      signature: "Sigstore keyless OIDC"
    }
  };
}

export function verifyMapDiagnosticsProvenanceSubjects(manifest, subjects) {
  if (manifest?.kind !== "map-diagnostics-provenance" || manifest?.version !== 1 || !Array.isArray(manifest.subjects)) {
    throw new Error("지원하는 맵 진단 출처 매니페스트가 아닙니다");
  }
  const actual = new Map(subjects.map(({ path, source }) => {
    const safePath = safeRelativePath(path);
    const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source);
    return [safePath, { size: buffer.byteLength, sha256: sha256(buffer) }];
  }));
  const failures = [];
  for (const expected of manifest.subjects) {
    const candidate = actual.get(safeRelativePath(expected.path));
    if (!candidate) failures.push(`${expected.path}: missing`);
    else if (candidate.size !== expected.size) failures.push(`${expected.path}: size ${candidate.size} != ${expected.size}`);
    else if (candidate.sha256 !== expected.sha256) failures.push(`${expected.path}: sha256 mismatch`);
  }
  if (failures.length) throw new Error(`진단 출처 대상 검증 실패\n${failures.join("\n")}`);
  return { verifiedCount: manifest.subjects.length };
}

export function buildMapDiagnosticsProvenanceSummary(manifest, { attestationUrl = "", runUrl = "" } = {}) {
  const status = attestationUrl ? "signed" : "awaiting-signature";
  const links = [
    attestationUrl ? `[Sigstore 서명 Attestation](${attestationUrl})` : "Attestation URL은 CI 서명 단계에서 기록됩니다.",
    runUrl ? `[워크플로 실행](${runUrl})` : ""
  ].filter(Boolean).join(" · ");
  const lines = [
    mapDiagnosticsProvenanceMarker,
    "## 진단 산출물 출처 증명",
    "",
    `상태 **${status}** · 커밋 \`${manifest.source.sha.slice(0, 12)}\` · 대상 **${manifest.subjects.length}개**`,
    "",
    `서명 검증: \`${manifest.verification.command}\``,
    "",
    `대상 파일 검증: \`${manifest.verification.subjectCommand}\``,
    "",
    links,
    "",
    "> SHA-256 매니페스트를 GitHub OIDC 기반 단기 인증서로 서명하며, 저장소와 서명 워크플로까지 검증합니다."
  ];
  return `${lines.join("\n")}\n`;
}
