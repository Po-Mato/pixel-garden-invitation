import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
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
      appearance={defaultCharacterAppearance}
      equippedReward="none"
      onEquipReward={vi.fn()}
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

  it("완료한 방문 스탬프 장식을 미리보고 캐릭터에 착용한다", () => {
    const onEquipReward = vi.fn();
    render(
      <JourneyStampBook
        progress={{ version: 1, completedIds: ["directions"], updatedAt: "2026-07-31T00:00:00.000Z" }}
        activeZoneId="home"
        highlightedCheckpointId={null}
        appearance={defaultCharacterAppearance}
        equippedReward="none"
        onEquipReward={onEquipReward}
        onOpenCompletion={vi.fn()}
        onSelectZone={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /방문 스탬프 1\/5, 열기/ }));
    fireEvent.click(screen.getByRole("button", { name: /정원 길잡이 핀/ }));
    expect(screen.getByLabelText("정원 길잡이 핀 캐릭터 미리보기")).toHaveAttribute("data-journey-stamp-reward", "garden-map-pin");
    fireEvent.click(screen.getByRole("button", { name: "이 장식 착용" }));
    expect(onEquipReward).toHaveBeenCalledWith("garden-map-pin");
  });
});
