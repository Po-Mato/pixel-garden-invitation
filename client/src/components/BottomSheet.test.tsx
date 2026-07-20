import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(cleanup);

it("closes from Escape and backdrop and restores trigger focus", () => {
  const onClose = vi.fn();
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();

  const { unmount } = render(
    <BottomSheet title="캘린더 저장" onClose={onClose}>
      <button type="button">기본 캘린더</button>
    </BottomSheet>
  );

  expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "캘린더 저장 닫기" }));
  expect(onClose).toHaveBeenCalledTimes(2);

  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

it("renders its dialog in the document body portal", () => {
  render(
    <BottomSheet title="캘린더 저장" onClose={vi.fn()}>
      <button type="button">기본 캘린더</button>
    </BottomSheet>
  );

  expect(screen.getByRole("dialog").parentElement).toBe(document.body);
});

it("cycles focus in both directions at the dialog boundaries", () => {
  render(
    <BottomSheet title="캘린더 저장" onClose={vi.fn()}>
      <button type="button">기본 캘린더</button>
      <button type="button">파일 다운로드</button>
    </BottomSheet>
  );

  const closeButton = screen.getByRole("button", { name: "닫기" });
  const lastButton = screen.getByRole("button", { name: "파일 다운로드" });

  closeButton.focus();
  fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
  expect(lastButton).toHaveFocus();

  fireEvent.keyDown(lastButton, { key: "Tab" });
  expect(closeButton).toHaveFocus();
});
