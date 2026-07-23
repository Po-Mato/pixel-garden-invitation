import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DevicePerformanceProvider,
  resolveDevicePerformanceStatus,
  useDevicePerformance
} from "./DevicePerformanceContext";

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
});
