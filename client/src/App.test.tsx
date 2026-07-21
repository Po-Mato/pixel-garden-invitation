import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import { App } from "./App";

vi.mock("./components/EntryScreen", () => ({
  EntryScreen: ({ weddingDayPreview }: { weddingDayPreview?: boolean }) => (
    <div data-wedding-day-preview={weddingDayPreview || undefined}>일반 입장 화면</div>
  )
}));
vi.mock("./components/GameWorld", () => ({
  GameWorld: ({ weddingDayPreview }: { weddingDayPreview?: boolean }) => (
    <div data-wedding-day-preview={weddingDayPreview || undefined}>게임 월드</div>
  )
}));
vi.mock("./components/RsvpAdminPage", () => ({
  RsvpAdminPage: () => <div>참석 답변 관리자 화면</div>
}));
vi.mock("./components/GuestbookAdminPage", () => ({
  GuestbookAdminPage: () => <div>방명록 관리자 화면</div>
}));

describe("App query routing", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders only the RSVP admin page for the exact admin query", () => {
    window.history.replaceState({}, "", "/?admin=rsvp");
    render(<App />);
    expect(screen.getByText("참석 답변 관리자 화면")).toBeInTheDocument();
    expect(screen.queryByText("일반 입장 화면")).not.toBeInTheDocument();
  });

  it("renders only the guestbook admin page for its exact admin query", () => {
    window.history.replaceState({}, "", "/?admin=guestbook");
    render(<App />);
    expect(screen.getByText("방명록 관리자 화면")).toBeInTheDocument();
    expect(screen.queryByText("일반 입장 화면")).not.toBeInTheDocument();
  });

  it.each(["/", "/?admin=RSVP", "/?admin=other"])("keeps the normal invitation at %s", (path) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(screen.getByText("일반 입장 화면")).toBeInTheDocument();
    expect(screen.queryByText("참석 답변 관리자 화면")).not.toBeInTheDocument();
    expect(screen.queryByText("방명록 관리자 화면")).not.toBeInTheDocument();
  });

  it("예식 당일 미리보기 쿼리를 일반 초대장에 전달한다", () => {
    window.history.replaceState({}, "", "/?preview=wedding-day");
    render(<App />);

    expect(screen.getByText("일반 입장 화면")).toHaveAttribute("data-wedding-day-preview", "true");
  });

  it("선택된 순서로 브라우저 문서 제목도 동기화한다", async () => {
    render(
      <CoupleOrderProvider initialOrder="groom-first">
        <App />
      </CoupleOrderProvider>
    );

    await waitFor(() => expect(document.title).toBe("이승재 · 이건희 결혼식 | 2027.05.01"));
  });
});
