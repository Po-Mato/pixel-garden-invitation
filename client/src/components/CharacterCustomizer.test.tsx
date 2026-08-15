import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterCustomizer } from "./CharacterCustomizer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("선택된 완성 하객 캐릭터 미리보기와 카드 목록을 보여준다", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const preview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });
  expect(preview).toHaveAttribute("data-direction", "down");
  expect(preview).toHaveAttribute("data-moving", "true");
  expect(preview.querySelector("img")).toHaveAttribute(
    "src",
    expect.stringContaining("/guests/feminine-long-wave-dress__walk.png")
  );
  expect(screen.getByRole("button", { name: "크림 롱 웨이브 원피스" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "네이비 클래식 수트" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "헤어" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "액세서리" })).not.toBeInTheDocument();
});

it("네 방향 회전과 보행 재생·정지 상태를 미리 볼 수 있다", () => {
  vi.useFakeTimers();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const preview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });

  expect(screen.getByText("정면 · 보행 중")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "캐릭터 회전, 현재 정면" }));
  expect(preview).toHaveAttribute("data-direction", "right");
  expect(screen.getByText("오른쪽 · 보행 중")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "캐릭터 회전, 현재 오른쪽" }));
  expect(preview).toHaveAttribute("data-direction", "up");
  fireEvent.click(screen.getByRole("button", { name: "캐릭터 회전, 현재 뒷면" }));
  expect(preview).toHaveAttribute("data-direction", "left");
  fireEvent.click(screen.getByRole("button", { name: "캐릭터 회전, 현재 왼쪽" }));
  expect(preview).toHaveAttribute("data-direction", "down");

  act(() => vi.advanceTimersByTime(480));
  expect(preview).toHaveAttribute("data-walk-frame", "2");

  fireEvent.click(screen.getByRole("button", { name: "보행 애니메이션 정지" }));
  expect(preview).toHaveAttribute("data-moving", "false");
  expect(preview).toHaveAttribute("data-walk-frame", "1");
  expect(screen.getByRole("button", { name: "보행 애니메이션 재생" })).toHaveAttribute("aria-pressed", "false");
});

it("완성 캐릭터 카드를 선택하면 presetId를 변경한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
  expect(onChange).toHaveBeenCalledWith({ presetId: "masculine-navy-suit" });
});

it("무작위 선택과 기본 캐릭터 선택을 지원한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "무작위 선택" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    presetId: expect.any(String)
  }));
  fireEvent.click(screen.getByRole("button", { name: "기본 캐릭터" }));
  expect(onChange).toHaveBeenLastCalledWith(defaultCharacterAppearance);
});

it("장식 무대와 읽을 수 있는 프리셋 라벨을 분리한다", () => {
  const { container } = render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const selectedCard = screen.getByRole("button", { name: "크림 롱 웨이브 원피스" });

  expect(container.querySelector(".character-customizer__stage")).toHaveAttribute("aria-hidden", "true");
  expect(selectedCard.querySelector(".customizer-option__label")).toHaveTextContent("크림 롱 웨이브 원피스");
  expect(container.querySelector(".character-customizer__selected-name")).toHaveTextContent("크림 롱 웨이브 원피스");
});
