// Keep production visual/PWA canaries out of real visitor statistics without
// changing browser caching, service workers, or application collection behavior.
export function installSyntheticAnalyticsGuard() {
  if (globalThis.__weddingSyntheticAnalyticsGuard) return;
  globalThis.__weddingSyntheticAnalyticsGuard = true;
  const isAnalytics = (input) => {
    try {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
      return url.hostname === "wedding-game-invitation.happyugn.workers.dev"
        && (url.pathname === "/api/pages/visits"
          || /^\/api\/invitations\/[^/]+\/analytics\/events$/.test(url.pathname));
    } catch { return false; }
  };
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => isAnalytics(input)
    ? Promise.resolve(new Response(null, { status: 204 }))
    : originalFetch(input, init);
  if (typeof navigator.sendBeacon === "function") {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, body) => isAnalytics(url) || originalBeacon(url, body);
  }
}

export async function suppressSyntheticAnalytics(page) {
  await page.addInitScript(installSyntheticAnalyticsGuard);
}
