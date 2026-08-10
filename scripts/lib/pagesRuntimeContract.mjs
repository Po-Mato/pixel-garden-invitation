import { parsePwaFeaturePaths, parsePwaPrecachePaths } from "./gameResourceBudget.mjs";
import { parseServiceWorkerVersion } from "./productionNetworkPwaCanary.mjs";

export const pagesRuntimeContractPolicy = Object.freeze({
  expectedBasePath: "/pixel-garden-invitation/",
  requiredManifestFields: ["id", "start_url", "scope"],
  criticalRuntimePaths: [
    "./assets/maps/v2/home/background.webp",
    "./characters/generated/npc/bride__walk.png",
    "./characters/generated/npc/groom__walk.png",
    "./characters/generated/guests/feminine-long-wave-dress__idle.png"
  ]
});

function normalizedBaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new TypeError("Pages 운영 계약 URL은 HTTPS여야 합니다.");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url;
}

function withinBase(rawUrl, baseUrl) {
  const url = new URL(rawUrl, baseUrl);
  return url.origin === baseUrl.origin && url.pathname.startsWith(baseUrl.pathname);
}

export function extractHtmlRuntimeReferences(html) {
  const references = [];
  for (const match of String(html).matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    const value = match[1];
    if (!value || /^(?:data:|mailto:|tel:|#)/i.test(value)) continue;
    references.push(value);
  }
  return [...new Set(references)];
}

export function buildPagesRuntimeContractSnapshot(input = {}) {
  const baseUrl = normalizedBaseUrl(input.baseUrl);
  const workerSource = String(input.workerSource ?? "");
  const manifest = input.manifest ?? {};
  const precachePaths = parsePwaPrecachePaths(workerSource);
  const featurePaths = parsePwaFeaturePaths(workerSource);
  const htmlReferences = extractHtmlRuntimeReferences(input.indexHtml ?? "");
  const workerUrl = new URL("service-worker.js", baseUrl);
  const allowedScope = input.serviceWorkerAllowed
    ? new URL(input.serviceWorkerAllowed, workerUrl).href
    : new URL("./", workerUrl).href;
  const expectedPaths = [...new Set([
    ...precachePaths,
    ...pagesRuntimeContractPolicy.criticalRuntimePaths
  ])];
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    expectedSha: input.expectedSha ?? null,
    expectedVersion: input.expectedSha ? String(input.expectedSha).slice(0, 12) : null,
    deployedVersion: parseServiceWorkerVersion(workerSource),
    baseUrl: baseUrl.href,
    basePath: baseUrl.pathname,
    expectedBasePath: input.expectedBasePath ?? pagesRuntimeContractPolicy.expectedBasePath,
    entry: { status: Number(input.entryStatus) || 0, finalUrl: input.entryFinalUrl ?? baseUrl.href },
    manifest: {
      status: Number(input.manifestStatus) || 0,
      finalUrl: input.manifestFinalUrl ?? new URL("manifest.webmanifest", baseUrl).href,
      id: manifest.id ?? null,
      startUrl: manifest.start_url ?? null,
      scope: manifest.scope ?? null,
      resolvedId: manifest.id ? new URL(manifest.id, new URL("manifest.webmanifest", baseUrl)).href : null,
      resolvedStartUrl: manifest.start_url ? new URL(manifest.start_url, new URL("manifest.webmanifest", baseUrl)).href : null,
      resolvedScope: manifest.scope ? new URL(manifest.scope, new URL("manifest.webmanifest", baseUrl)).href : null
    },
    serviceWorker: {
      status: Number(input.workerStatus) || 0,
      finalUrl: input.workerFinalUrl ?? workerUrl.href,
      allowedScope,
      registrationScopeBound: /new URL\(path, self\.registration\.scope\)/.test(workerSource)
    },
    htmlReferences: htmlReferences.map((reference) => ({
      reference,
      resolvedUrl: new URL(reference, baseUrl).href,
      withinBase: withinBase(reference, baseUrl)
    })),
    assets: {
      precachePaths: precachePaths.length,
      featurePaths: featurePaths.length,
      expectedPaths: expectedPaths.length,
      outsideBasePaths: expectedPaths.filter((resourcePath) => !withinBase(resourcePath, baseUrl)),
      probes: input.probes ?? []
    }
  };
}

export function auditPagesRuntimeContract(snapshot) {
  const issues = [];
  const baseUrl = normalizedBaseUrl(snapshot.baseUrl);
  if (snapshot.basePath !== snapshot.expectedBasePath) {
    issues.push(`Pages base path ${snapshot.basePath}/${snapshot.expectedBasePath}`);
  }
  if (snapshot.entry.status !== 200) issues.push(`Pages entry HTTP ${snapshot.entry.status}`);
  if (!withinBase(snapshot.entry.finalUrl, baseUrl)) issues.push("Pages entry가 저장소 base path 밖으로 이동");
  if (snapshot.manifest.status !== 200) issues.push(`Pages manifest HTTP ${snapshot.manifest.status}`);
  for (const field of ["resolvedId", "resolvedStartUrl", "resolvedScope"]) {
    if (!snapshot.manifest[field] || snapshot.manifest[field] !== baseUrl.href) {
      issues.push(`Pages manifest ${field} ${snapshot.manifest[field] ?? "missing"}`);
    }
  }
  if (snapshot.serviceWorker.status !== 200) issues.push(`Pages service worker HTTP ${snapshot.serviceWorker.status}`);
  if (snapshot.expectedVersion !== snapshot.deployedVersion) issues.push("Pages service worker SHA 불일치");
  if (snapshot.serviceWorker.allowedScope !== baseUrl.href) issues.push(`Pages service worker 허용 scope ${snapshot.serviceWorker.allowedScope}`);
  if (!snapshot.serviceWorker.registrationScopeBound) issues.push("Pages service worker가 registration scope 기준 URL을 사용하지 않음");
  const escapedHtml = snapshot.htmlReferences.filter(({ withinBase: contained }) => !contained);
  if (escapedHtml.length > 0) issues.push(`Pages HTML base path 이탈 ${escapedHtml.length}개`);
  if (snapshot.assets.outsideBasePaths.length > 0) issues.push(`Pages PWA 자산 base path 이탈 ${snapshot.assets.outsideBasePaths.length}개`);
  const failedProbes = snapshot.assets.probes.filter(({ status, withinBase: contained }) => status !== 200 || contained !== true);
  if (failedProbes.length > 0) issues.push(`Pages 운영 자산 요청 실패 ${failedProbes.length}개`);
  if (snapshot.assets.probes.length !== snapshot.assets.expectedPaths) {
    issues.push(`Pages 운영 자산 검사 ${snapshot.assets.probes.length}/${snapshot.assets.expectedPaths}`);
  }
  return issues;
}

export function formatPagesRuntimeContractMarkdown(report) {
  return [
    "## GitHub Pages 운영 복원 계약",
    "",
    `- 상태: **${report.status}** · base path \`${report.basePath}\` · service worker \`${report.deployedVersion}\``,
    `- manifest id/start/scope: \`${report.manifest.resolvedScope}\``,
    `- 운영 자산: ${report.assets.probes.length}/${report.assets.expectedPaths} · core ${report.assets.precachePaths} · feature ${report.assets.featurePaths}`,
    ...report.issues.map((issue) => `- ${issue}`),
    ""
  ].join("\n");
}
