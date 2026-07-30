import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldInteractiveProp, WorldPropMoment } from "./WorldInteractiveProp";

const decoration = {
  id: "venue-fountain",
  kind: "fountain" as const,
  label: "작은 수경 요소",
  x: 240,
  y: 450,
  width: 120,
  height: 120
};
const interaction = {
  decorationId: decoration.id,
  secretId: "fountain-wish",
  secretLabel: "분수의 소원",
  secretHint: "반짝이는 물빛을 찾아보세요",
  clueLabel: "물빛이 반짝여요",
  actionLabel: "소원 빌기",
  resultMessage: "두 사람의 행복을 빌었어요",
  reaction: "heart" as const,
  effect: "sparkle" as const,
  actionRadius: 48
};

describe("WorldInteractiveProp", () => {
  it("장식 전체를 접근 가능한 터치 대상으로 제공한다", () => {
    const onSelect = vi.fn();
    render(
      <WorldInteractiveProp
        decoration={decoration}
        interaction={interaction}
        active={false}
        nearby
        clue={{ band: "near", distance: 38, directionLabel: "바로 근처", message: "단서가 아주 선명해요 · 물빛이 반짝여요" }}
        onSelect={onSelect}
      />
    );
    const button = screen.getByRole("button", { name: "작은 수경 요소, 소원 빌기" });
    expect(button).toHaveAttribute("data-nearby", "true");
    expect(button).toHaveAccessibleDescription("단서가 아주 선명해요 · 물빛이 반짝여요");
    expect(button).toHaveStyle({ left: "240px", top: "450px", width: "120px", height: "120px" });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("상호작용 결과를 짧은 상태 메시지로 보여준다", () => {
    render(<WorldPropMoment decoration={decoration} interaction={interaction} isNewSecret achievementLabel="첫 비밀 발견" />);
    expect(screen.getByRole("status")).toHaveTextContent("숨은 추억 · 분수의 소원");
    expect(screen.getByRole("status")).toHaveTextContent("두 사람의 행복을 빌었어요");
    expect(screen.getByRole("status")).toHaveTextContent("업적 달성 · 첫 비밀 발견");
  });
});
