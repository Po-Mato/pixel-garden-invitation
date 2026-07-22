import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoupleOrderProvider } from "./invitation/CoupleOrderContext";
import { App } from "./App";

vi.mock("./components/EntryScreen", () => ({
  EntryScreen: ({
    weddingDayPreview,
    onQuickView
  }: { weddingDayPreview?: boolean; onQuickView?: () => void }) => (
    <div data-wedding-day-preview={weddingDayPreview || undefined}>
      일반 입장 화면
      <button type="button" onClick={onQuickView}>간편 모드 열기</button>
    </div>
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
vi.mock("./components/ReadinessAdminPage", () => ({
  ReadinessAdminPage: () => <div>공개 준비 점검 화면</div>
}));
vi.mock("./components/QuickInvitation", () => ({
  QuickInvitation: ({ onOpenGarden }: { onOpenGarden: () => void }) => (
    <div>간편 초대장 화면<button type="button" onClick={onOpenGarden}>정원 열기</button></div>
  )
}));

describe("App query routing", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders only the RSVP admin page for the exact admin query", async () => {
    window.history.replaceState({}, "", "/?admin=rsvp");
    render(<App />);
    expect(await screen.findByText("참석 답변 관리자 화면")).toBeInTheDocument();
    expect(screen.queryByText("일반 입장 화면")).not.toBeInTheDocument();
  });

  it("renders only the guestbook admin page for its exact admin query", async () => {
    window.history.replaceState({}, "", "/?admin=guestbook");
    render(<App />);
    expect(await screen.findByText("방명록 관리자 화면")).toBeInTheDocument();
    expect(screen.queryByText("일반 입장 화면")).not.toBeInTheDocument();
  });

  it("renders only the publication readiness page for its exact admin query", async () => {
    window.history.replaceState({}, "", "/?admin=readiness");
    render(<App />);
    expect(await screen.findByText("공개 준비 점검 화면")).toBeInTheDocument();
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

  it("직접 링크와 입장 화면 버튼에서 간편 초대장을 연다", async () => {
    window.history.replaceState({}, "", "/?view=invitation#directions");
    const direct = render(<App />);
    expect(await screen.findByText("간편 초대장 화면")).toBeInTheDocument();
    direct.unmount();

    window.history.replaceState({}, "", "/");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "간편 모드 열기" }));

    expect(await screen.findByText("간편 초대장 화면")).toBeInTheDocument();
    expect(window.location.search).toBe("?view=invitation");
  });

  it("간편 초대장에서 입장 화면으로 돌아온다", async () => {
    window.history.replaceState({}, "", "/?view=invitation");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "정원 열기" }));

    expect(screen.getByText("일반 입장 화면")).toBeInTheDocument();
    expect(window.location.search).toBe("");
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
