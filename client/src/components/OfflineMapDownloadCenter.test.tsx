import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PwaClientSnapshot } from "../pwa/pwaClient";
import { OfflineMapDownloadCenter } from "./OfflineMapDownloadCenter";

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
  prepare: vi.fn(),
  prepareJourney: vi.fn(),
  remove: vi.fn(),
  removeJourney: vi.fn(),
  applyUpdate: vi.fn(async () => true),
  checkUpdate: vi.fn(async () => undefined),
  start: vi.fn(async () => null),
  measure: vi.fn(async (groups: Record<string, string[]>) => Object.fromEntries(
    Object.entries(groups).map(([zoneId, urls]) => [zoneId, {
      bytes: urls.length * 100_000,
      measuredFiles: urls.length,
      totalFiles: urls.length
    }])
  ))
}));

const snapshot: PwaClientSnapshot = {
  supported: true,
  cacheState: "ready",
  completed: 1,
  total: 1,
  updateAvailable: false,
  featureCacheState: "ready",
  featureCompleted: 1,
  featureTotal: 1,
  zoneCaches: {
    lobby: { state: "ready", completed: 2, total: 2, bytes: 2 * 1024 * 1024, cachedAt: Date.now() }
  }
};

vi.mock("../pwa/pwaClient", () => ({
  applyPwaUpdate: mocks.applyUpdate,
  checkForPwaUpdate: mocks.checkUpdate,
  getPwaClientSnapshot: () => snapshot,
  subscribePwaClient: (subscriber: (value: PwaClientSnapshot) => void) => {
    subscriber(snapshot);
    return vi.fn();
  },
  inspectOfflineZoneAssets: mocks.inspect,
  prepareOfflineZoneAssets: mocks.prepare,
  prepareOfflineJourneyAssets: mocks.prepareJourney,
  removeOfflineZoneAssets: mocks.remove,
  removeOfflineJourneyAssets: mocks.removeJourney,
  startPwaClient: mocks.start
}));

vi.mock("../pwa/offlineAssetMeasurement", () => ({
  measureOfflineAssetGroups: mocks.measure,
  estimatedOfflineDownloadSeconds: () => 4,
  formatOfflineDownloadDuration: () => "약 4초"
}));

describe("OfflineMapDownloadCenter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows server-measured size and manages each map independently", async () => {
    render(<OfflineMapDownloadCenter currentZoneId="home" />);
    expect(screen.getByText("우리 집 · 현재")).toBeInTheDocument();
    expect(screen.getByText("저장됨 2.0MB")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/저장 안 됨 · 서버 기준/).length).toBeGreaterThan(0));
    expect(screen.getByText(/2.0MB · .*자동 삭제 예정/)).toBeInTheDocument();
    expect(screen.getByText(/개 구역 저장됨 · 서버 기준 .*약 4초/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "우리 집 오프라인 지도 저장" }));
    expect(mocks.prepare).toHaveBeenCalledWith("home", expect.arrayContaining([
      expect.stringContaining("/assets/maps/v2/home/background.webp")
    ]));

    fireEvent.click(screen.getByRole("button", { name: "예식장 로비 오프라인 지도 삭제" }));
    expect(mocks.remove).toHaveBeenCalledWith("lobby", expect.any(Array));

    fireEvent.click(screen.getByRole("button", { name: "전체 여정 오프라인 지도 저장" }));
    expect(mocks.prepareJourney).toHaveBeenCalledWith(expect.objectContaining({
      home: expect.arrayContaining([expect.stringContaining("/assets/maps/v2/home/background.webp")])
    }));
  });

  it("lets the guest choose cleanup timing and Wi-Fi refresh", () => {
    render(<OfflineMapDownloadCenter currentZoneId="home" />);
    const sevenDays = screen.getAllByRole("button", { name: "7일" }).at(-1)!;
    fireEvent.click(sevenDays);
    expect(sevenDays).toHaveAttribute("aria-pressed", "true");
    const wifiRefresh = screen.getAllByRole("checkbox", { name: "Wi-Fi 연결 시 오래된 지도 자동 갱신" }).at(-1)!;
    expect(wifiRefresh).toBeChecked();
    fireEvent.click(wifiRefresh);
    expect(wifiRefresh).not.toBeChecked();
  });
});
