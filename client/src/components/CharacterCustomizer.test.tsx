import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CharacterCustomizer, characterPreviewHintStorageKey } from "./CharacterCustomizer";

beforeEach(() => {
  const localValues = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: (key: string, value: string) => { localValues.set(key, value); },
    removeItem: (key: string) => { localValues.delete(key); },
    clear: () => { localValues.clear(); },
    key: (index: number) => [...localValues.keys()][index] ?? null,
    get length() { return localValues.size; }
  });
  vi.stubGlobal("PointerEvent", MouseEvent);
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(characterPreviewHintStorageKey);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("선택된 완성 하객 캐릭터 미리보기와 카드 목록을 보여준다", () => {
  const { container } = render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const preview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });
  expect(preview).toHaveAttribute("data-direction", "down");
  expect(preview).toHaveAttribute("data-moving", "true");
  expect(preview.querySelector("img")).toHaveAttribute(
    "src",
    expect.stringContaining("/guests/preview/feminine-long-wave-dress__walk.png")
  );
  expect(screen.getByRole("button", { name: "크림 롱 웨이브 원피스" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "네이비 클래식 수트" })).toBeInTheDocument();
  expect(container.querySelectorAll(".customizer-option--image")).toHaveLength(12);
  expect(screen.getByText("전체 12명 · 01 선택")).toBeInTheDocument();
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
  act(() => vi.advanceTimersByTime(240));
  expect(preview).toHaveAttribute("data-walk-frame", "3");

  fireEvent.click(screen.getByRole("button", { name: "보행 애니메이션 정지" }));
  expect(preview).toHaveAttribute("data-moving", "false");
  expect(preview).toHaveAttribute("data-walk-frame", "1");
  expect(screen.getByRole("button", { name: "보행 애니메이션 재생" })).toHaveAttribute("aria-pressed", "false");
});

it("캐릭터를 좌우로 밀거나 방향 점을 눌러 원하는 면을 바로 확인한다", () => {
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const preview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });
  const swipeSurface = preview.parentElement as HTMLElement;

  fireEvent.pointerDown(swipeSurface, { pointerId: 1, pointerType: "touch", clientX: 180, clientY: 160 });
  fireEvent.pointerUp(swipeSurface, { pointerId: 1, pointerType: "touch", clientX: 118, clientY: 164 });
  expect(preview).toHaveAttribute("data-direction", "right");

  fireEvent.pointerDown(swipeSurface, { pointerId: 2, pointerType: "touch", clientX: 110, clientY: 160 });
  fireEvent.pointerUp(swipeSurface, { pointerId: 2, pointerType: "touch", clientX: 176, clientY: 164 });
  expect(preview).toHaveAttribute("data-direction", "down");

  fireEvent.click(screen.getByRole("button", { name: "뒷면 보기" }));
  expect(preview).toHaveAttribute("data-direction", "up");
  expect(screen.getByRole("button", { name: "뒷면 보기" })).toHaveAttribute("aria-pressed", "true");
});

it("방향이 바뀔 때 짧은 전환만 적용하고 즉시 원래 선명도로 돌아온다", () => {
  vi.useFakeTimers();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const preview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });
  const swipeSurface = preview.parentElement as HTMLElement;

  fireEvent.click(screen.getByRole("button", { name: "오른쪽 보기" }));
  expect(swipeSurface).toHaveAttribute("data-turning", "true");
  act(() => vi.advanceTimersByTime(90));
  expect(swipeSurface).not.toHaveAttribute("data-turning");
});

it("회전·보행 안내는 최초 한 번만 잠시 보여준다", () => {
  vi.useFakeTimers();
  const first = render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);

  expect(screen.getByRole("status")).toHaveTextContent("회전·보행 확인 가능");
  expect(window.localStorage.getItem(characterPreviewHintStorageKey)).toBe("true");
  act(() => vi.advanceTimersByTime(4200));
  expect(screen.queryByText("회전·보행 확인 가능")).not.toBeInTheDocument();

  first.unmount();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  expect(screen.queryByText("회전·보행 확인 가능")).not.toBeInTheDocument();
});

it("완성 캐릭터 카드를 선택하면 presetId를 변경한다", () => {
  const onChange = vi.fn();
  render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
  expect(onChange).toHaveBeenCalledWith({ presetId: "masculine-navy-suit" });
});

it("프리셋이 바뀌면 큰 미리보기만 새 전환 대상으로 교체한다", () => {
  const { rerender } = render(<CharacterCustomizer value={defaultCharacterAppearance} onChange={vi.fn()} />);
  const firstPreview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });

  rerender(
    <CharacterCustomizer
      value={{ presetId: "masculine-navy-suit" }}
      onChange={vi.fn()}
    />
  );

  const nextPreview = screen.getByRole("img", { name: "선택한 하객 캐릭터" });
  expect(nextPreview).not.toBe(firstPreview);
  expect(nextPreview).toHaveAttribute("data-character-preset", "masculine-navy-suit");
  expect(nextPreview).toHaveAttribute("data-motion-profile", "tailored");
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
