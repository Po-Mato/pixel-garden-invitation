import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyJourneyProgress } from "../game/journeyProgress";
import { JourneyStampBook } from "./JourneyStampBook";

afterEach(cleanup);

function renderStampBook(syncStatus: "queued" | "merged") {
  render(
    <JourneyStampBook
      progress={createEmptyJourneyProgress()}
      syncStatus={syncStatus}
      activeZoneId="home"
      highlightedCheckpointId={null}
      onOpenCompletion={vi.fn()}
      onSelectZone={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: /방문 스탬프 0\/5, 열기/ }));
}

describe("JourneyStampBook 동기화 안내", () => {
  it("오프라인 변경이 자동 저장 대기 중임을 알린다", () => {
    renderStampBook("queued");
    expect(screen.getByRole("status")).toHaveTextContent("오프라인 변경 대기 중 · 연결되면 자동 저장");
  });

  it("다른 기기의 완료 기록을 잃지 않고 합쳤음을 알린다", () => {
    renderStampBook("merged");
    expect(screen.getByRole("status")).toHaveTextContent("다른 기기의 기록과 합침 · 완료 기록은 유지됨");
  });
});
