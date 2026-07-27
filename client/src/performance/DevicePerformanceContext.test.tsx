import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchInvitationPerformanceConfig } from "../api/performanceConfigApi";
import {
  DevicePerformanceProvider,
  resolveDevicePerformanceStatus,
  useDevicePerformance
} from "./DevicePerformanceContext";

vi.mock("../api/performanceConfigApi", () => ({ fetchInvitationPerformanceConfig: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetchInvitationPerformanceConfig).mockRejectedValue(new Error("offline"));
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.performanceMode;
  delete document.documentElement.dataset.performanceReason;
});

describe("기기 성능 자동 최적화", () => {
  it("메모리·CPU·연결 제약을 가벼운 모드로 판정한다", () => {
    expect(resolveDevicePerformanceStatus({ deviceMemory: 4, hardwareConcurrency: 8 })).toEqual({ mode: "lite", reason: "memory" });
    expect(resolveDevicePerformanceStatus({ deviceMemory: 8, hardwareConcurrency: 4 })).toEqual({ mode: "lite", reason: "processor" });
    expect(resolveDevicePerformanceStatus({ hardwareConcurrency: 8, connection: { effectiveType: "2g" } })).toEqual({ mode: "lite", reason: "network" });
    expect(resolveDevicePerformanceStatus({ deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: "4g" } })).toEqual({ mode: "standard", reason: "standard" });
  });

  it("감지 결과를 문서와 하위 UI에 공유한다", () => {
    function Status() {
      const status = useDevicePerformance();
      return <span>{status.mode}</span>;
    }
    render(<DevicePerformanceProvider><Status /></DevicePerformanceProvider>);
    expect(screen.getByText(/standard|lite/)).toBeInTheDocument();
    expect(document.documentElement.dataset.performanceMode).toMatch(/standard|lite/);
  });

  it("실측 프레임 보고 함수를 하위 게임 UI에 제공한다", () => {
    function Reporter() {
      const status = useDevicePerformance();
      return <button type="button" onClick={() => status.reportAnimationFrame(16)}>프레임 보고</button>;
    }
    render(<DevicePerformanceProvider><Reporter /></DevicePerformanceProvider>);
    expect(screen.getByRole("button", { name: "프레임 보고" })).toBeInTheDocument();
  });

  it("익명 실기기 표본으로 보정된 원격 기준을 하위 UI에 공유한다", async () => {
    vi.mocked(fetchInvitationPerformanceConfig).mockResolvedValueOnce({
      version: 1,
      source: "observed",
      sampleCount: 87,
      observedAverageFps: 49,
      slowFpsThreshold: 40,
      recoveryFpsThreshold: 48,
      slowWindowsRequired: 2,
      recoveryWindowsRequired: 4,
      generatedAt: "2026-07-28T00:00:00.000Z"
    });
    function TuningStatus() {
      const status = useDevicePerformance();
      return <span>{status.tuningSource}:{status.tuningSampleCount}</span>;
    }

    render(<DevicePerformanceProvider><TuningStatus /></DevicePerformanceProvider>);
    await waitFor(() => expect(screen.getByText("observed:87")).toBeInTheDocument());
  });
});
