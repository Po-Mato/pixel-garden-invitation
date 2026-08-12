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

  expect(screen.getByRole("heading", { name: "캘린더 저장" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(onClose).toHaveBeenCalledTimes(2);

  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

it("renders its dialog in the document body portal", () => {
  render(
    <BottomSheet title="캘린더 저장" className="calendar-sheet-test" onClose={vi.fn()}>
      <button type="button">기본 캘린더</button>
    </BottomSheet>
  );

  expect(screen.getByRole("dialog")).toHaveClass("calendar-sheet-test");
  expect(screen.getByRole("button", { name: "닫기" }).querySelector("svg")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription("캘린더 저장 창입니다. 닫기 버튼 다음에 주요 내용이 이어집니다.");
  expect(screen.getByRole("dialog").parentElement).toBe(document.body);
});

it("긴 내용의 남은 스크롤과 끝까지 확인한 상태를 알려준다", () => {
  render(
    <BottomSheet title="오시는 길" onClose={vi.fn()}>
      <div>긴 길 안내</div>
    </BottomSheet>
  );

  const dialog = screen.getByRole("dialog");
  const body = dialog.querySelector(".bottom-sheet__body") as HTMLDivElement;
  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 900 },
    scrollTop: { configurable: true, writable: true, value: 0 }
  });
  fireEvent.scroll(body);
  expect(dialog).toHaveAttribute("data-scroll-state", "more");
  expect(screen.getByRole("status")).toHaveTextContent("아래로 더 보기");

  Object.defineProperty(body, "scrollTop", { configurable: true, writable: true, value: 500 });
  fireEvent.scroll(body);
  expect(dialog).toHaveAttribute("data-scroll-state", "end");
  expect(screen.getByRole("status")).toHaveTextContent("모두 확인했습니다");
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

it("열려 있는 동안 앱 배경을 비활성화하고 닫을 때 복구한다", () => {
  const appRoot = document.createElement("div");
  appRoot.id = "root";
  document.body.append(appRoot);

  const { unmount } = render(
    <BottomSheet title="보기 설정" onClose={vi.fn()}>
      <button type="button">편한 화면</button>
    </BottomSheet>
  );

  expect(appRoot).toHaveAttribute("aria-hidden", "true");
  expect(appRoot).toHaveAttribute("inert");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.querySelector(".sheet-backdrop")).toHaveAttribute("aria-hidden", "true");
  expect(document.querySelector(".sheet-backdrop")).toHaveAttribute("tabindex", "-1");

  unmount();
  expect(appRoot).not.toHaveAttribute("aria-hidden");
  expect(appRoot).not.toHaveAttribute("inert");
  expect(document.body.style.overflow).toBe("");
  appRoot.remove();
});
