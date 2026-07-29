import { fireEvent, render, screen } from "@testing-library/react";
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
  start: vi.fn(async () => null)
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
    lobby: { state: "ready", completed: 2, total: 2, bytes: 2 * 1024 * 1024 }
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

describe("OfflineMapDownloadCenter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows saved size and manages each map independently", () => {
    render(<OfflineMapDownloadCenter currentZoneId="home" />);
    expect(screen.getByText("우리 집 · 현재")).toBeInTheDocument();
    expect(screen.getByText("저장됨 2.0MB")).toBeInTheDocument();

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
});
