import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(rootDir, ".superpowers/world-layout-audit-build");
const approve = process.argv.includes("--approve");

await rm(buildDir, { recursive: true, force: true });
const build = spawnSync("pnpm", [
  "--filter", "@wedding-game/client", "exec", "vite", "build",
  "--ssr", "../scripts/lib/worldLayoutVisualAuditEntry.ts",
  "--outDir", "../.superpowers/world-layout-audit-build",
  "--emptyOutDir"
], { cwd: rootDir, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const run = spawnSync("node", [
  path.join(buildDir, "worldLayoutVisualAuditEntry.js"),
  ...(approve ? ["--approve"] : [])
], { cwd: rootDir, stdio: "inherit" });
await rm(buildDir, { recursive: true, force: true });
if (run.status !== 0) process.exit(run.status ?? 1);
