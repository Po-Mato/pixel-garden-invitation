import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { defaultCharacterAppearance, getDefaultAppearance, type WorldZoneId } from "@wedding-game/shared";
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
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
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
  act(() => callbacks.forEach((callback) => callback(now)));
}

function advanceRouteToPortalArrival() {
  for (let index = 0; index < 50 && animationFrames.size > 0; index += 1) {
    advanceAnimation(index * 240);
  }
  expect(animationFrames.size, "portal route did not reach arrival within 50 animation frames").toBe(0);
}

function advancePortalTransition() {
  act(() => vi.advanceTimersByTime(150));
  act(() => vi.advanceTimersByTime(250));
  fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
  act(() => vi.advanceTimersByTime(300));
}

function walkHomeToPortalEntrance(joystick: HTMLElement) {
  const move = (key: string, times: number[]) => {
    fireEvent.keyDown(joystick, { key });
    times.forEach(advanceAnimation);
    fireEvent.keyUp(joystick, { key });
  };

  move("ArrowLeft", [0, 300]);
  move("ArrowUp", [600, 900, 1140, 1380, 1620, 1860, 2100, 2340, 2580]);
  move("ArrowRight", [2880, 3180]);
  fireEvent.keyDown(joystick, { key: "ArrowUp" });
  [3420, 3720, 3960, 4200, 4440].forEach(advanceAnimation);
}

function walkHomeToPortalWithHeldUp(joystick: HTMLElement) {
  walkHomeToPortalEntrance(joystick);
  advanceAnimation(4680);
}

function finishPortalFadeOut() {
  act(() => vi.advanceTimersByTime(250));
  fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
}

function fireTransitionEnd(element: Element, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  })));
}

function finishCurrentRoute() {
  advanceRouteToPortalArrival();
  advancePortalTransition();
}

function travelThroughPortal(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  finishCurrentRoute();
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

  function expectMapBackground(container: HTMLElement, zoneId: WorldZoneId) {
    const stage = screen.getByLabelText(/지도$/);
    const background = container.querySelector(".world-map-artwork__background");

    expect(stage.firstElementChild).toHaveClass("world-map-artwork");
    expect(background).toHaveAttribute("src", expect.stringContaining(`/assets/maps/v2/${zoneId}/background.webp`));
  }

  it("starts at home and renders a non-clickable ten-stop journey", () => {
    render(<GameWorld profile={profile} />);
    const journey = screen.getByLabelText("하객 여정");

    expect(screen.getByLabelText("우리 집 지도")).toHaveAttribute("data-zone", "home");
    expect(within(journey).getAllByRole("listitem")).toHaveLength(10);
    expect(within(journey).queryAllByRole("button")).toHaveLength(0);
    expect(within(journey).getByText("우리 집").closest("li")).toHaveAttribute("aria-current", "location");
    expect(screen.queryByLabelText("맵 구역 이동")).not.toBeInTheDocument();
  });

  it("uses fallback path visuals only while the map background is unavailable", () => {
    const { container } = render(<GameWorld profile={profile} />);
    const stage = screen.getByLabelText("우리 집 지도");
    const background = container.querySelector(".world-map-artwork__background") as HTMLImageElement;

    expect(stage).not.toHaveClass("world-map__stage--background-loaded");
    fireEvent.load(background);
    expect(stage).toHaveClass("world-map__stage--background-loaded");
    fireEvent.error(background);
    expect(stage).not.toHaveClass("world-map__stage--background-loaded");
  });

  it("restores fallback paths when returning to a previously loaded zone", () => {
    const { container } = render(<GameWorld profile={profile} />);
    const homeBackground = container.querySelector(".world-map-artwork__background") as HTMLImageElement;

    fireEvent.load(homeBackground);
    expect(screen.getByLabelText("우리 집 지도")).toHaveClass("world-map__stage--background-loaded");

    travelThroughPortal("동네로 나가기");
    expect(screen.getByLabelText("동네 거리 지도")).not.toHaveClass("world-map__stage--background-loaded");

    travelThroughPortal("집으로 돌아가기");
    expect(screen.getByLabelText("우리 집 지도")).not.toHaveClass("world-map__stage--background-loaded");
  });

  it("updates map artwork for every zone reached through the journey", () => {
    const { container } = render(<GameWorld profile={profile} />);

    expectMapBackground(container, "home");

    ([
      ["동네로 나가기", "neighborhood"],
      ["지하철역 들어가기", "subway-station"],
      ["열차 타기", "subway-train"],
      ["예식장역 내리기", "venue-exterior"],
      ["예식장 로비 들어가기", "lobby"],
      ["신부 대기실", "bridal-room"],
      ["로비로 돌아가기", "lobby"],
      ["화장실", "restroom"],
      ["로비로 돌아가기", "lobby"],
      ["예식홀", "ceremony-hall"],
      ["연회장으로", "banquet"]
    ] as const).forEach(([portalLabel, zoneId]) => {
      travelThroughPortal(portalLabel);
      expectMapBackground(container, zoneId);
    });
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

    expect(player).toHaveStyle({ left: "285px", top: "555px" });
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

  it("shows portal arrival before fading into the destination map", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");

    act(() => vi.advanceTimersByTime(149));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");

    act(() => vi.advanceTimersByTime(249));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "375px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("uses the same delayed portal transition after clicking a portal", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));

    advanceRouteToPortalArrival();

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    finishPortalFadeOut();
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");
  });

  it("moves on the first arrow key after a clicked portal finishes fading in", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    advancePortalTransition();

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(4000);

    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "165px", top: "375px" });
  });

  it("ignores map and directional input during transition, then resumes after fade-in", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const joystick = screen.getByLabelText("가상 조이스틱");
    mockMapRect(map);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    fireEvent.click(map, { clientX: 350, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(3000);
    fireEvent.keyUp(joystick, { key: "ArrowLeft" });

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");

    fireEvent.click(map, { clientX: 350, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowDown" });
    advanceAnimation(3240);
    fireEvent.keyUp(joystick, { key: "ArrowDown" });

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });

    finishPortalFadeOut();
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");

    fireEvent.click(map, { clientX: 350, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(3480);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "375px" });

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");

    fireEvent.click(map, { clientX: 350, clientY: 450 });
    advanceAnimation(0);

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "405px" });

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(3240);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "165px", top: "405px" });
  });

  it("uses the same arrival and fade stages for the neighborhood station portal", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));
    finishPortalFadeOut();
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("button", { name: "지하철역 들어가기" }));
    advanceRouteToPortalArrival();

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "1095px", top: "375px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    finishPortalFadeOut();
    expect(screen.getByLabelText("지하철 역사 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("returns from the subway station to the safe neighborhood east spawn", () => {
    render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");
    travelThroughPortal("거리로 나가기");

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "1065px", top: "375px" });
  });

  it("renders the subway gate fronts above guests at the shared gate depth", () => {
    const { container } = render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");

    const stage = screen.getByLabelText("지하철 역사 지도");
    const gateFronts = [...container.querySelectorAll('img[data-decoration="ticket-gate"]')];

    expect(stage).toHaveStyle({ width: "900px", height: "840px" });
    expect(gateFronts).toHaveLength(3);
    for (const [gate, x] of gateFronts.map((item, index) => [item, 360 + index * 90] as const)) {
      expect(gate).toHaveAttribute("src", "/assets/maps/v2/subway-station/ticket-gate-front.png");
      expect(gate).toHaveStyle({ left: `${x}px`, top: "360px", width: "60px", height: "120px", zIndex: "1480" });
    }
  });

  it("waits for the overlay opacity transition before swapping maps", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));

    const overlay = screen.getByTestId("world-portal-transition");
    const child = document.createElement("span");
    overlay.append(child);

    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();

    fireTransitionEnd(overlay, "transform");
    fireTransitionEnd(child, "opacity");
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();

    fireTransitionEnd(overlay, "opacity");
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(overlay).toHaveAttribute("data-phase", "fade-in");

    fireTransitionEnd(overlay, "opacity");
    expect(overlay).toHaveAttribute("data-phase", "fade-in");
    act(() => vi.advanceTimersByTime(300));
    expect(overlay).toHaveAttribute("data-phase", "idle");
  });

  it("uses a late fallback when the opacity transition event is missing", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));

    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");
  });

  it("uses the 250ms state timing for reduced motion", () => {
    mockReducedMotion(true);
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));

    act(() => vi.advanceTimersByTime(249));
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
  });

  it("keeps a held joystick disabled until its release after fading in", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");

    walkHomeToPortalWithHeldUp(joystick);

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    act(() => vi.advanceTimersByTime(150));
    finishPortalFadeOut();
    act(() => vi.advanceTimersByTime(300));

    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(joystick, { key: "ArrowUp", repeat: true });
    fireEvent.keyDown(joystick, { key: "ArrowUp", repeat: true });
    advanceAnimation(4000);
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "375px" });
    expect(joystick.querySelector("span")).toHaveStyle({ transform: "translate(0px, 0px)" });

    screen.getByRole("button", { name: "초대장 메뉴" }).focus();
    fireEvent.keyUp(window, { key: "ArrowUp" });
    expect(joystick).toHaveAttribute("aria-disabled", "false");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(5000);
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "165px", top: "375px" });
  });

  it("preserves the held-input release latch across a second clicked portal transition", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");

    walkHomeToPortalWithHeldUp(joystick);
    advancePortalTransition();

    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "집으로 돌아가기" }));
    advanceRouteToPortalArrival();
    advancePortalTransition();

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(joystick).toHaveAttribute("aria-disabled", "true");

    fireEvent.keyUp(joystick, { key: "ArrowUp" });
    expect(joystick).toHaveAttribute("aria-disabled", "false");
  });

  it("blocks direct menu and spot activation throughout every portal transition phase", () => {
    render(<GameWorld profile={profile} />);
    const menuButton = screen.getByRole("button", { name: "초대장 메뉴" });
    const spotButton = screen.getByRole("button", { name: /오시는 길/ });

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    fireEvent.click(menuButton);
    fireEvent.click(spotButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");
    fireEvent.click(menuButton);
    fireEvent.click(spotButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    finishPortalFadeOut();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");
    fireEvent.click(menuButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks NPC activation during fade-in, arrival, and fade-out", () => {
    render(<GameWorld profile={profile} />);
    for (const portalLabel of [
      "동네로 나가기",
      "지하철역 들어가기",
      "열차 타기",
      "예식장역 내리기",
      "예식장 로비 들어가기"
    ]) {
      travelThroughPortal(portalLabel);
    }

    fireEvent.click(screen.getByRole("button", { name: "신부 대기실" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));
    finishPortalFadeOut();

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");
    const npcButton = screen.getByRole("button", { name: "신부 김하린 소개 보기" });
    fireEvent.click(npcButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    advanceRouteToPortalArrival();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    fireEvent.click(npcButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");
    fireEvent.click(npcButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    finishPortalFadeOut();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["menu", () => fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }))],
    ["spot", () => {
      fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "축하 쓰기" }));
    }]
  ])("closes an open %s dialog when portal arrival starts", (_kind, openDialog) => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    advanceRouteToPortalArrival();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
  });

  it("renders the actual world dimensions, pixel coordinates, and camera transform", () => {
    render(<GameWorld profile={profile} />);
    const stage = screen.getByLabelText("우리 집 지도");
    const player = screen.getByLabelText("하객1");

    expect(stage).toHaveStyle({ width: "600px", height: "720px" });
    expect(stage.style.transform).toContain("translate3d(");
    expect(player).toHaveStyle({ left: "285px", top: "555px", zIndex: "1555" });
  });

  it("keeps portals and information buttons above map depth layers", () => {
    render(<GameWorld profile={profile} />);

    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveStyle({ zIndex: "9000" });
    expect(screen.getByRole("button", { name: /오시는 길/ })).toHaveStyle({ zIndex: "9000" });
  });

  it("inverse-transforms map clicks and moves one grid tile at a time", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(map, { clientX: 265, clientY: 280 });
    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "315px", top: "555px" });
    advanceAnimation(239);
    expect(player).toHaveStyle({ left: "315px" });
    advanceAnimation(240);
    expect(player).toHaveStyle({ left: "345px" });
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

    expect(screen.getByLabelText("하객2")).toHaveStyle({ left: "165px", top: "405px", zIndex: "1405" });
    expect(screen.queryByLabelText("로비 하객")).not.toBeInTheDocument();
  });

  it("uses shared Y depth for NPCs", () => {
    render(<GameWorld profile={profile} />);
    for (const portalLabel of [
      "동네로 나가기",
      "지하철역 들어가기",
      "열차 타기",
      "예식장역 내리기",
      "예식장 로비 들어가기",
      "신부 대기실"
    ]) {
      travelThroughPortal(portalLabel);
    }

    expect(screen.getByRole("button", { name: "신부 김하린 소개 보기" }).parentElement)
      .toHaveStyle({ zIndex: "1225" });
  });

  it("sends one final approach move before the destination spawn", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    const approachMoves = socket.sentMessages
      .map((message) => JSON.parse(message))
      .filter((message) => message.type === "move");

    expect(approachMoves.every((message) => message.zoneId === "home")).toBe(true);
    expect(approachMoves.filter((message) => (
      message.x === 285 && message.y === 105 && message.moving === false && message.direction === "up"
    ))).toHaveLength(1);

    advancePortalTransition();
    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves.at(-1)).toMatchObject({ zoneId: "neighborhood", x: 135, y: 375, moving: false });
  });

  it("sends an immediate final stop when an approach portal click is inside the throttle window", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));

    const joystick = screen.getByLabelText("가상 조이스틱");
    walkHomeToPortalEntrance(joystick);
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "135px" });
    socket.sentMessages.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    let moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ zoneId: "home", x: 285, y: 105, moving: false, direction: "up" });

    act(() => vi.advanceTimersByTime(150));
    finishPortalFadeOut();
    fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
    moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves).toHaveLength(2);
    expect(moves[1]).toMatchObject({ zoneId: "neighborhood", x: 135, y: 375, moving: false });
    expect(moves[1].seq).toBe(moves[0].seq + 1);
  });

  it("does not repeat the destination spawn when the cleared fade-out fallback would expire", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceRouteToPortalArrival();
    act(() => vi.advanceTimersByTime(150));
    finishPortalFadeOut();

    const destinationMoves = () => socket.sentMessages
      .map((message) => JSON.parse(message))
      .filter((message) => message.type === "move" && message.zoneId === "neighborhood");

    expect(destinationMoves()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(destinationMoves()).toHaveLength(1);
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
