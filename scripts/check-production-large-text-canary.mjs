import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLargeTextAccessibilityAudit } from "./lib/mobileHudBrowserAudit.mjs";

const defaultUrl = "https://po-mato.github.io/pixel-garden-invitation/";

export function buildPublicCanaryUrl(rawUrl, expectedSha = "") {
  const url = new URL(rawUrl);
  if (!/^https:$/.test(url.protocol)) throw new TypeError("공개 카나리 URL은 HTTPS여야 합니다.");
  if (expectedSha) url.searchParams.set("canary", expectedSha);
  return url.toString();
}

export function parsePublicCanaryArguments(args) {
  const read = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    url: read("--url") ?? defaultUrl,
    expectedSha: read("--expected-sha") ?? "",
    outputDir: read("--output") ?? path.resolve(".superpowers/visual-regression/production-large-text-canary")
  };
}

export async function waitForPublicCanary(url, { attempts = 12, intervalMs = 5_000 } = {}) {
  let latestError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "cache-control": "no-cache" }, redirect: "follow" });
      const html = await response.text();
      if (response.ok && /<div\s+id=["']root["']/.test(html)) return { attempt, status: response.status };
      latestError = new Error(`HTTP ${response.status} 또는 앱 root 누락`);
    } catch (error) {
      latestError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`공개 Pages 준비 확인 실패: ${latestError instanceof Error ? latestError.message : String(latestError)}`);
}

export async function runProductionLargeTextCanary({ url, expectedSha = "", outputDir }) {
  const publicUrl = buildPublicCanaryUrl(url, expectedSha);
  await mkdir(outputDir, { recursive: true });
  const readiness = await waitForPublicCanary(publicUrl);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const audit = await runLargeTextAccessibilityAudit({ browser, url: publicUrl, outputDir });
    const report = {
      generatedAt: new Date().toISOString(),
      publicUrl,
      expectedSha: expectedSha || null,
      readiness,
      ...audit
    };
    const reportPath = path.join(outputDir, "production-large-text-canary-report.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (audit.issues.length > 0) {
      throw new Error(`공개 URL 큰 글자 카나리 실패:\n${audit.issues.join("\n")}`);
    }
    return { ...report, reportPath };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = parsePublicCanaryArguments(process.argv.slice(2));
  const result = await runProductionLargeTextCanary(input);
  console.log(`공개 URL 큰 글자 카나리 통과: ${result.reports.length}개 프로필`);
  for (const report of result.reports) {
    console.log(`- ${report.id}: ${report.width}x${report.height} · 200% · 포커스 순환/복원 정상`);
  }
  console.log(`보고서: ${result.reportPath}`);
}
