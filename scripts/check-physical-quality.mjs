import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  assessPhysicalQualityEvidence,
  parseAdbDevices,
  parseDisplays,
  parseXctraceDevices
} from "./lib/physicalQualityAudit.mjs";

const run = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const evidencePath = option("--evidence");
const outputPath = option("--output", path.join(rootDir, ".superpowers/physical-quality/report.json"));
const requireAll = process.argv.includes("--require-all");

async function optionalCommand(command, args) {
  try {
    return (await run(command, args, { maxBuffer: 4 * 1024 * 1024 })).stdout;
  } catch {
    return "";
  }
}

async function loadEvidence() {
  if (!evidencePath) return {};
  await access(evidencePath);
  return JSON.parse(await readFile(evidencePath, "utf8"));
}

const [adbOutput, xctraceOutput, displayOutput, loadedEvidence] = await Promise.all([
  optionalCommand("adb", ["devices", "-l"]),
  optionalCommand("xcrun", ["xctrace", "list", "devices"]),
  optionalCommand("system_profiler", ["SPDisplaysDataType"]),
  loadEvidence()
]);
const androidDevices = parseAdbDevices(adbOutput);
const androidDeviceId = androidDevices[0]?.id ?? null;
const [androidAccessibilityEnabled, androidAccessibilityServices] = androidDeviceId
  ? await Promise.all([
      optionalCommand("adb", ["-s", androidDeviceId, "shell", "settings", "get", "secure", "accessibility_enabled"]),
      optionalCommand("adb", ["-s", androidDeviceId, "shell", "settings", "get", "secure", "enabled_accessibility_services"])
    ])
  : ["", ""];
const talkBackEnabled = androidAccessibilityEnabled.trim() === "1"
  && /(talkback|screenreader)/i.test(androidAccessibilityServices);
const evidence = {
  ...loadedEvidence,
  accessibility: {
    ...loadedEvidence.accessibility,
    ...(loadedEvidence.accessibility?.android ? {
      android: { ...loadedEvidence.accessibility.android, screenReaderEnabled: talkBackEnabled }
    } : {})
  }
};
const report = {
  generatedAt: new Date().toISOString(),
  ...assessPhysicalQualityEvidence({
    evidence,
    androidDevices,
    iosDevices: parseXctraceDevices(xctraceOutput),
    displays: parseDisplays(displayOutput)
  }),
  androidAccessibility: {
    deviceId: androidDeviceId,
    accessibilityEnabled: androidAccessibilityEnabled.trim() === "1",
    talkBackEnabled
  }
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`실기기 품질 게이트: ${report.status} · 미완료 ${report.issues.length}건`);
for (const issue of report.issues) console.log(`- ${issue}`);
console.log(`보고서: ${outputPath}`);
if (requireAll && report.status !== "passed") process.exitCode = 1;
