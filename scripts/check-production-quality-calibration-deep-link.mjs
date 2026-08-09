import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessQualityCalibrationDeepLinkCanary,
  qualityCalibrationDeepLinkCanaryPolicy,
  qualityCalibrationDeepLinkUrl
} from "./lib/qualityCalibrationDeepLinkCanary.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const baseUrl = option("--url", "https://po-mato.github.io/pixel-garden-invitation/");
const outputDir = path.resolve(option(
  "--output-dir",
  path.join(rootDir, ".superpowers/visual-regression/production-quality-calibration-deep-link")
));
const requireAuth = process.argv.includes("--require-auth");
const reportPath = path.join(outputDir, "production-quality-calibration-deep-link-report.json");
const screenshotPath = path.join(outputDir, "quality-calibration-deep-link.png");
const password = process.env.RSVP_ADMIN_E2E_PASSWORD;

await mkdir(outputDir, { recursive: true });
if (!password) {
  const report = {
    generatedAt: new Date().toISOString(),
    status: "blocked",
    publicUrl: baseUrl,
    secretName: "RSVP_ADMIN_E2E_PASSWORD",
    secretsRedacted: true,
    issues: ["GitHub Actions 또는 로컬 환경에 운영 관리자 E2E 비밀번호가 설정되지 않음"]
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`품질 보정 운영 딥링크 E2E: ${report.status}`);
  console.log(`- ${report.issues[0]}`);
  console.log(`보고서: ${reportPath}`);
  if (requireAuth) process.exitCode = 1;
} else {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const responseStatuses = { session: null, analytics: [] };
  let target = null;
  let state = { deepLinked: false, focused: false, visible: false };
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.endsWith(qualityCalibrationDeepLinkCanaryPolicy.sessionEndpointSuffix)) {
        responseStatuses.session = response.status();
      }
      if (pathname.endsWith(qualityCalibrationDeepLinkCanaryPolicy.analyticsEndpointSuffix)) {
        responseStatuses.analytics.push(response.status());
      }
    });
    const loginUrl = new URL(baseUrl);
    loginUrl.searchParams.set("admin", "analytics");
    await page.goto(loginUrl.toString(), { waitUntil: "load" });
    await page.getByLabel("관리자 비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    const card = page.locator(
      ".analytics-quality-calibration__current article[data-calibration-week][data-calibration-metric]"
    ).first();
    await card.waitFor({ state: "visible" });
    target = await card.evaluate((element) => ({
      weekStart: element.getAttribute("data-calibration-week"),
      metricKey: element.getAttribute("data-calibration-metric")
    }));
    if (!target.weekStart || !target.metricKey) throw new Error("Calibration target attributes missing");
    await page.goto(qualityCalibrationDeepLinkUrl(baseUrl, target), { waitUntil: "load" });
    const selector = `.analytics-quality-calibration__current article[data-calibration-week="${target.weekStart}"][data-calibration-metric="${target.metricKey}"][data-deep-linked="true"]`;
    const linkedCard = page.locator(selector);
    await linkedCard.waitFor({ state: "visible" });
    await page.waitForFunction((cardSelector) => document.activeElement === document.querySelector(cardSelector), selector);
    await page.waitForFunction((cardSelector) => {
      const element = document.querySelector(cardSelector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
    }, selector);
    state = await linkedCard.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        deepLinked: element.getAttribute("data-deep-linked") === "true",
        focused: document.activeElement === element,
        visible: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth
      };
    });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await context.close();
  } catch (error) {
    pageErrors.push(String(error?.message || error));
  } finally {
    await browser.close();
  }
  const assessment = assessQualityCalibrationDeepLinkCanary({
    sessionStatus: responseStatuses.session,
    analyticsStatuses: responseStatuses.analytics,
    target,
    ...state,
    pageErrors
  });
  const report = {
    generatedAt: new Date().toISOString(),
    publicUrl: baseUrl,
    target,
    network: responseStatuses,
    ...state,
    secretsRedacted: true,
    ...assessment
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`품질 보정 운영 딥링크 E2E: ${report.status}`);
  for (const issue of report.issues) console.log(`- ${issue}`);
  console.log(`보고서: ${reportPath}`);
  if (report.status !== "passed") process.exitCode = 1;
}
