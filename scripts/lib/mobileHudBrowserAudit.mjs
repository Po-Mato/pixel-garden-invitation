import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const mobileHudAuditViewports = Object.freeze([
  { id: "iphone-portrait", width: 390, height: 844 },
  { id: "small-android", width: 360, height: 640 },
  { id: "phone-landscape", width: 844, height: 390 },
  { id: "tablet-portrait", width: 768, height: 1024 },
  { id: "tablet-landscape", width: 1024, height: 768 }
]);

const overlapPairs = [
  ["hud", "controls"],
  ["hud", "minimap"],
  ["hud", "context"],
  ["minimap", "controls"],
  ["minimap", "context"],
  ["collection", "controls"],
  ["collection", "context"],
  ["context", "controls"]
];

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

export function auditMobileHudRectangles(rectangles, viewport, overlapTolerance = 36) {
  const issues = [];
  for (const [name, rect] of Object.entries(rectangles)) {
    if (!rect) continue;
    if (
      rect.x < -1
      || rect.y < -1
      || rect.x + rect.width > viewport.width + 1
      || rect.y + rect.height > viewport.height + 1
    ) issues.push(`${name} 화면 이탈`);
  }
  for (const [leftName, rightName] of overlapPairs) {
    const left = rectangles[leftName];
    const right = rectangles[rightName];
    if (left && right && overlapArea(left, right) > overlapTolerance) {
      issues.push(`${leftName}/${rightName} 겹침`);
    }
  }
  return issues;
}

async function waitForServer(url, process, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) throw new Error(`Vite exited before audit: ${process.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The development server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the mobile HUD audit server");
}

async function visibleRectangles(page) {
  return page.evaluate(() => {
    const selectors = {
      hud: ".world-hud",
      minimap: ".world-minimap",
      collection: ".world-collection-progress",
      context: ".world-context-action",
      controls: ".world-control-dock"
    };
    return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return [name, null];
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [name, null];
      const rect = element.getBoundingClientRect();
      return [name, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
    }));
  });
}

async function measureJoystickTouchResponse(page, context) {
  const box = await page.locator(".virtual-joystick").boundingBox();
  if (!box) return { latencyMs: null, responded: false };
  const x = box.x + box.width - 4;
  const y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  const startedAt = performance.now();
  let responded = false;
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }]
    });
    await page.waitForFunction(() => (
      document.querySelector(".virtual-joystick__thumb")?.style.getPropertyValue("--joystick-x").trim() === "1"
    ), undefined, { timeout: 500 });
    responded = true;
  } catch {
    responded = false;
  } finally {
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }).catch(() => undefined);
    await session.detach().catch(() => undefined);
  }
  return { latencyMs: Math.round((performance.now() - startedAt) * 10) / 10, responded };
}

export async function runMobileHudBrowserAudit({ rootDir, outputDir, port = 4178 }) {
  const server = spawn(
    "pnpm",
    ["--filter", "@wedding-game/client", "exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: rootDir, env: { ...process.env, BROWSER: "none" }, stdio: "pipe" }
  );
  const url = `http://127.0.0.1:${port}/`;
  await mkdir(outputDir, { recursive: true });
  try {
    await waitForServer(url, server);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const reports = [];
    try {
      for (const viewport of mobileHudAuditViewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          hasTouch: true,
          isMobile: true,
          deviceScaleFactor: viewport.id.startsWith("tablet") ? 1.5 : 2
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
            version: 1,
            nickname: "화면감사",
            appearance: { presetId: "feminine-long-wave-dress" },
            updatedAt: new Date().toISOString()
          }));
          localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
            version: 1,
            completed: true,
            completedAt: new Date().toISOString()
          }));
        });
        await page.goto(url, { waitUntil: "networkidle" });
        await page.locator(".game-world").waitFor({ state: "visible" });
        await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
        const rectangles = await visibleRectangles(page);
        const issues = auditMobileHudRectangles(rectangles, viewport);
        const touchResponse = await measureJoystickTouchResponse(page, context);
        if (!touchResponse.responded) issues.push("joystick 터치 무응답");
        if (touchResponse.latencyMs !== null && touchResponse.latencyMs > 120) issues.push(`joystick 터치 지연 ${touchResponse.latencyMs}ms`);
        const screenshotPath = path.join(outputDir, `mobile-hud-${viewport.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        await page.locator(".world-hud__tools-toggle").click();
        const toolsPanel = page.locator(".world-hud__tools");
        await toolsPanel.waitFor({ state: "visible" });
        const toolsRect = await toolsPanel.boundingBox();
        if (
          !toolsRect
          || toolsRect.x < -1
          || toolsRect.y < -1
          || toolsRect.x + toolsRect.width > viewport.width + 1
          || toolsRect.y + toolsRect.height > viewport.height + 1
        ) issues.push("expanded-tools 화면 이탈");
        const toolsScreenshotPath = path.join(outputDir, `mobile-hud-${viewport.id}-tools.png`);
        await page.screenshot({ path: toolsScreenshotPath, fullPage: false });
        reports.push({ ...viewport, rectangles, toolsRect, touchResponse, issues, screenshotPath, toolsScreenshotPath });
        await context.close();
      }
    } finally {
      await browser.close();
    }
    const reportPath = path.join(outputDir, "mobile-hud-browser-report.json");
    await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
    const issues = reports.flatMap((report) => report.issues.map((issue) => `${report.id}: ${issue}`));
    if (issues.length > 0) throw new Error(`Mobile HUD browser audit failed:\n${issues.join("\n")}`);
    return { reports, reportPath };
  } finally {
    server.kill("SIGTERM");
  }
}
