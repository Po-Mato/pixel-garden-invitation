import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./components/EntryScreen", () => ({
  EntryScreen: () => <div>일반 입장 화면</div>
}));
vi.mock("./components/GameWorld", () => ({
  GameWorld: () => <div>게임 월드</div>
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
});
