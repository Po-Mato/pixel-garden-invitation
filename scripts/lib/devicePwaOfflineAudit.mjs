import { auditPwaCleanInstallCanary } from "./pwaCleanInstallCanary.mjs";

export function auditDevicePwaOffline(snapshot) {
  const issues = auditPwaCleanInstallCanary(snapshot);
  if (!snapshot.cleanInstallReady) issues.push("기존 서비스 워커·캐시 초기화 실패");
  if (!snapshot.previewHostUnavailable) issues.push("오프라인 전환 전 프리뷰 서버 종료 실패");
  if (snapshot.brokenImages.length > 0) issues.push(`오프라인 이미지 손상 ${snapshot.brokenImages.join(" | ")}`);
  return issues;
}

async function waitForPreviewExit(pid, previewHostUrl, timeoutMs = 12_000) {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error("PWA_PREVIEW_PID가 유효하지 않습니다.");
  process.kill(pid, "SIGTERM");
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    let processAlive = true;
    try {
      process.kill(pid, 0);
    } catch {
      processAlive = false;
    }
    let hostAlive = false;
    try {
      hostAlive = (await fetch(previewHostUrl, { cache: "no-store" })).ok;
    } catch {
      hostAlive = false;
    }
    if (!processAlive && !hostAlive) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

export async function runDevicePwaOfflineAudit({
  platform,
  url,
  previewHostUrl,
  previewPid,
  expectedPaths,
  navigate,
  evaluate,
  waitForDocument,
  screenshot
}) {
  await navigate(url);
  await waitForDocument("document.readyState === 'complete'", `${platform} PWA 초기 문서`);
  await evaluate(`
    window.__devicePwaCleanup = { complete: false, registrations: -1, caches: -1 };
    Promise.all([
      navigator.serviceWorker?.getRegistrations?.().then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return registrations.length;
      }) ?? Promise.resolve(0),
      caches.keys().then(async (names) => {
        await Promise.all(names.map((name) => caches.delete(name)));
        return names.length;
      })
    ]).then(([registrations, cachesRemoved]) => {
      localStorage.clear();
      sessionStorage.clear();
      window.__devicePwaCleanup = { complete: true, registrations, caches: cachesRemoved };
    }).catch((error) => {
      window.__devicePwaCleanup = { complete: true, error: String(error), registrations: -1, caches: -1 };
    });
    return true;
  `);
  await waitForDocument("window.__devicePwaCleanup?.complete === true", `${platform} PWA 저장소 초기화`);
  const cleanup = await evaluate(`return window.__devicePwaCleanup;`);

  await navigate(url);
  await waitForDocument("document.querySelector('.entry-screen')", `${platform} PWA 클린 진입 화면`, 60_000);
  await evaluate(`
    window.__devicePwaCacheSnapshot = null;
    window.__devicePwaCacheProbe = window.setInterval(async () => {
      try {
        const paths = ${JSON.stringify(expectedPaths)};
        const registration = await navigator.serviceWorker?.getRegistration?.();
        const names = await caches.keys();
        const precacheName = names.find((name) => name.startsWith("wedding-garden-precache-")) ?? null;
        const cachedUrls = precacheName
          ? new Set((await (await caches.open(precacheName)).keys()).map((request) => request.url))
          : new Set();
        const scope = registration?.scope ?? location.href;
        window.__devicePwaCacheSnapshot = {
          serviceWorkerSupported: "serviceWorker" in navigator,
          controlled: Boolean(navigator.serviceWorker?.controller),
          precacheName,
          cachedPaths: paths.filter((resourcePath) => cachedUrls.has(new URL(resourcePath, scope).href)).length,
          expectedPaths: paths.length
        };
      } catch (error) {
        window.__devicePwaCacheSnapshot = { error: String(error), cachedPaths: 0, expectedPaths: ${expectedPaths.length} };
      }
    }, 120);
    return true;
  `);
  await waitForDocument(`
    window.__devicePwaCacheSnapshot?.controlled === true
      && window.__devicePwaCacheSnapshot?.cachedPaths === ${expectedPaths.length}
  `, `${platform} PWA 프리캐시`, 60_000);
  const onlineCache = await evaluate(`return window.__devicePwaCacheSnapshot;`);
  await evaluate(`
    clearInterval(window.__devicePwaCacheProbe);
    localStorage.setItem("wedding-game:entry-session:v1", JSON.stringify({
      version: 1,
      nickname: ${JSON.stringify(`${platform} 오프라인감사`)},
      appearance: { presetId: "feminine-long-wave-dress" },
      updatedAt: new Date().toISOString()
    }));
    localStorage.setItem("wedding-game:first-visit-guide:v1", JSON.stringify({
      version: 1,
      completed: true,
      completedAt: new Date().toISOString()
    }));
    return true;
  `);

  const previewHostUnavailable = await waitForPreviewExit(previewPid, previewHostUrl);
  if (!previewHostUnavailable) throw new Error(`${platform} PWA 프리뷰 서버가 종료되지 않았습니다.`);
  await navigate(url);
  await waitForDocument("document.querySelector('.entry-screen')", `${platform} 오프라인 진입 화면`, 60_000);
  await evaluate(`window.dispatchEvent(new Event("offline")); return true;`);
  await waitForDocument("document.querySelector('.entry-screen__resume-access')", `${platform} 오프라인 이어하기`);
  await evaluate(`document.querySelector(".entry-screen__resume-access")?.click(); return true;`);
  await waitForDocument("document.querySelector('.game-world')", `${platform} 오프라인 게임 화면`, 30_000);
  await waitForDocument("document.querySelector('.world-map__stage--background-loaded')", `${platform} 오프라인 홈 맵`, 60_000);
  await waitForDocument("document.fonts.status === 'loaded'", `${platform} 오프라인 한글 폰트`, 30_000);
  const offline = await evaluate(`
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const brokenImages = [...document.images]
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => new URL(image.currentSrc || image.src, location.href).pathname);
    return {
      offlineEntryVisible: true,
      offlineStatusVisible: [...document.querySelectorAll(".pwa-status")].some((element) => element.textContent?.includes("오프라인 모드")),
      resumeVisible: true,
      offlineGameVisible: visible(".game-world") && visible(".world-map__stage--background-loaded"),
      blockingNoticeVisible: visible(".pwa-status--notice") || visible(".pwa-status--error"),
      fallbackDocumentVisible: document.body.textContent?.includes("오프라인 초대장을 준비하지 못했습니다") ?? false,
      brokenImages: [...new Set(brokenImages)]
    };
  `);
  await screenshot("pwa-clean-install-offline");
  const snapshot = {
    platform,
    cleanInstallReady: cleanup.complete === true && !cleanup.error,
    previewHostUnavailable,
    ...onlineCache,
    ...offline,
    criticalAssetFailures: offline.brokenImages,
    pageErrors: []
  };
  const issues = auditDevicePwaOffline(snapshot);
  if (issues.length > 0) throw new Error(`${platform} device PWA offline audit failed:\n${issues.join("\n")}`);
  return { snapshot, issues };
}
