import { Gauge, MemoryStick } from "lucide-react";
import type { DevicePerformanceContextValue } from "../performance/DevicePerformanceContext";

type GamePerformanceStatusProps = {
  performance: Pick<
    DevicePerformanceContextValue,
    "diagnostics" | "mode" | "effectsQuality" | "batteryLevel" | "energySavingReason"
  >;
};

const healthLabels = {
  good: "원활",
  watch: "자동 조정",
  protected: "보호 모드"
} as const;

export function GamePerformanceStatus({ performance }: GamePerformanceStatusProps) {
  const { diagnostics } = performance;
  return (
    <section className="game-performance-status" data-health={diagnostics.health} aria-label="기기 실행 상태">
      <header>
        <span><Gauge aria-hidden="true" /> 기기 상태</span>
        <strong>{healthLabels[diagnostics.health]}</strong>
      </header>
      <div>
        <span>{diagnostics.averageFps === null ? "측정 중" : `${diagnostics.averageFps} FPS`}</span>
        <span><MemoryStick aria-hidden="true" /> {diagnostics.memoryUsageRatio === null ? "메모리 자동 감지" : `메모리 ${Math.round(diagnostics.memoryUsageRatio * 100)}%`}</span>
        <span>효과 {performance.effectsQuality === "full" ? "전체" : performance.effectsQuality === "reduced" ? "절약" : "최소"}</span>
      </div>
      <p>{diagnostics.recommendation}</p>
    </section>
  );
}
