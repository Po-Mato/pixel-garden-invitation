import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  probeQualityRuntime,
  validateQualityBuildPackage,
  withStaticQualityServer
} from "./lib/qualityBuildContract.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const mode = option("--mode", "package");
const variant = option("--variant", "production");
const expectedSha = option("--expected-sha", process.env.GITHUB_SHA ?? "local");
const packageDir = path.resolve(option("--package-dir", path.join(rootDir, ".quality-build")));
const outputDir = path.resolve(option(
  "--output-dir",
  path.join(rootDir, ".superpowers/visual-regression/quality-build-contract")
));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : entry.isFile() ? [entryPath] : [];
  }));
  return nested.flat();
}

async function waitForUrl(url, child, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`runtime server exited: ${child.exitCode}`);
    if (await fetch(url).then((response) => response.ok, () => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`runtime server timeout: ${url}`);
}

async function withViteServer(args, baseUrl, callback) {
  const child = spawn("pnpm", ["--filter", "@wedding-game/client", "exec", "vite", ...args], {
    cwd: rootDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  try {
    await waitForUrl(baseUrl, child);
    return await callback();
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output.slice(-4_000)}`);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 3_000);
    });
  }
}

async function packageAudit() {
  const contract = await validateQualityBuildPackage({ packageDir, expectedSha });
  const probes = {};
  for (const candidate of contract.manifest.variants) {
    probes[candidate] = await withStaticQualityServer(path.join(packageDir, candidate), (baseUrl) => (
      probeQualityRuntime({
        baseUrl,
        generatedPaths: contract.generated.map(({ logicalPath }) => logicalPath),
        requireServiceWorker: true
      })
    ));
  }
  return {
    mode,
    expectedSha,
    variants: contract.variants,
    generatedAssets: contract.generated.length,
    probes
  };
}

async function restoredAudit() {
  const generatedDir = path.join(rootDir, "client/public/characters/generated");
  const generatedPaths = (await filesBelow(generatedDir)).map((filePath) => (
    path.relative(generatedDir, filePath).split(path.sep).join("/")
  )).sort();
  if (generatedPaths.length === 0) throw new Error("복원된 generated 캐릭터가 비어 있습니다.");
  for (const required of ["index.html", "manifest.webmanifest", "service-worker.js"]) {
    await stat(path.join(rootDir, "client/dist", required));
  }
  for (const generatedPath of generatedPaths) await stat(path.join(rootDir, "client/dist/characters/generated", generatedPath));
  const devPort = 4196;
  const previewPort = 4197;
  const devUrl = `http://127.0.0.1:${devPort}/`;
  const previewUrl = `http://127.0.0.1:${previewPort}/`;
  const dev = await withViteServer(
    ["--host", "127.0.0.1", "--port", String(devPort), "--strictPort"],
    devUrl,
    () => probeQualityRuntime({ baseUrl: devUrl, generatedPaths, requireServiceWorker: false })
  );
  const preview = await withViteServer(
    ["preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"],
    previewUrl,
    () => probeQualityRuntime({ baseUrl: previewUrl, generatedPaths, requireServiceWorker: true })
  );
  return { mode, variant, expectedSha, generatedAssets: generatedPaths.length, dev, preview };
}

if (!["package", "restored"].includes(mode)) throw new Error(`알 수 없는 공통 빌드 계약 모드: ${mode}`);
const startedAt = Date.now();
const result = mode === "package" ? await packageAudit() : await restoredAudit();
const report = { generatedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, status: "passed", ...result };
await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `quality-build-contract-${mode}-${variant}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`공통 빌드 런타임 계약 통과: ${mode}/${variant} · generated ${report.generatedAssets}개 · ${report.durationMs}ms`);
console.log(`보고서: ${reportPath}`);
