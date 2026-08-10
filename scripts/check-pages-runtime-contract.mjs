import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePwaPrecachePaths } from "./lib/gameResourceBudget.mjs";
import {
  auditPagesRuntimeContract,
  buildPagesRuntimeContractSnapshot,
  formatPagesRuntimeContractMarkdown,
  pagesRuntimeContractPolicy
} from "./lib/pagesRuntimeContract.mjs";
import { parseServiceWorkerVersion } from "./lib/productionNetworkPwaCanary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const baseUrl = new URL(option("--url", "https://po-mato.github.io/pixel-garden-invitation/"));
if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
const expectedSha = option("--expected-sha", process.env.GITHUB_SHA);
if (!expectedSha) throw new Error("Pages 운영 계약에 expected SHA가 필요합니다.");
const expectedVersion = expectedSha.slice(0, 12);
const outputDir = path.resolve(option(
  "--output-dir",
  path.join(rootDir, ".superpowers/visual-regression/production-network-pwa-canary")
));

async function fetchNoStore(url) {
  return fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" }, redirect: "follow" });
}

let workerResponse;
let workerSource = "";
for (let attempt = 1; attempt <= 18; attempt += 1) {
  const workerUrl = new URL("service-worker.js", baseUrl);
  workerUrl.searchParams.set("quality-pages-contract", `${Date.now()}-${attempt}`);
  workerResponse = await fetchNoStore(workerUrl);
  workerSource = workerResponse.ok ? await workerResponse.text() : "";
  if (workerResponse.ok && parseServiceWorkerVersion(workerSource) === expectedVersion) break;
  if (attempt === 18) throw new Error(`Pages service worker 배포 대기 실패: ${workerResponse.status}`);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
const [entryResponse, manifestResponse] = await Promise.all([
  fetchNoStore(baseUrl),
  fetchNoStore(new URL("manifest.webmanifest", baseUrl))
]);
const [indexHtml, manifest] = await Promise.all([
  entryResponse.text(),
  manifestResponse.json()
]);
const expectedPaths = [...new Set([
  ...parsePwaPrecachePaths(workerSource),
  ...pagesRuntimeContractPolicy.criticalRuntimePaths
])];
const probes = await Promise.all(expectedPaths.map(async (resourcePath) => {
  const requestedUrl = new URL(resourcePath, baseUrl);
  try {
    const response = await fetchNoStore(requestedUrl);
    if (response.ok) await response.arrayBuffer();
    const finalUrl = response.url || requestedUrl.href;
    return {
      path: resourcePath,
      status: response.status,
      finalUrl,
      withinBase: new URL(finalUrl).origin === baseUrl.origin && new URL(finalUrl).pathname.startsWith(baseUrl.pathname)
    };
  } catch (error) {
    return { path: resourcePath, status: 0, finalUrl: requestedUrl.href, withinBase: true, error: String(error) };
  }
}));
const snapshot = buildPagesRuntimeContractSnapshot({
  baseUrl: baseUrl.href,
  expectedBasePath: option("--expected-base-path", pagesRuntimeContractPolicy.expectedBasePath),
  expectedSha,
  entryStatus: entryResponse.status,
  entryFinalUrl: entryResponse.url,
  indexHtml,
  manifestStatus: manifestResponse.status,
  manifestFinalUrl: manifestResponse.url,
  manifest,
  workerStatus: workerResponse.status,
  workerFinalUrl: workerResponse.url,
  workerSource,
  serviceWorkerAllowed: workerResponse.headers.get("service-worker-allowed"),
  probes
});
const issues = auditPagesRuntimeContract(snapshot);
const report = { ...snapshot, status: issues.length === 0 ? "passed" : "failed", issues };
const markdown = formatPagesRuntimeContractMarkdown(report);
await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "pages-runtime-contract-report.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(outputDir, "pages-runtime-contract-report.md"), markdown)
]);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
console.log(`GitHub Pages 운영 복원 계약: ${report.status} · ${probes.length}/${expectedPaths.length}`);
if (issues.length > 0) {
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exitCode = 1;
}
