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
  RsvpAdminPage: () => <div>비공개 관리자 화면</div>
}));

describe("App query routing", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders only the RSVP admin page for the exact admin query", () => {
    window.history.replaceState({}, "", "/?admin=rsvp");
    render(<App />);
    expect(screen.getByText("비공개 관리자 화면")).toBeInTheDocument();
    expect(screen.queryByText("일반 입장 화면")).not.toBeInTheDocument();
  });

  it.each(["/", "/?admin=RSVP", "/?admin=other"])("keeps the normal invitation at %s", (path) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(screen.getByText("일반 입장 화면")).toBeInTheDocument();
    expect(screen.queryByText("비공개 관리자 화면")).not.toBeInTheDocument();
  });
});
