import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WorldContextAction } from "./WorldContextAction";

it("가까운 대상의 단일 행동을 명확하게 제공한다", () => {
  const onActivate = vi.fn();
  const action = { kind: "photo" as const, id: "photo", label: "로비 포토월", actionLabel: "촬영", distance: 20 };
  render(<WorldContextAction action={action} onActivate={onActivate} />);
  fireEvent.click(screen.getByRole("button", { name: "로비 포토월 촬영" }));
  expect(onActivate).toHaveBeenCalledWith(action);
});

it("미니 퀘스트 진행도를 같은 상황 버튼에 표시한다", () => {
  render(
    <WorldContextAction
      action={{
        kind: "quest",
        id: "lobby-info",
        label: "예식 안내",
        actionLabel: "안내",
        distance: Number.POSITIVE_INFINITY,
        progressLabel: "로비 둘러보기 · 1/3"
      }}
      onActivate={vi.fn()}
    />
  );
  expect(screen.getByText("로비 둘러보기 · 1/3")).toBeInTheDocument();
});
