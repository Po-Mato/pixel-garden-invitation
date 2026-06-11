import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "./GameWorld";

let animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

beforeEach(() => {
  animationFrames = new Map();
  nextAnimationFrameId = 1;

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrames.set(id, callback);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      animationFrames.delete(id);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  animationFrames.clear();
});

function advanceAnimation(now: number) {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();

  act(() => {
    callbacks.forEach((callback) => callback(now));
  });
}

function pendingAnimationFrameCount() {
  return animationFrames.size;
}

function mockMapRect(map: HTMLElement) {
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 400,
    bottom: 740,
    width: 390,
    height: 720,
    toJSON: () => ({})
  } as DOMRect);
}

function pressTabWithBrowserFallback(targetIfUntrapped: HTMLElement, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Tab",
    shiftKey
  });

  document.dispatchEvent(event);

  if (!event.defaultPrevented) {
    targetIfUntrapped.focus();
  }

  return event;
}

describe("GameWorld", () => {
  const profile = { nickname: "하객1", avatar: "classic", color: "rose" } as const;

  it("renders all MVP spots", () => {
    render(<GameWorld profile={profile} />);
    expect(screen.getByText("예식 안내")).toBeInTheDocument();
    expect(screen.getByText("오시는 길")).toBeInTheDocument();
    expect(screen.getByText("RSVP")).toBeInTheDocument();
    expect(screen.getByText("방명록")).toBeInTheDocument();
    expect(screen.getByText("신랑신부")).toBeInTheDocument();
    expect(screen.getByText("갤러리")).toBeInTheDocument();
    expect(screen.getByText("스토리")).toBeInTheDocument();
  });

  it("opens a spot modal from an action button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("예식 안내");
  });

  it("opens a spot modal from a map spot button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "스토리 스토리 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("연애 스토리 꽃길");
  });

  it("closes the spot modal from the close button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the close button and closes the spot modal with Escape", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab and Shift+Tab focus inside the spot modal", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));

    const closeButton = screen.getByRole("button", { name: "닫기" });
    const underlyingAction = screen.getByRole("button", { name: "길 찾기" });

    expect(closeButton).toHaveFocus();

    const tabEvent = pressTabWithBrowserFallback(underlyingAction);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(closeButton).toHaveFocus();

    const shiftTabEvent = pressTabWithBrowserFallback(underlyingAction, true);

    expect(shiftTabEvent.defaultPrevented).toBe(true);
    expect(closeButton).toHaveFocus();
    expect(underlyingAction).not.toHaveFocus();
  });

  it("renders spots inside a scalable logical map stage", () => {
    const { container } = render(<GameWorld profile={profile} />);
    const stage = container.querySelector(".world-map__stage");
    const rsvpSpot = screen.getByRole("button", { name: "RSVP 답변하기" });

    expect(stage).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-logical-width", "390");
    expect(stage).toHaveAttribute("data-logical-height", "720");
    expect(rsvpSpot.style.left).toMatch(/%$/);
    expect(rsvpSpot.style.width).toMatch(/%$/);
    expect(rsvpSpot.style.left).not.toBe("274px");
    expect(rsvpSpot.style.width).not.toBe("82px");
  });

  it("moves the player when the map is clicked", () => {
    render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
    const map = screen.getByLabelText("정원 지도");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");
    const initialTop = player.style.top;

    fireEvent.click(map, { clientX: 205, clientY: 420 });
    advanceAnimation(0);
    advanceAnimation(1000);

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("55.55555555555556%");
    expect(player.style.top).not.toBe(initialTop);
  });

  it("stops moving when the target is blocked", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByLabelText("정원 지도");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(map, { clientX: 284, clientY: 600 });
    advanceAnimation(0);
    advanceAnimation(1000);

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("72.22222222222221%");
    expect(pendingAnimationFrameCount()).toBe(0);
  });

  it("moves the player from joystick input", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    advanceAnimation(1000);

    expect(player.style.left).toBe("80.76923076923077%");
    expect(player.style.top).toBe("72.22222222222221%");

    fireEvent.keyUp(joystick, { key: "ArrowRight" });
  });
});
