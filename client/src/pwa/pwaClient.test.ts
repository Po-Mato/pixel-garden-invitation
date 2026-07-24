import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPwaUpdate,
  getPwaClientSnapshot,
  reducePwaWorkerMessage,
  resetPwaClientForTests,
  startPwaClient,
  warmPwaAssetCache,
  type PwaClientSnapshot
} from "./pwaClient";

const emptySnapshot: PwaClientSnapshot = {
  supported: true,
  cacheState: "idle",
  completed: 0,
  total: 0,
  updateAvailable: false
};

afterEach(() => {
  resetPwaClientForTests();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function stubServiceWorker(waiting: { postMessage: ReturnType<typeof vi.fn> } | null = null) {
  const registration = {
    waiting,
    active: { postMessage: vi.fn() },
    installing: null,
    addEventListener: vi.fn(),
    update: vi.fn(async () => undefined)
  };
  const serviceWorker = {
    controller: { postMessage: vi.fn() },
    addEventListener: vi.fn(),
    register: vi.fn(async () => registration)
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker
  });
  return { registration, serviceWorker };
}

describe("PWA client", () => {
  it("reduces cache progress, ready, and error messages without accepting invalid numbers", () => {
    const preparing = reducePwaWorkerMessage(emptySnapshot, {
      type: "PWA_CACHE_PROGRESS",
      completed: 4,
      total: 10
    });
    expect(preparing).toMatchObject({ cacheState: "preparing", completed: 4, total: 10 });
    expect(reducePwaWorkerMessage(preparing, { type: "PWA_CACHE_READY", total: 10 }))
      .toMatchObject({ cacheState: "ready", completed: 10, total: 10 });
    expect(reducePwaWorkerMessage(preparing, { type: "PWA_CACHE_ERROR" }).cacheState).toBe("error");
    expect(reducePwaWorkerMessage(emptySnapshot, {
      type: "PWA_CACHE_PROGRESS",
      completed: -1,
      total: "ten"
    })).toMatchObject({ completed: 0, total: 0 });
  });

  it("registers under the deployed subpath without using the HTTP cache", async () => {
    const { serviceWorker } = stubServiceWorker();

    await startPwaClient(true, "/pixel-garden-invitation/");

    expect(serviceWorker.register).toHaveBeenCalledWith(
      "/pixel-garden-invitation/service-worker.js",
      { scope: "/pixel-garden-invitation/", updateViaCache: "none" }
    );
    expect(getPwaClientSnapshot()).toMatchObject({ supported: true, cacheState: "ready" });
  });

  it("sends explicit update and cache warmup messages only through the service worker", async () => {
    const waiting = { postMessage: vi.fn() };
    const { serviceWorker } = stubServiceWorker(waiting);
    await startPwaClient(true, "./");

    warmPwaAssetCache(["./map.webp", "./map.webp", "./tree.png"]);
    expect(serviceWorker.controller.postMessage).toHaveBeenCalledWith({
      type: "CACHE_URLS",
      urls: ["./map.webp", "./tree.png"]
    });

    await expect(applyPwaUpdate()).resolves.toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("applies a new worker discovered by the explicit update check", async () => {
    const waiting = { postMessage: vi.fn() };
    const { registration } = stubServiceWorker();
    registration.update.mockImplementation(async () => {
      registration.waiting = waiting;
    });
    await startPwaClient(true, "./");

    await expect(applyPwaUpdate()).resolves.toBe(true);
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});
