import { describe, expect, it } from "vitest";
import { buildDeviceReadinessReport, emptyDeviceQaChecks } from "./gameDeviceReadiness";

describe("gameDeviceReadiness", () => {
  it("iPhone 환경의 지원 기능과 주의 항목을 구분한다", () => {
    const report = buildDeviceReadinessReport({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      width: 390,
      height: 844,
      pixelRatio: 3,
      touchPoints: 5,
      online: true,
      storageAvailable: true,
      audioAvailable: true,
      vibrationAvailable: false,
      shareAvailable: true,
      standalone: false,
      manualChecks: emptyDeviceQaChecks(),
      createdAt: "2026-07-30T00:00:00.000Z"
    });
    expect(report.deviceFamily).toBe("iPhone/iPad");
    expect(report.items.find(({ id }) => id === "touch")?.status).toBe("pass");
    expect(report.items.find(({ id }) => id === "haptic")?.status).toBe("info");
  });
});
