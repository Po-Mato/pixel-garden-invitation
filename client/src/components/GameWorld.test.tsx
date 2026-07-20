import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  defaultCharacterAppearance,
  getDefaultAppearance,
  invitationContent,
  type WorldZoneId
} from "@wedding-game/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { worldDepth } from "../game/worldVisuals";
import { copyText } from "../invitation/browserActions";
import { GameWorld } from "./GameWorld";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn()
}));

const groomNpcLabel = `신랑 ${invitationContent.event.couple.groom}`;
const brideNpcLabel = `신부 ${invitationContent.event.couple.bride}`;

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
  vi.mocked(copyText).mockResolvedValue(undefined);
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
  for (let index = 0; index < 70 && animationFrames.size > 0; index += 1) {
    advanceAnimation(index * 240);
  }
  expect(animationFrames.size, "portal route did not reach arrival within 70 animation frames").toBe(0);
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

function walkHomeToPortalRightEdge(joystick: HTMLElement) {
  const move = (key: string, times: number[]) => {
    fireEvent.keyDown(joystick, { key });
    times.forEach(advanceAnimation);
    fireEvent.keyUp(joystick, { key });
  };

  move("ArrowLeft", [0, 300]);
  move("ArrowUp", [600, 900, 1140, 1380, 1620, 1860, 2100, 2340, 2580]);
  move("ArrowRight", [2880, 3180, 3420]);
  fireEvent.keyDown(joystick, { key: "ArrowUp" });
  [3660, 3960, 4200, 4440, 4680, 4920].forEach(advanceAnimation);
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

function travelFromHomeToLobby() {
  for (const portalLabel of [
    "동네로 나가기",
    "지하철역 들어가기",
    "열차 타기",
    "예식장역 내리기",
    "예식장 로비 들어가기"
  ]) {
    travelThroughPortal(portalLabel);
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

  function expectMapBackground(container: HTMLElement, zoneId: WorldZoneId) {
    const stage = screen.getByLabelText(/지도$/);
    const background = container.querySelector(".world-map-artwork__background");

    expect(stage.firstElementChild).toHaveClass("world-map-artwork");
    expect(background).toHaveAttribute("src", expect.stringContaining(`/assets/maps/v2/${zoneId}/background.webp`));
  }

  it("starts at home and jumps directly to a selected journey zone", () => {
    render(<GameWorld profile={profile} />);
    const journey = screen.getByLabelText("하객 여정");

    expect(screen.getByLabelText("우리 집 지도")).toHaveAttribute("data-zone", "home");
    expect(within(journey).getAllByRole("listitem")).toHaveLength(10);
    expect(within(journey).getAllByRole("button")).toHaveLength(10);
    expect(within(journey).getByText("우리 집").closest("li")).toHaveAttribute("aria-current", "location");

    fireEvent.click(within(journey).getByRole("button", { name: "예식홀 바로 이동" }));

    expect(screen.getByLabelText("예식홀 지도")).toHaveAttribute("data-zone", "ceremony-hall");
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "375px", top: "1785px" });
    expect(within(journey).getByText("예식홀").closest("li")).toHaveAttribute("aria-current", "location");
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
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
      ["연회장", "banquet"],
      ["화장실", "restroom"],
      ["연회장으로 돌아가기", "banquet"],
      ["로비로 돌아가기", "lobby"],
      ["예식홀", "ceremony-hall"]
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

  it.each([
    ["menu", () => {
      fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "답변하기" }));
    }],
    ["world spot", () => {
      fireEvent.click(screen.getByRole("button", { name: "예식장 로비 바로 이동" }));
      fireEvent.click(screen.getByRole("button", { name: "축의대 답변하기" }));
    }]
  ])("opens the shared RSVP panel from the %s without moving during form input", (_source, openRsvp) => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    openRsvp();
    const before = { left: player.style.left, top: player.style.top };
    const dialog = screen.getByRole("dialog", { name: "참석 답변" });
    fireEvent.click(within(dialog).getByLabelText("이름"));
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: "김하객" } });
    fireEvent.click(within(dialog).getByLabelText("신부측"));
    advanceAnimation(0);

    expect(within(dialog).getByRole("button", { name: "참석 답변 보내기" })).toBeInTheDocument();
    expect(player).toHaveStyle(before);
  });

  it("shows detailed wedding information in the invitation menu", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });

    const timeRange = menu.querySelector(".wedding-event-summary__date strong");
    expect(timeRange)
      .toHaveTextContent("오후 5시 10분 - 오후 6시 40분");
    expect(timeRange?.querySelector('time[datetime="2027-05-01T17:10:00+09:00"]'))
      .toHaveTextContent("오후 5시 10분");
    expect(timeRange?.querySelector('time[datetime="2027-05-01T18:40:00+09:00"]'))
      .toHaveTextContent("오후 6시 40분");
    expect(within(menu).getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
    expect(within(menu).getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "주소 복사" })).toBeInTheDocument();
  });

  it("opens calendar choices from the menu without moving the player", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(player).toHaveStyle({ left: "285px", top: "555px" });
  });

  it("opens directions from the invitation detail without moving the player", async () => {
    const { container } = render(<GameWorld profile={profile} />);
    const player = container.querySelector<HTMLElement>(".world-player");
    const before = { left: player?.style.left, top: player?.style.top };

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const directionsButton = within(menu).getByRole("button", { name: "오시는 길" });
    const menuBackdrop = container.querySelector<HTMLElement>(".world-menu-backdrop");
    fireEvent.click(directionsButton);

    const directions = screen.getByRole("dialog", { name: "오시는 길" });
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(menuBackdrop).toHaveStyle({ zIndex: "8" });
    expect(menu).toHaveStyle({ zIndex: "9" });
    expect(player?.style.left).toBe(before.left);
    expect(player?.style.top).toBe(before.top);

    fireEvent.click(within(directions).getByRole("button", { name: "주소 복사" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("주소를 복사했습니다.")).toBeInTheDocument();
    expect(player?.style.left).toBe(before.left);
    expect(player?.style.top).toBe(before.top);

    fireEvent.click(within(directions).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(menu).not.toHaveAttribute("aria-hidden");
    expect(menuBackdrop?.style.zIndex).toBe("");
    expect(menu.style.zIndex).toBe("");
    expect(directionsButton).toHaveFocus();
    expect(player?.style.left).toBe(before.left);
    expect(player?.style.top).toBe(before.top);
  });

  it("closes only the directions sheet on Escape and restores its menu trigger", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const directionsButton = within(menu).getByRole("button", { name: "오시는 길" });
    fireEvent.click(directionsButton);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "초대장 바로가기" })).toBeInTheDocument();
    expect(directionsButton).toHaveFocus();
  });

  it("clears directions state when the invitation menu closes", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const closeButton = within(menu).getByRole("button", { name: "초대장 메뉴 닫기" });
    fireEvent.click(within(menu).getByRole("button", { name: "오시는 길" }));

    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
  });

  it("opens the directions sheet from the menu shortcut", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "길 찾기" }));

    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "오시는 길" })).toHaveTextContent("네이버지도");
    expect(screen.queryByText("MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다.")).not.toBeInTheDocument();
  });

  it("restores the persistent invitation menu button after closing directions opened from the menu shortcut", () => {
    render(<GameWorld profile={profile} />);
    const menuButton = screen.getByRole("button", { name: "초대장 메뉴" });
    fireEvent.click(menuButton);
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "길 찾기" }));

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    act(() => vi.advanceTimersByTime(0));

    expect(menuButton).toHaveFocus();
  });

  it("opens the directions sheet from the world directions spot", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));

    const directions = screen.getByRole("dialog", { name: "오시는 길" });
    expect(directions).toHaveTextContent("네이버지도");
    expect(directions).toHaveTextContent("주차 2시간 무료");
    expect(screen.queryByText("MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다.")).not.toBeInTheDocument();
  });

  it("pauses a started portal route when directions opens from the invitation details", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    expect(pausedAt).not.toEqual({ left: "285px", top: "555px" });

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "오시는 길" }));

    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    [240, 480, 720, 960].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    [1200, 1440, 1680].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("keeps a cancelled portal RAF stale after directions closes and accepts new input", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const joystick = screen.getByLabelText("가상 조이스틱");

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    Array.from({ length: 14 }, (_, index) => index * 240).forEach(advanceAnimation);
    expect(player).toHaveStyle({ left: "285px", top: "135px" });
    const staleTick = [...animationFrames.values()][0];
    expect(staleTick).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "오시는 길" }));
    expect(animationFrames.size).toBe(0);

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    expect(animationFrames.size).toBe(0);

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    const activeTick = [...animationFrames.values()][0];
    expect(activeTick).toBeDefined();

    act(() => staleTick?.(3360));
    expect(player).toHaveStyle({ left: "285px", top: "135px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect([...animationFrames.values()]).toEqual([activeTick]);

    advanceAnimation(3600);
    expect(player).toHaveStyle({ left: "315px", top: "135px" });
  });

  it("pauses a started map target when directions opens from the menu shortcut", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 265, clientY: 375 });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    expect(pausedAt).not.toEqual({ left: "285px", top: "555px" });

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "길 찾기" }));

    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    [240, 480, 720].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    [960, 1200].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
  });

  it("pauses held joystick input and sends a stop when directions opens from the world spot", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    expect(pausedAt).toEqual({ left: "315px", top: "555px" });

    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));

    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    [240, 480, 720].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");

    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves.at(-1)).toMatchObject({ x: 315, y: 555, direction: "right", moving: false, zoneId: "home" });

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    [960, 1200].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
    expect(joystick).toHaveAttribute("aria-disabled", "true");

    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    expect(joystick).toHaveAttribute("aria-disabled", "false");
  });

  it("confirms a terminal stop outside the worker throttle window", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    const priorMove = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(priorMove).toMatchObject({ x: 315, y: 555, direction: "right", moving: true, zoneId: "home" });

    fireEvent.keyDown(joystick, { key: "ArrowDown" });
    advanceAnimation(50);
    expect(player).toHaveStyle({ left: "315px", top: "585px" });
    expect(socket.sentMessages).toHaveLength(1);
    const pausedAt = {
      x: Number.parseInt(player.style.left, 10),
      y: Number.parseInt(player.style.top, 10)
    };

    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));

    const terminalStop = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(terminalStop).toMatchObject({
      x: priorMove.x,
      y: priorMove.y,
      direction: "down",
      moving: false,
      zoneId: priorMove.zoneId,
      seq: priorMove.seq + 1
    });

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    act(() => vi.advanceTimersByTime(100));
    expect(socket.sentMessages).toHaveLength(2);

    act(() => vi.advanceTimersByTime(25));
    const confirmedStop = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(socket.sentMessages).toHaveLength(3);
    expect(confirmedStop).toMatchObject({
      x: pausedAt.x,
      y: pausedAt.y,
      direction: "down",
      moving: false,
      zoneId: "home",
      seq: terminalStop.seq + 1
    });
  });

  it("confirms a terminal stop when the last transmitted state was unacknowledged", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    const priorStop = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(priorStop).toMatchObject({ x: 285, y: 555, moving: false, zoneId: "home" });
    socket.sentMessages.length = 0;

    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));

    const terminalStop = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(socket.sentMessages).toHaveLength(1);
    expect(terminalStop).toMatchObject({
      x: priorStop.x,
      y: priorStop.y,
      moving: false,
      zoneId: priorStop.zoneId,
      seq: priorStop.seq + 1
    });

    act(() => vi.advanceTimersByTime(125));
    const confirmedStop = JSON.parse(socket.sentMessages.at(-1) ?? "null");
    expect(socket.sentMessages).toHaveLength(2);
    expect(confirmedStop).toMatchObject({
      x: terminalStop.x,
      y: terminalStop.y,
      moving: false,
      zoneId: terminalStop.zoneId,
      seq: terminalStop.seq + 1
    });

    act(() => vi.advanceTimersByTime(1000));
    expect(socket.sentMessages).toHaveLength(2);
  });

  it("cancels a pending terminal stop confirmation when joystick input restarts", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));
    expect(socket.sentMessages).toHaveLength(2);

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    fireEvent.keyDown(joystick, { key: "ArrowDown" });
    act(() => vi.advanceTimersByTime(125));

    expect(socket.sentMessages).toHaveLength(2);
    expect(JSON.parse(socket.sentMessages.at(-1) ?? "null")).toMatchObject({ moving: false });
  });

  it("cancels a pending terminal stop confirmation when map movement starts", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    const map = screen.getByTestId("world-map-viewport");
    mockMapRect(map);
    fireEvent.click(map, { clientX: 265, clientY: 375 });
    act(() => vi.advanceTimersByTime(125));

    expect(socket.sentMessages).toHaveLength(2);
  });

  it("places the calendar sheet above the hidden menu layers", () => {
    const { container } = render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const menuBackdrop = container.querySelector<HTMLElement>(".world-menu-backdrop");

    expect(menuBackdrop?.style.zIndex).toBe("");
    expect(menu.style.zIndex).toBe("");

    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    expect(menuBackdrop).toHaveStyle({ zIndex: "8" });
    expect(menu).toHaveStyle({ zIndex: "9" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(menuBackdrop?.style.zIndex).toBe("");
    expect(menu.style.zIndex).toBe("");
  });

  it("closes only the calendar sheet on Escape and restores its menu trigger", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const calendarButton = within(menu).getByRole("button", { name: "캘린더 저장" });
    fireEvent.click(calendarButton);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "캘린더 저장" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "초대장 바로가기" })).toBeInTheDocument();
    expect(calendarButton).toHaveFocus();
  });

  it("clears calendar state when the invitation menu closes", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴 닫기" }));

    expect(screen.queryByRole("dialog", { name: "캘린더 저장" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    expect(screen.getByRole("dialog", { name: "초대장 바로가기" })).not.toHaveAttribute("aria-hidden");
  });

  it("clears menu calendar state when portal arrival starts", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    advanceRouteToPortalArrival();

    expect(screen.queryByRole("dialog", { name: "캘린더 저장" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");

    advancePortalTransition();
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    expect(screen.getByRole("dialog", { name: "초대장 바로가기" })).not.toHaveAttribute("aria-hidden");
  });

  it("clears menu directions state when a new portal route arrives", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "오시는 길" }));

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));

    advanceRouteToPortalArrival();

    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
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
    fireEvent.click(map, { clientX: 145, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(3000);
    fireEvent.keyUp(joystick, { key: "ArrowLeft" });

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");

    fireEvent.click(map, { clientX: 145, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowDown" });
    advanceAnimation(3240);
    fireEvent.keyUp(joystick, { key: "ArrowDown" });

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "285px", top: "105px" });

    finishPortalFadeOut();
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-in");

    fireEvent.click(map, { clientX: 145, clientY: 450 });
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(3480);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "375px" });

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");

    fireEvent.click(map, { clientX: 145, clientY: 450 });
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

  it("returns from the train beside the subway station east portal", () => {
    render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");
    travelThroughPortal("열차 타기");
    travelThroughPortal("역사로 내리기");

    expect(screen.getByLabelText("지하철 역사 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "705px", top: "435px" });
  });

  it("keeps the subway platform interior free of ticket gate overlays", () => {
    const { container } = render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");

    const stage = screen.getByLabelText("지하철 역사 지도");
    const gateFronts = [...container.querySelectorAll('img[data-decoration="ticket-gate"]')];

    expect(stage).toHaveStyle({ width: "900px", height: "840px" });
    expect(gateFronts).toHaveLength(0);
  });

  it("renders the wide subway train strap foreground and arrives at the Task 9 venue coordinate", () => {
    const { container } = render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");
    travelThroughPortal("열차 타기");

    const train = screen.getByLabelText("지하철 차량 지도");
    const straps = [...container.querySelectorAll('img[data-decoration="string-lights"]')];

    expect(train).toHaveStyle({ width: "1440px", height: "540px" });
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "285px" });
    expect(straps).toHaveLength(1);
    expect(straps[0]).toHaveAttribute("src", "/assets/maps/v2/subway-train/strap-row-foreground.png");
    expect(straps[0]).toHaveStyle({ left: "240px", top: "105px", width: "960px", height: "120px", zIndex: "1420" });

    travelThroughPortal("예식장역 내리기");

    const venue = screen.getByLabelText("예식장 앞 지도");
    expect(venue).toHaveStyle({
      width: "960px",
      height: "900px",
      transform: "translate3d(-270px, -380px, 0) scale(1)"
    });
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "465px", top: "765px" });
    const flowerArch = container.querySelector('img[data-decoration="flower-arch"]');
    expect(flowerArch).toHaveAttribute("src", "/assets/maps/v2/venue-exterior/flower-arch-front.png");
    expect(flowerArch).toHaveStyle({ left: "360px", top: "180px", width: "240px", height: "180px", zIndex: "1360" });

    fireEvent.click(screen.getByRole("button", { name: "예식장 로비 들어가기" }));

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(screen.getByText("예식장 로비 들어가기까지 이동 중")).toBeInTheDocument();
    advanceAnimation(0);
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "465px", top: "735px" });

    advanceRouteToPortalArrival();
    expect(venue).toHaveStyle({ transform: "translate3d(-270px, 0px, 0) scale(1)" });
    advancePortalTransition();

    expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "525px", top: "765px" });
  });

  it("walks from the Task 9 venue coordinate back to the bottom train portal", () => {
    render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");
    travelThroughPortal("열차 타기");
    travelThroughPortal("예식장역 내리기");

    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "465px", top: "765px" });

    fireEvent.click(screen.getByRole("button", { name: "지하철역으로 돌아가기" }));

    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(screen.getByText("지하철역으로 돌아가기까지 이동 중")).toBeInTheDocument();
    advanceAnimation(0);
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "465px", top: "795px" });

    finishCurrentRoute();

    expect(screen.getByLabelText("지하철 차량 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "1305px", top: "285px" });
  });

  it("roundtrips from the Task 10 lobby arrival back to the venue with the camera safe", () => {
    render(<GameWorld profile={profile} />);

    travelThroughPortal("동네로 나가기");
    travelThroughPortal("지하철역 들어가기");
    travelThroughPortal("열차 타기");
    travelThroughPortal("예식장역 내리기");
    travelThroughPortal("예식장 로비 들어가기");

    expect(screen.getByLabelText("예식장 로비 지도")).toHaveStyle({ width: "1080px", height: "900px" });
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "525px", top: "765px" });

    fireEvent.click(screen.getByRole("button", { name: "예식장 밖으로" }));
    finishCurrentRoute();

    expect(screen.getByLabelText("예식장 앞 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "465px", top: "135px" });
  });

  it("renders the exact Task 11 bridal room stage, foreground depth, NPC modal, and lobby return", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();

    travelThroughPortal("신부 대기실");

    const stage = screen.getByLabelText("신부 대기실 지도");
    const flowerFront = container.querySelector('img[data-decoration-label="대기실 전경 꽃장식"]');

    expect(stage).toHaveStyle({ width: "720px", height: "630px" });
    expectMapBackground(container, "bridal-room");
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "345px", top: "525px" });
    expect(screen.getByRole("button", { name: `${brideNpcLabel} 소개 보기` }).parentElement)
      .toHaveStyle({ left: "360px", top: "285px", zIndex: "1285" });
    expect(flowerFront).toHaveAttribute("src", "/assets/maps/v2/bridal-room/flower-arrangement-front.png");
    expect(flowerFront).toHaveStyle({ left: "240px", top: "300px", width: "90px", height: "120px", zIndex: "1420" });

    fireEvent.click(screen.getByRole("button", { name: `${brideNpcLabel} 소개 보기` }));
    expect(screen.getByRole("dialog")).toHaveTextContent("신랑신부 정원");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    advanceRouteToPortalArrival();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "345px", top: "555px" });
    advancePortalTransition();

    expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "405px" });
  });

  it("travels lobby to banquet to restroom and back with complete table depth assets", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();

    fireEvent.click(screen.getByRole("button", { name: "연회장" }));
    advanceRouteToPortalArrival();
    expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "975px", top: "435px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    advancePortalTransition();

    const banquet = screen.getByLabelText("연회장 지도");
    const banquetTables = [...container.querySelectorAll('img[data-decoration="banquet-table"]')];

    expect(banquet).toHaveStyle({
      width: "1200px",
      height: "930px",
      transform: "translate3d(0px, -205px, 0) scale(1)"
    });
    expectMapBackground(container, "banquet");
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "465px" });
    expect(banquetTables).toHaveLength(4);
    [
      ["210px", "270px", "table-floral.png", "1510"],
      ["690px", "270px", "table-dining.png", "1510"],
      ["210px", "570px", "table-dining.png", "1810"],
      ["690px", "570px", "table-floral.png", "1810"]
    ].forEach(([left, top, asset, zIndex], index) => {
      expect(banquetTables[index]).toHaveAttribute("src", `/assets/maps/v2/banquet/${asset}`);
      expect(banquetTables[index]).toHaveStyle({ left, top, width: "240px", height: "240px", zIndex });
    });
    expect(container.querySelector('img[src*="table-front.png"]')).not.toBeInTheDocument();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));
    fireEvent.click(screen.getByRole("button", { name: /축하 메시지/ }));
    expect(screen.getByRole("dialog", { name: "방명록 우체통" })).toHaveTextContent("축하 메시지");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    travelThroughPortal("화장실");

    const restroom = screen.getByLabelText("화장실 지도");
    const stallFront = container.querySelector('img[data-decoration-label="화장실 칸 전경"]');

    expect(restroom).toHaveStyle({ width: "660px", height: "660px" });
    expectMapBackground(container, "restroom");
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "345px" });
    expect(stallFront).not.toBeInTheDocument();

    travelThroughPortal("연회장으로 돌아가기");

    expect(screen.getByLabelText("연회장 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "1065px", top: "465px" });

    travelThroughPortal("로비로 돌아가기");

    expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "945px", top: "405px" });
  });

  it("walks through the ceremony hall and returns only through the lobby portal", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();

    fireEvent.click(screen.getByRole("button", { name: "예식홀" }));
    advanceRouteToPortalArrival();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "495px", top: "105px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    advancePortalTransition();

    const hall = screen.getByLabelText("예식홀 지도");
    const bouquets = [...container.querySelectorAll('img[data-decoration="aisle-bouquet"]')];
    const ceremonyArch = container.querySelector('img[data-decoration-label="예식홀 꽃 아치"]');
    const altarTable = container.querySelector('img[data-decoration-label="예식홀 중앙 꽃 테이블"]');

    expect(hall).toHaveStyle({
      width: "780px",
      height: "1920px",
      transform: "translate3d(-180px, -1400px, 0) scale(1)"
    });
    expectMapBackground(container, "ceremony-hall");
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "375px", top: "1785px" });
    expect(screen.getByRole("button", { name: `${groomNpcLabel} 소개 보기` }).parentElement)
      .toHaveStyle({ left: "330px", top: "255px", zIndex: "1255" });
    expect(screen.getByRole("button", { name: `${brideNpcLabel} 소개 보기` }).parentElement)
      .toHaveStyle({ left: "450px", top: "255px", zIndex: "1255" });
    expect(ceremonyArch).toHaveAttribute("src", "/assets/maps/v2/ceremony-hall/ceremony-arch-front.png");
    expect(ceremonyArch).toHaveStyle({
      left: "180px",
      top: "30px",
      width: "420px",
      height: "300px",
      zIndex: "1330"
    });
    expect(altarTable).toHaveAttribute("src", "/assets/maps/v2/ceremony-hall/altar-table-front.png");
    expect(altarTable).toHaveStyle({
      left: "300px",
      top: "165px",
      width: "180px",
      height: "120px",
      zIndex: "1240"
    });
    expect(bouquets).toHaveLength(4);
    [
      ["240px", "480px", "1570"],
      ["480px", "720px", "1810"],
      ["240px", "960px", "2050"],
      ["480px", "1200px", "2290"]
    ].forEach(([left, top, zIndex], index) => {
      expect(bouquets[index]).toHaveAttribute("src", "/assets/maps/v2/ceremony-hall/aisle-bouquet-front.png");
      expect(bouquets[index]).toHaveStyle({ left, top, width: "60px", height: "90px", zIndex });
    });

    expect(screen.queryByRole("button", { name: "연회장으로" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    advanceRouteToPortalArrival();
    expect(screen.getByLabelText("예식홀 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "375px", top: "1815px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    advancePortalTransition();

    expect(screen.getByLabelText("예식장 로비 지도")).toBeInTheDocument();
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "525px", top: "135px" });
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
    expect(joystick.querySelector(".virtual-joystick__thumb")).toHaveStyle({
      "--joystick-x": "0",
      "--joystick-y": "0"
    });

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
    const npcButton = screen.getByRole("button", { name: `${brideNpcLabel} 소개 보기` });
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

  it("keeps portal effects behind characters while information buttons stay above the map", () => {
    render(<GameWorld profile={profile} />);

    const portal = screen.getByRole("button", { name: "동네로 나가기" });
    expect(portal).toHaveStyle({ zIndex: "1005" });
    expect(screen.getByLabelText("하객1")).toHaveStyle({ zIndex: "1555" });
    expect(Number(portal.style.zIndex)).toBeLessThan(worldDepth(105 - 88));
    expect(screen.getByRole("button", { name: /오시는 길/ })).toHaveStyle({ zIndex: "9000" });
  });

  it("renders only three tile-local portal effects without global beams or particles", () => {
    render(<GameWorld profile={profile} />);
    const portal = screen.getByRole("button", { name: "동네로 나가기" });
    const effect = portal.querySelector(".world-portal__effect");

    expect(portal).toHaveAccessibleName("동네로 나가기");
    expect(effect).toHaveAttribute("aria-hidden", "true");
    expect(effect?.querySelectorAll(".world-portal__tile")).toHaveLength(3);
    expect(effect?.querySelector(".world-portal__beam")).not.toBeInTheDocument();
    expect(effect?.querySelector(".world-portal__particle")).not.toBeInTheDocument();
    expect(portal.querySelector(".world-portal__label")).toHaveTextContent("동네로 나가기");
  });

  it("uses the exact three-tile portal strip as its click area", () => {
    render(<GameWorld profile={profile} />);

    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveStyle({
      left: "240px",
      top: "90px",
      width: "90px",
      height: "30px"
    });

    travelThroughPortal("동네로 나가기");

    expect(screen.getByRole("button", { name: "집으로 돌아가기" })).toHaveStyle({
      left: "90px",
      top: "330px",
      width: "30px",
      height: "90px"
    });
    expect(screen.getByRole("button", { name: "지하철역 들어가기" })).toHaveStyle({
      left: "1080px",
      top: "330px",
      width: "30px",
      height: "90px"
    });
  });

  it("enters a portal by joystick through an edge entry tile", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");

    walkHomeToPortalRightEdge(joystick);

    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "315px", top: "105px" });
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
  });

  it("inverse-transforms map clicks with a boundary-clamped camera and moves one grid tile at a time", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    mockMapRect(map);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(map, { clientX: 265, clientY: 375 });
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
    travelFromHomeToLobby();
    travelThroughPortal("신부 대기실");

    expect(screen.getByRole("button", { name: `${brideNpcLabel} 소개 보기` }).parentElement)
      .toHaveStyle({ zIndex: "1285" });
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
