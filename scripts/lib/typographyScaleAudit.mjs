import path from "node:path";

export const typographyScaleAuditProfiles = Object.freeze([
  { id: "text-100", percent: 100, requiredScroll: 0 },
  { id: "text-150", percent: 150, requiredScroll: 40 },
  { id: "text-200", percent: 200, requiredScroll: 160 }
]);

function profileIssues(report) {
  const issues = [];
  if (!report.sheetContained) issues.push(`${report.id}: 바텀시트 화면 이탈`);
  if (!report.horizontalContentContained) issues.push(`${report.id}: 콘텐츠 가로 넘침`);
  if (!report.cardsContained) issues.push(`${report.id}: 카드 내부 콘텐츠 넘침`);
  if (!report.cardsSeparated) issues.push(`${report.id}: 카드 세로 겹침`);
  if (!report.lineHeightReady) issues.push(`${report.id}: 본문 줄높이 부족`);
  if (!report.touchTargetsReady) issues.push(`${report.id}: 터치 영역 부족`);
  if (report.maxScroll < report.requiredScroll) issues.push(`${report.id}: 필요한 스크롤 범위 부족`);
  for (const [state, scroll] of Object.entries(report.scrollStates ?? {})) {
    if (!scroll.reached) issues.push(`${report.id}/${state}: 스크롤 위치 도달 실패`);
  }
  return issues;
}

export function auditTypographyScaleReports(reports) {
  const issues = [];
  const expectedIds = typographyScaleAuditProfiles.map(({ id }) => id);
  const actualIds = reports.map(({ id }) => id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    issues.push("글자 확대 프로필 목록 불일치");
  }
  reports.forEach((report) => issues.push(...profileIssues(report)));
  for (let index = 1; index < reports.length; index += 1) {
    const previous = reports[index - 1];
    const current = reports[index];
    if (current.bodyFontSize < previous.bodyFontSize - 0.5) {
      issues.push(`${previous.id}/${current.id}: 본문 글자 크기 역전`);
    }
    if (current.sheetScrollHeight < previous.sheetScrollHeight - 1) {
      issues.push(`${previous.id}/${current.id}: 시트 콘텐츠 높이 역전`);
    }
    for (const [cardId, previousHeight] of Object.entries(previous.cardHeights ?? {})) {
      const currentHeight = current.cardHeights?.[cardId];
      if (!Number.isFinite(currentHeight)) {
        issues.push(`${current.id}/${cardId}: 카드 높이 측정 누락`);
      } else if (currentHeight < previousHeight - 1) {
        issues.push(`${previous.id}/${current.id}/${cardId}: 카드 높이 역전`);
      }
    }
  }
  return issues;
}

function scaleCss(percent) {
  return `
    html[data-typography-audit] {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    html[data-typography-audit] .bottom-sheet {
      width: min(calc(100% - 16px), 420px);
      max-height: calc(100dvh - 12px - env(safe-area-inset-top));
      padding: 14px;
    }
    html[data-typography-audit] .bottom-sheet__header { align-items: flex-start; }
    html[data-typography-audit] .bottom-sheet__body { font-size: ${percent}%; }
    html[data-typography-audit] .bottom-sheet__body :is(p, li, a, button, label, dt, dd, time, span, strong) {
      font-size: 1em;
      line-height: 1.55;
    }
    html[data-typography-audit] .directions-sheet__venue,
    html[data-typography-audit] .directions-sheet__phone {
      grid-template-columns: var(--directions-icon-column) minmax(0, 1fr);
    }
    html[data-typography-audit] :is(.directions-sheet__venue > button, .directions-sheet__phone > a) {
      grid-column: 1 / -1;
      width: 100%;
      min-height: 48px;
    }
    html[data-typography-audit] .directions-sheet__maps {
      grid-template-columns: minmax(0, 1fr);
    }
  `;
}

export async function runTypographyScaleAudit({ browser, url, outputDir }) {
  const reports = [];
  for (const profile of typographyScaleAuditProfiles) {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
      isMobile: true,
      locale: "ko-KR",
      colorScheme: "light",
      reducedMotion: "reduce",
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
        version: 1,
        nickname: "글자확대감사",
        appearance: { presetId: "feminine-long-wave-dress" },
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
        version: 1,
        completed: true,
        completedAt: new Date().toISOString()
      }));
      localStorage.setItem("wedding-game:world-session:v1", JSON.stringify({
        version: 1,
        zoneId: "home",
        position: { x: 285, y: 555 },
        direction: "down",
        guideCheckpointId: null,
        updatedAt: new Date().toISOString()
      }));
    });
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      const resume = page.locator(".entry-screen__resume-access");
      if (await resume.isVisible().catch(() => false)) await resume.click();
      await page.locator(".game-world").waitFor({ state: "visible" });
      await page.locator(".world-map__stage--background-loaded").waitFor({ state: "visible", timeout: 15_000 });
      await page.addStyleTag({ content: scaleCss(profile.percent) });
      await page.evaluate(() => { document.documentElement.dataset.typographyAudit = "true"; });
      await page.locator(".world-menu-button").click();
      await page.locator(".world-menu-sheet").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "오시는 길", exact: true }).click();
      const sheet = page.locator(".bottom-sheet");
      await sheet.waitFor({ state: "visible" });
      const sheetScroller = sheet.locator(".bottom-sheet__body");
      await page.evaluate(() => document.fonts.ready);
      await sheetScroller.evaluate((element) => { element.scrollTop = 0; });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(({ width, height }) => {
        const sheetElement = document.querySelector(".bottom-sheet");
        const body = document.querySelector(".bottom-sheet__body");
        if (!(sheetElement instanceof HTMLElement) || !(body instanceof HTMLElement)) {
          throw new Error("Typography audit sheet missing");
        }
        const rectValue = (element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
        };
        const cards = [
          ...body.querySelectorAll(".directions-sheet__venue, .directions-sheet__maps, .directions-sheet__info, .directions-sheet__phone")
        ].filter((element) => element instanceof HTMLElement);
        const cardReports = cards.map((card, index) => {
          const classId = [...card.classList].find((name) => name.startsWith("directions-sheet__")) ?? "card";
          const repeated = cards.slice(0, index).filter((candidate) => candidate.classList.contains(classId)).length;
          const id = `${classId}-${repeated}`;
          const rect = rectValue(card);
          const children = [...card.children].filter((element) => element instanceof HTMLElement).map(rectValue);
          return {
            id,
            rect,
            contentContained:
              card.scrollWidth <= card.clientWidth + 1
              && children.every((child) => child.x >= rect.x - 1 && child.right <= rect.right + 1)
          };
        });
        const textMetrics = [...body.querySelectorAll("p, li, a, button, dt, dd, span, strong")]
          .filter((element) => element instanceof HTMLElement && element.textContent?.trim())
          .map((element) => {
            const style = getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight);
            return { fontSize, lineHeight, ratio: lineHeight / fontSize };
          });
        const controls = [...sheetElement.querySelectorAll("button, a[href]")]
          .filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== "none");
        const sheetRect = rectValue(sheetElement);
        return {
          sheetRect,
          sheetContained:
            sheetRect.x >= -1 && sheetRect.y >= -1
            && sheetRect.right <= width + 1 && sheetRect.bottom <= height + 1,
          horizontalContentContained: sheetElement.scrollWidth <= sheetElement.clientWidth + 1,
          cardsContained: cardReports.length > 0 && cardReports.every(({ contentContained }) => contentContained),
          cardsSeparated: cardReports.every((card, index) => (
            index === 0 || card.rect.y >= cardReports[index - 1].rect.bottom - 1
          )),
          lineHeightReady: textMetrics.length > 0 && textMetrics.every(({ ratio }) => Number.isFinite(ratio) && ratio >= 1.2),
          minimumLineHeightRatio: Math.min(...textMetrics.map(({ ratio }) => ratio)),
          touchTargetsReady: controls.length > 0 && controls.every((element) => element.getBoundingClientRect().height >= 43),
          bodyFontSize: parseFloat(getComputedStyle(body).fontSize),
          sheetScrollHeight: body.scrollHeight,
          sheetClientHeight: body.clientHeight,
          maxScroll: Math.max(0, body.scrollHeight - body.clientHeight),
          cardHeights: Object.fromEntries(cardReports.map(({ id, rect }) => [id, rect.height])),
          cardReports
        };
      }, { width: 393, height: 852 });
      const scrollStates = {};
      for (const [state, ratio] of [["top", 0], ["middle", 0.5], ["bottom", 1]]) {
        const scroll = await sheetScroller.evaluate((element, targetRatio) => {
          const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
          const target = Math.round(maxScroll * targetRatio);
          element.scrollTop = target;
          return { scrollTop: element.scrollTop, maxScroll, target, reached: Math.abs(element.scrollTop - target) <= 2 };
        }, ratio);
        scrollStates[state] = scroll;
      }
      await sheetScroller.evaluate((element) => { element.scrollTop = 0; });
      const screenshotPath = path.join(outputDir, `typography-scale-${profile.percent}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false, scale: "css" });
      reports.push({ ...profile, ...metrics, scrollStates, screenshotPath });
    } finally {
      await context.close();
    }
  }
  return { reports, issues: auditTypographyScaleReports(reports), profiles: typographyScaleAuditProfiles };
}
