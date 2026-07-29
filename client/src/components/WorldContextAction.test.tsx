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
