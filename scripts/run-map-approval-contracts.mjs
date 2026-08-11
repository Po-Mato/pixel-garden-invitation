import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMapApprovalContracts } from "./lib/mapApprovalContracts.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(
  rootDir,
  ".superpowers/visual-regression/map-approval-contracts-duration.json"
);

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: rootDir, env: process.env, stdio: "inherit" });
    child.on("error", () => resolve({ code: 1 }));
    child.on("exit", (code) => resolve({ code: Number.isInteger(code) ? code : 1 }));
  });
}

const report = await runMapApprovalContracts({ runCommand });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
console.log(`맵 승인 계약 병렬 실행: ${Math.round(report.durationMs / 1000)}초`
  + ` · 순차 환산 ${Math.round(report.sequentialDurationMs / 1000)}초`
  + ` · 절감 ${Math.round(report.savedMs / 1000)}초 · ${report.status}`);
if (report.status !== "passed") process.exitCode = 1;
