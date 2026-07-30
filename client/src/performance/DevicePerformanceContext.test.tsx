import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchInvitationPerformanceConfig } from "../api/performanceConfigApi";
import {
  DevicePerformanceProvider,
  effectsPreferenceStorageKey,
  loadEffectsPreference,
  resolvePreferredEffectsQuality,
  saveEffectsPreference,
  resolveDevicePerformanceStatus,
  useDevicePerformance
} from "./DevicePerformanceContext";

vi.mock("../api/performanceConfigApi", () => ({ fetchInvitationPerformanceConfig: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetchInvitationPerformanceConfig).mockRejectedValue(new Error("offline"));
  Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 8 });
  Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
  Object.defineProperty(navigator, "connection", { configurable: true, value: { effectiveType: "4g" } });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "deviceMemory");
  Reflect.deleteProperty(navigator, "hardwareConcurrency");
  Reflect.deleteProperty(navigator, "connection");
  delete document.documentElement.dataset.performanceMode;
  delete document.documentElement.dataset.performanceReason;
  delete document.documentElement.dataset.effectsQuality;
  delete document.documentElement.dataset.effectsPreference;
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
      return <span>{status.mode}:{status.effectsQuality}</span>;
    }
    render(<DevicePerformanceProvider><Status /></DevicePerformanceProvider>);
    expect(screen.getByText(/standard|lite/)).toBeInTheDocument();
    expect(document.documentElement.dataset.performanceMode).toMatch(/standard|lite/);
    expect(document.documentElement.dataset.effectsQuality).toMatch(/full|minimal/);
  });

  it("실측 프레임 보고 함수를 하위 게임 UI에 제공한다", () => {
    function Reporter() {
      const status = useDevicePerformance();
      return <button type="button" onClick={() => status.reportAnimationFrame(16)}>프레임 보고</button>;
    }
    render(<DevicePerformanceProvider><Reporter /></DevicePerformanceProvider>);
    expect(screen.getByRole("button", { name: "프레임 보고" })).toBeInTheDocument();
  });

  it("지속적인 프레임 저하를 감지해 효과 단계를 자동으로 낮춘다", () => {
    let reportFrame: ((now: number) => void) | null = null;
    function Reporter() {
      const status = useDevicePerformance();
      reportFrame = status.reportAnimationFrame;
      return <span>{status.effectsQuality}</span>;
    }
    render(<DevicePerformanceProvider><Reporter /></DevicePerformanceProvider>);

    act(() => {
      for (let frame = 0; frame < 140; frame += 1) reportFrame?.(frame * 35);
    });

    expect(screen.getByText(/reduced|minimal/)).toBeInTheDocument();
    expect(document.documentElement.dataset.performanceReason).toBe("frame-rate");
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

  it("사용자가 자동보다 낮은 효과 단계를 선택하고 기기에 저장한다", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); })
    };
    expect(loadEffectsPreference(storage)).toBe("auto");
    expect(saveEffectsPreference("reduced", storage)).toBe(true);
    expect(values.get(effectsPreferenceStorageKey)).toBe("reduced");
    expect(loadEffectsPreference(storage)).toBe("reduced");
    expect(resolvePreferredEffectsQuality("full", "reduced")).toBe("reduced");
    expect(resolvePreferredEffectsQuality("minimal", "full")).toBe("minimal");
  });

  it("환경 설정에서 선택한 효과 단계를 즉시 공유한다", () => {
    function Quality() {
      const status = useDevicePerformance();
      return (
        <button type="button" onClick={() => status.setEffectsPreference("minimal")}>
          {status.effectsPreference}:{status.effectsQuality}
        </button>
      );
    }
    render(
      <DevicePerformanceProvider initialEffectsPreference="auto">
        <Quality />
      </DevicePerformanceProvider>
    );
    act(() => { screen.getByRole("button").click(); });
    expect(screen.getByText("minimal:minimal")).toBeInTheDocument();
    expect(document.documentElement.dataset.effectsPreference).toBe("minimal");
  });
});
