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
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
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
    this.emit("message", new MessageEvent("message", { data: JSON.stringify(message) }));
  }
}

beforeEach(() => {
  animationFrames = new Map();
  nextAnimationFrameId = 1;
  MockWebSocket.instances = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  animationFrames.clear();
});

function advanceAnimation(now: number) {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  act(() => callbacks.forEach((callback) => callback(now)));
}

function finishCurrentRoute() {
  for (let index = 0; index < 40 && animationFrames.size > 0; index += 1) {
    advanceAnimation(index * 240);
  }
}

function mockMapRect(map: HTMLElement, width = 390, height = 520) {
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 10 + width,
    bottom: 20 + height,
    width,
    height,
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
    x: 165,
    y: 405,
    direction: "down",
    moving: false,
    seq: 0,
    zoneId: "home",
    lastSeenAt: 1000,
    ...overrides
  };
}

describe("GameWorld", () => {
  const profile = { nickname: "하객1", appearance: defaultCharacterAppearance };

  it("starts at home and renders a non-clickable ten-stop journey", () => {
    render(<GameWorld profile={profile} />);
    const journey = screen.getByLabelText("하객 여정");

    expect(screen.getByLabelText("우리 집 지도")).toHaveAttribute("data-zone", "home");
    expect(within(journey).getAllByRole("listitem")).toHaveLength(10);
    expect(within(journey).queryAllByRole("button")).toHaveLength(0);
    expect(within(journey).getByText("우리 집").closest("li")).toHaveAttribute("aria-current", "location");
    expect(screen.queryByLabelText("맵 구역 이동")).not.toBeInTheDocument();
  });

  it("keeps a display-only minimap in sync with portal travel and zone changes", () => {
    render(<GameWorld profile={profile} />);
    let minimap = screen.getByRole("complementary", { name: "현재 구역 미니맵" });

    expect(within(minimap).getByText("우리 집")).toBeInTheDocument();
    expect(within(minimap).queryByRole("button")).not.toBeInTheDocument();
    expect(within(minimap).getByTestId("minimap-portal")).not.toHaveClass("world-minimap__portal--target");

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    expect(within(minimap).getByTestId("minimap-portal")).toHaveClass("world-minimap__portal--target");

    finishCurrentRoute();
    minimap = screen.getByRole("complementary", { name: "현재 구역 미니맵" });
    expect(within(minimap).getByText("동네 거리")).toBeInTheDocument();
    expect(within(minimap).getAllByTestId("minimap-portal")).toHaveLength(2);
  });

  it.each([
    ["가상 조이스틱", () => screen.getByLabelText("가상 조이스틱")],
    ["초대장 메뉴", () => screen.getByRole("button", { name: "초대장 메뉴" })],
    ["현재 구역 미니맵", () => screen.getByRole("complementary", { name: "현재 구역 미니맵" })]
  ])("ignores map movement when %s is clicked", (_label, getControl) => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(getControl(), { clientX: 350, clientY: 450 });
    advanceAnimation(0);

    expect(player).toHaveStyle({ left: "135px", top: "405px" });
  });

  it("opens invitation content without teleporting to its map", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "축하 쓰기" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("축하 메시지");
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
  });

  it("does not change zones until the player reaches the clicked portal", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByText("동네로 나가기까지 이동 중")).toBeInTheDocument();

    advanceAnimation(0);
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();

    finishCurrentRoute();
    expect(screen.getByLabelText("동네 거리 지도")).toHaveAttribute("data-zone", "neighborhood");
    expect(screen.getByText("동네 거리 도착")).toBeInTheDocument();
  });

  it("cancels portal walking when another map point is clicked", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByLabelText("우리 집 지도");
    mockMapRect(map);

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);
    fireEvent.click(map, { clientX: 265, clientY: 280 });
    finishCurrentRoute();

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByText("포털 이동을 취소했어요")).toBeInTheDocument();
  });

  it("cancels portal walking when the joystick receives input", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);

    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(240);
    fireEvent.keyUp(joystick, { key: "ArrowLeft" });

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByText("포털 이동을 취소했어요")).toBeInTheDocument();
  });

  it("enters a portal immediately when joystick movement reaches its approach tile", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    advanceAnimation(300);
    advanceAnimation(540);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    fireEvent.keyDown(joystick, { key: "ArrowUp" });
    for (const now of [600, 900, 1140, 1380, 1620, 1860, 2100, 2340]) {
      advanceAnimation(now);
    }

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "225px", top: "165px" });

    advanceAnimation(2580);
    fireEvent.keyUp(joystick, { key: "ArrowUp" });

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "285px" });
    expect(screen.getByText("동네 거리 도착")).toBeInTheDocument();
  });

  it("renders the actual world dimensions, pixel coordinates, and camera transform", () => {
    const { container } = render(<GameWorld profile={profile} />);
    const stage = screen.getByLabelText("우리 집 지도");
    const player = screen.getByLabelText("하객1");
    const window = container.querySelector('[data-decoration="window"]');

    expect(stage).toHaveStyle({ width: "480px", height: "600px" });
    expect(stage.style.transform).toContain("translate3d(");
    expect(player).toHaveStyle({ left: "135px", top: "405px" });
    expect(window).toHaveStyle({ left: "270px", top: "65px" });
  });

  it("inverse-transforms map clicks and moves one grid tile at a time", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(map, { clientX: 265, clientY: 280 });
    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "165px", top: "405px" });
    advanceAnimation(239);
    expect(player).toHaveStyle({ left: "165px" });
    advanceAnimation(240);
    expect(player).toHaveStyle({ left: "195px" });
  });

  it("keeps remote guests isolated to the active zone", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest(), serverGuest({ guestId: "guest_lobby", nickname: "로비 하객", zoneId: "lobby" })]
    }));

    expect(screen.getByLabelText("하객2")).toHaveStyle({ left: "165px", top: "405px" });
    expect(screen.queryByLabelText("로비 하객")).not.toBeInTheDocument();
  });

  it("sends the destination zone only after portal arrival", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);
    expect(socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move").every((message) => message.zoneId === "home")).toBe(true);

    finishCurrentRoute();
    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves.at(-1)).toMatchObject({ zoneId: "neighborhood", x: 135, y: 285, moving: false });
  });

  it("keeps local play available when realtime is full", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "error", code: "room_full" }));

    expect(screen.getByText("실시간 만석 · 솔로 모드")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    finishCurrentRoute();
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
  });

  it("advances the directional character frame for each tile", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const sprite = screen.getByLabelText("하객1 캐릭터");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    expect(sprite).not.toHaveClass("character-sprite--idle-front");

    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    expect(sprite).not.toHaveClass("character-sprite--idle-front");
  });
});
