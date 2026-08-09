import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseAdbDevices, parseDisplays, parseXctraceDevices } from "./lib/physicalQualityAudit.mjs";
import { assessPhysicalQualityCaptureReadiness } from "./lib/physicalQualityCapture.mjs";

const run = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, ".superpowers/physical-quality/readiness.json");

async function inspectCommand(command, args) {
  try {
    return { available: true, output: (await run(command, args, { maxBuffer: 4 * 1024 * 1024 })).stdout };
  } catch (error) {
    return { available: error?.code !== "ENOENT" && !String(error?.stderr).includes("unable to find utility"), output: error?.stdout || "" };
  }
}

const [adb, xctrace, display] = await Promise.all([
  inspectCommand("adb", ["devices", "-l"]),
  inspectCommand("xcrun", ["xctrace", "list", "devices"]),
  inspectCommand("system_profiler", ["SPDisplaysDataType"])
]);
const report = {
  generatedAt: new Date().toISOString(),
  ...assessPhysicalQualityCaptureReadiness({
    adbAvailable: adb.available,
    xctraceAvailable: xctrace.available,
    androidDevices: parseAdbDevices(adb.output),
    iosDevices: parseXctraceDevices(xctrace.output),
    hostDisplays: parseDisplays(display.output)
  })
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`실기기 증빙 준비 상태: ${report.status} · 필요 증빙 ${report.requiredArtifactCount}개`);
for (const issue of report.issues) console.log(`- ${issue}`);
console.log(`보고서: ${outputPath}`);
if (process.argv.includes("--require-ready") && report.status !== "ready") process.exitCode = 1;
