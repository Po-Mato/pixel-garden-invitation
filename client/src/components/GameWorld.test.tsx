import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { defaultCharacterAppearance, getDefaultAppearance } from "@wedding-game/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "./GameWorld";

type MockListener = (event: Event) => void;

let animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly sentMessages: string[] = [];
  readonly listeners = new Map<string, MockListener[]>();
  readyState = MockWebSocket.OPEN;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: MockListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }

  emit(type: string, event: Event = new Event(type)) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  emitJson(message: unknown) {
    this.emit(
      "message",
      new MessageEvent("message", {
        data: JSON.stringify(message)
      })
    );
  }
}

beforeEach(() => {
  animationFrames = new Map();
  nextAnimationFrameId = 1;
  MockWebSocket.instances = [];

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

function configureRealtime() {
  vi.stubEnv("VITE_WORKER_URL", "https://worker.test/base");
  vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
  vi.stubGlobal("WebSocket", MockWebSocket);
}

function serverGuest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    guestId: "guest_remote",
    nickname: "하객2",
    appearance: getDefaultAppearance("masculine"),
    x: 39,
    y: 72,
    direction: "down",
    moving: false,
    seq: 0,
    zoneId: "ceremony",
    lastSeenAt: 1000,
    ...overrides
  };
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

function openInvitationMenu() {
  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  return screen.getByRole("dialog", { name: "초대장 바로가기" });
}

describe("GameWorld", () => {
  const profile = { nickname: "하객1", appearance: defaultCharacterAppearance };

  it("renders the active map zone and zone travel controls", () => {
    render(<GameWorld profile={profile} />);
    const zoneTabs = within(screen.getByLabelText("맵 구역 이동"));

    expect(screen.getByText("예식 안내")).toBeInTheDocument();
    expect(screen.getByText("신랑신부")).toBeInTheDocument();
    expect(screen.getByText("스토리")).toBeInTheDocument();
    expect(zoneTabs.getByRole("button", { name: "입구" })).toBeInTheDocument();
    expect(zoneTabs.getByRole("button", { name: "갤러리" })).toBeInTheDocument();
    expect(zoneTabs.getByRole("button", { name: "라운지" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "초대장 메뉴" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "길 찾기" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("예식장 지도")).toHaveAttribute("data-zone", "ceremony");
  });

  it("opens the invitation shortcuts in a dismissible menu dialog", () => {
    render(<GameWorld profile={profile} />);

    const menu = openInvitationMenu();
    expect(within(menu).getByRole("button", { name: "길 찾기" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "축하 쓰기" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "초대장 메뉴 닫기" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
  });

  it("renders exclusive bride and groom npc characters", () => {
    render(<GameWorld profile={profile} />);
    expect(screen.getByRole("button", { name: "신랑 이서준 소개 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "신부 김하린 소개 보기" })).toBeInTheDocument();
  });

  it("opens the couple panel when an npc is selected", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "신부 김하린 소개 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("신랑신부 정원");
  });

  it("opens a spot modal from an action button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(within(openInvitationMenu()).getByRole("button", { name: "예식 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("예식 안내");
  });

  it("opens a spot modal from a map spot button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(within(screen.getByLabelText("맵 구역 이동")).getByRole("button", { name: "갤러리" }));
    fireEvent.click(screen.getByRole("button", { name: "스토리 스토리 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("연애 스토리 꽃길");
  });

  it("moves between separated map zones from tabs and portals", () => {
    render(<GameWorld profile={profile} />);
    const zoneTabs = screen.getByLabelText("맵 구역 이동");

    fireEvent.click(within(zoneTabs).getByRole("button", { name: "라운지" }));

    expect(screen.getByLabelText("라운지 지도")).toHaveAttribute("data-zone", "lounge");
    expect(screen.getByRole("button", { name: "RSVP 답변하기" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("라운지 지도")).getByRole("button", { name: "예식장" }));

    expect(screen.getByLabelText("예식장 지도")).toHaveAttribute("data-zone", "ceremony");
    expect(screen.getByLabelText("하객1").style.left).toBe("73.07692307692307%");
  });

  it("closes the spot modal from the close button", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(within(openInvitationMenu()).getByRole("button", { name: "예식 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the close button and closes the spot modal with Escape", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(within(openInvitationMenu()).getByRole("button", { name: "예식 보기" }));

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab and Shift+Tab focus inside the spot modal", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(within(openInvitationMenu()).getByRole("button", { name: "예식 보기" }));

    const closeButton = screen.getByRole("button", { name: "닫기" });
    const underlyingAction = screen.getByRole("button", { name: "초대장 메뉴" });

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
    const coupleSpot = screen.getByRole("button", { name: "신랑신부 소개 보기" });

    expect(stage).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-zone", "ceremony");
    expect(stage).toHaveAttribute("data-logical-width", "390");
    expect(stage).toHaveAttribute("data-logical-height", "720");
    expect(coupleSpot.style.left).toMatch(/%$/);
    expect(coupleSpot.style.width).toMatch(/%$/);
    expect(coupleSpot.style.left).not.toBe("274px");
    expect(coupleSpot.style.width).not.toBe("82px");
  });

  it("moves the player one tile at a time when the map is clicked", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByLabelText("예식장 지도");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");
    const initialTop = player.style.top;

    fireEvent.click(map, { clientX: 205, clientY: 420 });
    advanceAnimation(0);

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("68.75%");
    expect(player.style.top).not.toBe(initialTop);

    advanceAnimation(239);

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("68.75%");

    advanceAnimation(240);

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("64.58333333333334%");
  });

  it("stops moving when the target is blocked", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByLabelText("예식장 지도");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(map, { clientX: 205, clientY: 120 });
    for (const now of [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920, 2160, 2400, 2640, 2880, 3120]) {
      advanceAnimation(now);
    }

    expect(player.style.left).toBe("50%");
    expect(player.style.top).toBe("18.75%");
    expect(pendingAnimationFrameCount()).toBe(0);
  });

  it("moves the player from joystick input one tile at a time", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);

    expect(player.style.left).toBe("57.692307692307686%");
    expect(player.style.top).toBe("72.91666666666666%");

    advanceAnimation(299);

    expect(player.style.left).toBe("57.692307692307686%");
    expect(player.style.top).toBe("72.91666666666666%");

    advanceAnimation(300);

    expect(player.style.left).toBe("65.38461538461539%");
    expect(player.style.top).toBe("72.91666666666666%");

    advanceAnimation(539);
    expect(player.style.left).toBe("65.38461538461539%");

    advanceAnimation(540);
    expect(player.style.left).toBe("73.07692307692307%");

    fireEvent.keyUp(joystick, { key: "ArrowRight" });
  });

  it("loads saved guestbook messages when the guestbook spot opens", async () => {
    vi.stubEnv("VITE_WORKER_URL", "https://worker.test/");
    vi.stubEnv("VITE_INVITATION_ID", "sample-garden");
    vi.stubGlobal("WebSocket", MockWebSocket);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              id: "guestbook_1",
              nickname: "하객2",
              message: "저장된 축하 메시지",
              createdAt: "2026-06-12T00:00:00.000Z"
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GameWorld profile={profile} />);
    fireEvent.click(within(openInvitationMenu()).getByRole("button", { name: "축하 쓰기" }));

    expect(await screen.findByText("저장된 축하 메시지")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "GET"
    });
  });

  it("connects to the realtime room and applies remote guest events", () => {
    configureRealtime();
    const { container } = render(<GameWorld profile={profile} />);
    const realtimePill = container.querySelector(".realtime-pill");

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe("wss://worker.test/rooms/sample-garden");
    expect(realtimePill).toHaveClass("realtime-pill--connecting");

    act(() => MockWebSocket.instances[0].emit("open"));

    expect(screen.getByText("실시간 정원")).toBeInTheDocument();
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).toEqual({
      type: "join",
      nickname: "하객1",
      appearance: defaultCharacterAppearance,
      zoneId: "ceremony"
    });
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).not.toHaveProperty("avatar");
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).not.toHaveProperty("color");

    act(() =>
      MockWebSocket.instances[0].emitJson({
        type: "welcome",
        guestId: "guest_self",
        guests: [serverGuest({ guestId: "guest_self", nickname: "서버의 나" }), serverGuest()]
      })
    );

    expect(screen.getByLabelText("하객2")).toHaveAttribute("data-remote-motion", "pixel-step-3");
    const remoteSprite = screen.getByLabelText("하객2 캐릭터");
    expect(remoteSprite.querySelector('[data-character-layer="base"]')).toHaveStyle({
      backgroundImage: expect.stringContaining("guests/world/masculine-navy-suit__walk.png")
    });
    expect(screen.queryByLabelText("서버의 나")).not.toBeInTheDocument();

    act(() =>
      MockWebSocket.instances[0].emitJson({
        type: "guest_moved",
        guestId: "guest_remote",
        position: { x: 78, y: 144, direction: "right", moving: true, seq: 1, zoneId: "ceremony" }
      })
    );

    expect(screen.getByLabelText("하객2")).toHaveStyle({ left: "20%", top: "20%" });

    act(() =>
      MockWebSocket.instances[0].emitJson({
        type: "guest_joined",
        guest: serverGuest({ guestId: "guest_joined", nickname: "하객4", x: 117, y: 216 })
      })
    );

    expect(screen.getByLabelText("하객4")).toBeInTheDocument();

    act(() => MockWebSocket.instances[0].emitJson({ type: "guest_left", guestId: "guest_joined" }));

    expect(screen.queryByLabelText("하객4")).not.toBeInTheDocument();

    act(() =>
      MockWebSocket.instances[0].emitJson({
        type: "room_state",
        guests: [serverGuest({ guestId: "guest_state", nickname: "하객3", x: 156, y: 288 })]
      })
    );

    expect(screen.queryByLabelText("하객2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("하객3")).toBeInTheDocument();

    act(() => MockWebSocket.instances[0].emit("close"));

    expect(realtimePill).toHaveClass("realtime-pill--reconnecting");
  });

  it("sends throttled realtime movement updates while the local player moves", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];

    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const map = screen.getByLabelText("예식장 지도");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 205, clientY: 300 });
    advanceAnimation(100);
    advanceAnimation(339);
    advanceAnimation(340);

    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");

    expect(moves).toHaveLength(2);
    expect(moves.map((message) => message.seq)).toEqual([2, 3]);
    expect(moves.every((message) => message.direction === "up" && message.moving === true)).toBe(true);
    expect(moves.every((message) => message.zoneId === "ceremony")).toBe(true);
  });

  it("reconnects and restores the latest zone position", () => {
    vi.useFakeTimers();
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const firstSocket = MockWebSocket.instances[0];

    act(() => firstSocket.emit("open"));
    act(() => firstSocket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    fireEvent.click(within(screen.getByLabelText("맵 구역 이동")).getByRole("button", { name: "라운지" }));

    act(() => firstSocket.emit("close"));
    expect(screen.getByText("실시간 재연결 중")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(500));
    expect(MockWebSocket.instances).toHaveLength(2);

    const secondSocket = MockWebSocket.instances[1];
    act(() => secondSocket.emit("open"));
    expect(JSON.parse(secondSocket.sentMessages[0])).toMatchObject({ type: "join", zoneId: "lounge" });

    act(() => secondSocket.emitJson({ type: "welcome", guestId: "guest_reconnected", guests: [] }));
    const restoredMove = secondSocket.sentMessages.map((message) => JSON.parse(message)).find((message) => message.type === "move");

    expect(restoredMove).toMatchObject({
      x: 135,
      y: 405,
      direction: "down",
      moving: false,
      zoneId: "lounge"
    });
    expect(screen.getByText("실시간 정원")).toBeInTheDocument();
  });

  it("keeps local map play available when the realtime room is full", () => {
    vi.useFakeTimers();
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];

    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest()]
    }));
    expect(screen.getByLabelText("하객2")).toBeInTheDocument();

    act(() => socket.emitJson({ type: "error", code: "room_full" }));
    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.getByText("실시간 만석 · 솔로 모드")).toBeInTheDocument();
    expect(screen.queryByLabelText("하객2")).not.toBeInTheDocument();
    expect(MockWebSocket.instances).toHaveLength(1);

    fireEvent.click(within(screen.getByLabelText("맵 구역 이동")).getByRole("button", { name: "라운지" }));
    expect(screen.getByLabelText("라운지 지도")).toHaveAttribute("data-zone", "lounge");
  });

  it("announces zone travel and only renders guests in the active zone", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];

    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [
        serverGuest({ guestId: "guest_ceremony", nickname: "예식장 하객" }),
        serverGuest({ guestId: "guest_lounge", nickname: "라운지 하객", zoneId: "lounge", x: 135, y: 405 })
      ]
    }));

    expect(screen.getByLabelText("예식장 하객")).toBeInTheDocument();
    expect(screen.queryByLabelText("라운지 하객")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("맵 구역 이동")).getByRole("button", { name: "라운지" }));

    expect(screen.queryByLabelText("예식장 하객")).not.toBeInTheDocument();
    expect(screen.getByLabelText("라운지 하객")).toBeInTheDocument();

    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves.at(-1)).toMatchObject({
      zoneId: "lounge",
      x: 135,
      y: 405,
      moving: false,
      direction: "down"
    });
  });

  it("renders local layers and advances the walk frame once per tile", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const sprite = screen.getByLabelText("하객1 캐릭터");
    const baseLayer = sprite.querySelector('[data-character-layer="base"]');

    expect(baseLayer).toBeInTheDocument();
    expect(sprite).toHaveClass("character-sprite--idle-front");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);

    expect(sprite).not.toHaveClass("character-sprite--idle-front");
    expect(baseLayer).toHaveStyle({ backgroundPosition: "-48px -72px" });

    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    expect(baseLayer).toHaveStyle({ backgroundPosition: "-24px -72px" });
  });
});
