import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameFeedbackProvider } from "../feedback/GameFeedbackContext";
import { defaultFeedbackPreferences } from "../feedback/feedbackPreferences";
import { gameQuickDockStorageKey } from "../game/gameQuickDockPreferences";
import { copyText, shareContent } from "../invitation/browserActions";
import { GameQuickDock } from "./GameQuickDock";

vi.mock("./GuestInformationAccess", () => ({
  GuestInformationAccess: () => <button type="button" aria-label="공지·FAQ 열기">공지</button>
}));
vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  shareContent: vi.fn(),
  isShareAbortError: vi.fn(() => false)
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("게임 빠른 도구 도크", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    });
    vi.mocked(shareContent).mockResolvedValue(undefined);
    vi.mocked(copyText).mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/");
  });

  it("기본 화면에는 초대장과 게임 도구 진입만 표시한다", () => {
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={vi.fn()}
          onOpenMenu={vi.fn()}
        />
      </GameFeedbackProvider>
    );

    expect(screen.queryByRole("button", { name: "하객 리액션 열기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "공지·FAQ 열기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "게임 도구 열기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "초대장 메뉴" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "여정 도구 열기" })).not.toBeInTheDocument();
  });

  it("즐겨찾기를 교체해 다음 방문에도 유지한다", () => {
    const onOpenJourney = vi.fn();
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={onOpenJourney}
          onOpenMenu={vi.fn()}
        />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "게임 도구 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "여정" }));
    fireEvent.click(screen.getByRole("button", { name: "여정 도구 열기" }));
    expect(onOpenJourney).toHaveBeenCalledOnce();
    expect(localStorage.getItem(gameQuickDockStorageKey)).toContain("journey");
  });

  it("즐겨찾기를 초기화하고 다른 기기용 설정 링크를 공유한다", async () => {
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={vi.fn()}
          onOpenMenu={vi.fn()}
        />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "게임 도구 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "사운드" }));
    fireEvent.click(screen.getByRole("button", { name: "기본값" }));
    expect(screen.getByRole("button", { name: "리액션" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "도구 옮기기" }));
    await waitFor(() => expect(shareContent).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("quickDock=")
    })));
  });

  it("다른 기기에서 연 설정 링크를 적용하고 주소를 정리한다", () => {
    window.history.replaceState({}, "", "/?guest=family&quickDock=sound.journey#game");
    render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={vi.fn()}
          onOpenMenu={vi.fn()}
        />
      </GameFeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "게임 도구 열기" }));
    expect(screen.getByRole("button", { name: /게임 사운드 (켜기|끄기)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여정 도구 열기" })).toBeInTheDocument();
    expect(window.location.search).toBe("?guest=family");
    expect(window.location.hash).toBe("#game");
  });

  it("이동과 근접 상호작용 상태에서는 보조 버튼을 자동으로 줄인다", () => {
    const { rerender } = render(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={vi.fn()}
          onOpenMenu={vi.fn()}
          moving
        />
      </GameFeedbackProvider>
    );

    expect(screen.queryByRole("button", { name: "하객 리액션 열기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "공지·FAQ 열기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "초대장 메뉴" })).toBeInTheDocument();

    rerender(
      <GameFeedbackProvider initialPreferences={defaultFeedbackPreferences}>
        <GameQuickDock
          menuOpen={false}
          menuButtonRef={createRef<HTMLButtonElement>()}
          onPause={vi.fn()}
          onReact={vi.fn()}
          onGuestInformationOpenChange={vi.fn()}
          onOpenJourney={vi.fn()}
          onOpenMenu={vi.fn()}
          routeActive
        />
      </GameFeedbackProvider>
    );
    expect(screen.getByRole("button", { name: "여정 도구 열기" })).toBeInTheDocument();
  });
});
