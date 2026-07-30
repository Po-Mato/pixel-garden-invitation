import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GamePerformanceStatus } from "./GamePerformanceStatus";

describe("GamePerformanceStatus", () => {
  it("실측 프레임과 자동 효과 상태를 함께 보여준다", () => {
    render(<GamePerformanceStatus performance={{
      mode: "lite",
      effectsQuality: "reduced",
      batteryLevel: null,
      energySavingReason: "none",
      diagnostics: {
        health: "watch",
        averageFps: 41,
        memoryUsageRatio: 0.7,
        sampleCount: 30,
        sessionMinutes: 12,
        memoryTrend: "rising",
        recoveryCount: 1,
        recommendation: "효과를 조정 중이에요"
      }
    }} />);
    expect(screen.getByLabelText("기기 실행 상태")).toHaveTextContent("자동 조정");
    expect(screen.getByText("41 FPS")).toBeInTheDocument();
    expect(screen.getByText("메모리 70%")).toBeInTheDocument();
    expect(screen.getByText("세션 12분")).toBeInTheDocument();
    expect(screen.getByText("자동 회복 1회")).toBeInTheDocument();
  });
});
