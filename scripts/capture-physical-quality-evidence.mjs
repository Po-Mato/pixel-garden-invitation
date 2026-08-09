import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseAdbDevices, parseXctraceDevices } from "./lib/physicalQualityAudit.mjs";
import {
  auditPhysicalQualityCaptureSession,
  buildPhysicalQualityEvidence,
  createPhysicalQualityCaptureTemplate,
  physicalQualityCaptureArtifactCount,
  physicalQualityCaptureEntries
} from "./lib/physicalQualityCapture.mjs";

const run = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const sessionPath = path.resolve(option(
  "--session",
  path.join(rootDir, ".superpowers/physical-quality/capture-session.json")
));
const evidencePath = path.resolve(option(
  "--evidence-output",
  path.join(path.dirname(sessionPath), "physical-quality-evidence.json")
));
const reportPath = path.resolve(option(
  "--report-output",
  path.join(path.dirname(sessionPath), "report.json")
));

async function optionalCommand(command, args) {
  try {
    return (await run(command, args, { maxBuffer: 4 * 1024 * 1024 })).stdout;
  } catch {
    return "";
  }
}

const [adbOutput, xctraceOutput] = await Promise.all([
  optionalCommand("adb", ["devices", "-l"]),
  optionalCommand("xcrun", ["xctrace", "list", "devices"])
]);
const connected = {
  androidDevices: parseAdbDevices(adbOutput),
  iosDevices: parseXctraceDevices(xctraceOutput)
};

try {
  await access(sessionPath);
} catch {
  await mkdir(path.dirname(sessionPath), { recursive: true });
  await writeFile(sessionPath, `${JSON.stringify(createPhysicalQualityCaptureTemplate(connected), null, 2)}\n`);
  console.log(`실기기 증빙 수집 세션을 생성했습니다: ${sessionPath}`);
  console.log(`지정된 9개 파일과 판정값을 채운 뒤 같은 명령을 다시 실행하세요.`);
  process.exitCode = 1;
  process.exit();
}

const session = JSON.parse(await readFile(sessionPath, "utf8"));
const sessionIssues = auditPhysicalQualityCaptureSession(session);
const baseDir = path.dirname(sessionPath);
const hashes = new Map();
const missing = [];
for (const [id, entry] of physicalQualityCaptureEntries(session)) {
  if (!entry?.artifactPath) {
    missing.push(`${id}: 경로 누락`);
    continue;
  }
  try {
    const artifact = await readFile(path.resolve(baseDir, entry.artifactPath));
    hashes.set(entry.artifactPath, createHash("sha256").update(artifact).digest("hex"));
  } catch {
    missing.push(`${id}: ${entry.artifactPath}`);
  }
}

const evidence = buildPhysicalQualityEvidence(session, hashes);
await mkdir(path.dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`실기기 증빙 봉인: ${hashes.size}/${physicalQualityCaptureArtifactCount}개 · 누락 ${missing.length}개`);
for (const issue of sessionIssues) console.log(`- ${issue}`);
for (const item of missing) console.log(`- ${item}`);

const args = [
  path.join(rootDir, "scripts/check-physical-quality.mjs"),
  "--evidence", evidencePath,
  "--output", reportPath,
  "--require-all"
];
const audit = await run(process.execPath, args, { maxBuffer: 8 * 1024 * 1024 }).catch((error) => error);
if (audit.stdout) process.stdout.write(audit.stdout);
if (audit.stderr) process.stderr.write(audit.stderr);
if (typeof audit.code === "number" && audit.code !== 0) process.exitCode = audit.code;
if (sessionIssues.length > 0) process.exitCode = 1;
