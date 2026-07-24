export type PwaCacheState = "idle" | "preparing" | "ready" | "error";

export type PwaClientSnapshot = {
  supported: boolean;
  cacheState: PwaCacheState;
  completed: number;
  total: number;
  updateAvailable: boolean;
};

type PwaWorkerMessage = {
  type?: unknown;
  completed?: unknown;
  total?: unknown;
};

type PwaSubscriber = (snapshot: PwaClientSnapshot) => void;

const initialSnapshot: PwaClientSnapshot = {
  supported: false,
  cacheState: "idle",
  completed: 0,
  total: 0,
  updateAvailable: false
};

let snapshot = initialSnapshot;
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let messageListenerAttached = false;
let reloadForUpdate = false;
const subscribers = new Set<PwaSubscriber>();

function updateSnapshot(patch: Partial<PwaClientSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  subscribers.forEach((subscriber) => subscriber(snapshot));
}

function numericProgress(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function reducePwaWorkerMessage(
  current: PwaClientSnapshot,
  message: PwaWorkerMessage
): PwaClientSnapshot {
  if (message.type === "PWA_CACHE_PROGRESS") {
    return {
      ...current,
      cacheState: "preparing",
      completed: numericProgress(message.completed),
      total: numericProgress(message.total)
    };
  }
  if (message.type === "PWA_CACHE_READY") {
    const total = numericProgress(message.total) || current.total;
    return { ...current, cacheState: "ready", completed: total, total };
  }
  if (message.type === "PWA_CACHE_ERROR") {
    return { ...current, cacheState: "error" };
  }
  return current;
}

function handleWorkerMessage(event: MessageEvent<PwaWorkerMessage>) {
  const next = reducePwaWorkerMessage(snapshot, event.data ?? {});
  if (next !== snapshot) updateSnapshot(next);
}

function watchInstallingWorker(worker: ServiceWorker) {
  updateSnapshot({ cacheState: "preparing" });
  const handleStateChange = () => {
    if (worker.state !== "installed") return;
    if (navigator.serviceWorker.controller) updateSnapshot({ updateAvailable: true });
  };
  worker.addEventListener("statechange", handleStateChange);
  handleStateChange();
}

function watchRegistration(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    updateSnapshot({ updateAvailable: true });
  } else if (registration.active && navigator.serviceWorker.controller && snapshot.cacheState === "idle") {
    updateSnapshot({ cacheState: "ready" });
  }
  if (registration.installing) watchInstallingWorker(registration.installing);
  registration.addEventListener("updatefound", () => {
    if (registration.installing) watchInstallingWorker(registration.installing);
  });
}

function serviceWorkerUrl(baseUrl: string): string {
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}service-worker.js`;
}

export function subscribePwaClient(subscriber: PwaSubscriber): () => void {
  subscribers.add(subscriber);
  subscriber(snapshot);
  return () => subscribers.delete(subscriber);
}

export function getPwaClientSnapshot(): PwaClientSnapshot {
  return snapshot;
}

export function startPwaClient(
  enabled = import.meta.env.PROD,
  baseUrl = import.meta.env.BASE_URL
): Promise<ServiceWorkerRegistration | null> {
  if (!enabled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  updateSnapshot({ supported: true });
  if (!messageListenerAttached) {
    navigator.serviceWorker.addEventListener("message", handleWorkerMessage);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadForUpdate) window.location.reload();
    });
    messageListenerAttached = true;
  }

  registrationPromise ??= navigator.serviceWorker.register(serviceWorkerUrl(baseUrl), {
    scope: baseUrl,
    updateViaCache: "none"
  }).then((registration) => {
    watchRegistration(registration);
    return registration;
  }).catch(() => {
    updateSnapshot({ cacheState: "error" });
    return null;
  });

  return registrationPromise;
}

export async function checkForPwaUpdate(): Promise<void> {
  const registration = await registrationPromise;
  if (!registration) return;
  try {
    await registration.update();
  } catch {
    // A failed update check must not interrupt the active invitation.
  }
}

export async function applyPwaUpdate(): Promise<boolean> {
  const registration = await registrationPromise;
  if (!registration) return false;
  if (!registration.waiting) await checkForPwaUpdate();
  const waiting = registration.waiting ?? await waitForWaitingWorker(registration);
  if (!waiting) return false;
  reloadForUpdate = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs = 4_000
): Promise<ServiceWorker | null> {
  if (registration.waiting) return Promise.resolve(registration.waiting);

  return new Promise((resolve) => {
    let installing = registration.installing;
    let finished = false;
    const finish = (worker: ServiceWorker | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      registration.removeEventListener("updatefound", handleUpdateFound);
      installing?.removeEventListener("statechange", handleStateChange);
      resolve(worker);
    };
    const handleStateChange = () => {
      if (registration.waiting) finish(registration.waiting);
      else if (installing?.state === "redundant") finish(null);
    };
    const handleUpdateFound = () => {
      installing?.removeEventListener("statechange", handleStateChange);
      installing = registration.installing;
      installing?.addEventListener("statechange", handleStateChange);
      handleStateChange();
    };
    const timer = window.setTimeout(() => finish(registration.waiting), timeoutMs);
    registration.addEventListener("updatefound", handleUpdateFound);
    installing?.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

export function warmPwaAssetCache(urls: readonly string[]): void {
  if (!urls.length || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const message = { type: "CACHE_URLS", urls: [...new Set(urls)] };
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return;
  }
  void registrationPromise?.then((registration) => registration?.active?.postMessage(message));
}

export function resetPwaClientForTests(): void {
  snapshot = initialSnapshot;
  registrationPromise = null;
  messageListenerAttached = false;
  reloadForUpdate = false;
  subscribers.clear();
}
