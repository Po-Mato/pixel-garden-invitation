import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  defaultCharacterAppearance,
  getDefaultAppearance,
  invitationContent,
  type WorldZoneId
} from "@wedding-game/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { gameGuideStorageKey } from "../game/gameGuide";
import {
  allCelebrationCollectibles,
  celebrationCollectionStorageKey
} from "../game/celebrationCollectibles";
import { gameMemoryAlbumStorageKey } from "../game/gameMemoryAlbum";
import { worldDepth } from "../game/worldVisuals";
import { journeyProgressStorageKey } from "../game/journeyProgress";
import { optionalFeatureUsageStorageKey } from "../game/optionalFeatureUsage";
import { worldSessionStorageKey } from "../game/worldSession";
import { worldTravelHistoryStorageKey } from "../game/worldTravelHistory";
import { worldSecretCollectionStorageKey } from "../game/worldSecretCollection";
import { zoneMiniQuestStorageKey } from "../game/zoneMiniQuest";
import { copyText } from "../invitation/browserActions";
import { GameFeedbackProvider } from "../feedback/GameFeedbackContext";
import { defaultFeedbackPreferences } from "../feedback/feedbackPreferences";
import { GameWorld, preloadGameFeatureComponents } from "./GameWorld";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn(),
  shareContent: vi.fn(),
  isShareAbortError: vi.fn(() => false)
}));

const groomNpcLabel = `신랑 ${invitationContent.event.couple.groom}`;
const brideNpcLabel = `신부 ${invitationContent.event.couple.bride}`;

type MockListener = (event: Event) => void;

let animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;
let manualAnimationClock = 100_000;
const originalVibrate = navigator.vibrate;

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

beforeAll(async () => {
  await preloadGameFeatureComponents();
});

beforeEach(() => {
  animationFrames = new Map();
  nextAnimationFrameId = 1;
  manualAnimationClock = 100_000;
  MockWebSocket.instances = [];
  const localValues = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: (key: string, value: string) => { localValues.set(key, value); },
    removeItem: (key: string) => { localValues.delete(key); },
    clear: () => { localValues.clear(); },
    key: (index: number) => [...localValues.keys()][index] ?? null,
    get length() { return localValues.size; }
  });
  window.localStorage.setItem(gameGuideStorageKey, JSON.stringify({
    version: 1,
    completed: true,
    completedAt: "2026-07-24T00:00:00.000Z"
  }));
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
  if (originalVibrate) {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: originalVibrate });
  } else {
    Reflect.deleteProperty(navigator, "vibrate");
  }
});

function advanceAnimation(now: number) {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  act(() => callbacks.forEach((callback) => callback(now)));
}

function finishJoystickRelease() {
  act(() => vi.advanceTimersByTime(100));
}

function moveWithKeyboard(control: HTMLElement, key: string, tileCount: number) {
  fireEvent.keyDown(control, { key });
  for (let index = 0; index < tileCount; index += 1) {
    advanceAnimation(manualAnimationClock);
    manualAnimationClock += 300;
  }
  fireEvent.keyUp(control, { key });
  manualAnimationClock += 300;
}

async function revealLazyGameFeature() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function advanceRouteToPortalArrival() {
  for (let index = 0; index < 70 && animationFrames.size > 0; index += 1) {
    advanceAnimation(index * 240);
  }
  expect(animationFrames.size, "portal route did not reach arrival within 70 animation frames").toBe(0);
}

function advanceInteractionRoute() {
  for (let index = 0; index < 70 && animationFrames.size > 0; index += 1) {
    advanceAnimation(index * 240);
  }
  expect(animationFrames.size, "interaction route did not finish within 70 animation frames").toBe(0);
}

function getDirectionsWorldSpot() {
  const spot = document.querySelector<HTMLButtonElement>(".world-spot--directions");
  if (!spot) {
    throw new Error("오시는 길 월드 스팟을 찾지 못했습니다.");
  }
  return spot;
}

function advancePortalTransition() {
  act(() => vi.advanceTimersByTime(150));
  act(() => vi.advanceTimersByTime(250));
  fireTransitionEnd(screen.getByTestId("world-portal-transition"), "opacity");
  act(() => vi.advanceTimersByTime(300));
}

function walkHomeToPortalEntrance(joystick: HTMLElement) {
  fireEvent.keyDown(joystick, { key: "ArrowUp" });
  [0, 300, 600, 900, 1200, 1500, 1800, 2100].forEach(advanceAnimation);
}

function walkHomeToPortalWithHeldUp(joystick: HTMLElement) {
  walkHomeToPortalEntrance(joystick);
  advanceAnimation(2400);
}

function walkHomeToPortalRightEdge(joystick: HTMLElement) {
  const move = (key: string, times: number[]) => {
    fireEvent.keyDown(joystick, { key });
    times.forEach(advanceAnimation);
    fireEvent.keyUp(joystick, { key });
  };

  move("ArrowRight", [0]);
  fireEvent.keyDown(joystick, { key: "ArrowUp" });
  [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700].forEach(advanceAnimation);
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

function openJourneyTools() {
  const toggle = screen.getByRole("button", { name: /안내 도구 (열기|닫기)/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

function openGameVault() {
  openJourneyTools();
  const summary = screen.getByText("게임 기록·설정").closest("summary");
  if (!summary) throw new Error("게임 기록·설정 요약을 찾지 못했습니다.");
  const details = summary.closest("details");
  if (!details?.hasAttribute("open")) fireEvent.click(summary);
}

function openQuickGameTools() {
  openGameVault();
  fireEvent.click(screen.getByRole("button", { name: /빠른 도구 편집/ }));
}

function startNearCelebrationItem(itemId = "home-petal") {
  const item = allCelebrationCollectibles().find(({ id }) => id === itemId);
  if (!item) throw new Error(`축하 아이템을 찾지 못했습니다: ${itemId}`);
  window.localStorage.setItem(worldSessionStorageKey, JSON.stringify({
    version: 1,
    zoneId: item.zoneId,
    position: { x: item.point.x + 30, y: item.point.y },
    direction: "left",
    guideCheckpointId: null,
    updatedAt: new Date().toISOString()
  }));
}

function openCompanionDock() {
  const dock = screen.getByLabelText("같이 걷기");
  const toggle = within(dock).getByRole("button", { name: /같이 걷기 (열기|닫기)$/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

function openDirectionsFromMenu() {
  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" }))
    .getByRole("button", { name: "길 찾기" }));
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
    expect(screen.queryByLabelText("하객 여정")).not.toBeInTheDocument();
    openGameVault();
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

  it("synchronizes every 30px tile step with the approved four-phase walk cycle", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const sprite = screen.getByLabelText("하객1 캐릭터");
    const joystick = screen.getByLabelText("가상 조이스틱");

    expect(player).toHaveStyle({ left: "285px", top: "375px" });
    expect(sprite).toHaveAttribute("data-moving", "false");
    expect(sprite).toHaveAttribute("data-walk-frame", "1");

    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "255px", top: "375px" });
    expect(sprite).toHaveAttribute("data-moving", "true");
    expect(sprite).toHaveAttribute("data-walk-frame", "0");

    advanceAnimation(299);
    expect(player).toHaveStyle({ left: "255px", top: "375px" });
    expect(sprite).toHaveAttribute("data-walk-frame", "0");

    advanceAnimation(300);
    expect(player).toHaveStyle({ left: "225px", top: "375px" });
    expect(sprite).toHaveAttribute("data-walk-frame", "1");

    advanceAnimation(540);
    expect(player).toHaveStyle({ left: "195px", top: "375px" });
    expect(sprite).toHaveAttribute("data-walk-frame", "2");

    advanceAnimation(780);
    expect(player).toHaveStyle({ left: "165px", top: "375px" });
    expect(sprite).toHaveAttribute("data-walk-frame", "1");

    fireEvent.keyUp(joystick, { key: "ArrowLeft" });
    finishJoystickRelease();
    expect(sprite).toHaveAttribute("data-moving", "false");
    expect(sprite).toHaveAttribute("data-walk-frame", "1");
  });

  it("keeps the isolated motion loop active across an immediate keyboard direction handoff", () => {
    render(<GameWorld profile={profile} />);
    const sprite = screen.getByLabelText("하객1 캐릭터");
    const joystick = screen.getByLabelText("가상 조이스틱");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    finishJoystickRelease();

    expect(sprite).toHaveAttribute("data-moving", "true");

    fireEvent.keyUp(joystick, { key: "ArrowLeft" });
    finishJoystickRelease();
    expect(sprite).toHaveAttribute("data-moving", "false");
  });

  it("plays footstep haptics only on right-foot and left-foot landing frames", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(
      <GameFeedbackProvider initialPreferences={{
        ...defaultFeedbackPreferences,
        soundEnabled: false,
        hapticsEnabled: true
      }}>
        <GameWorld profile={profile} />
      </GameFeedbackProvider>
    );
    const joystick = screen.getByLabelText("가상 조이스틱");

    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(0);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith(4);

    advanceAnimation(299);
    expect(vibrate).toHaveBeenCalledTimes(1);

    advanceAnimation(300);
    expect(vibrate).toHaveBeenCalledTimes(1);

    advanceAnimation(540);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenLastCalledWith(4);

    fireEvent.keyUp(joystick, { key: "ArrowLeft" });
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("opens the three-step guide only for a first visit and remembers dismissal", () => {
    window.localStorage.removeItem(gameGuideStorageKey);

    render(<GameWorld profile={profile} />);

    expect(screen.getByRole("dialog", { name: "게임 첫 방문 안내" })).toHaveTextContent("한 칸씩 차분하게 걸어요");
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));

    expect(screen.queryByRole("dialog", { name: "게임 첫 방문 안내" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(gameGuideStorageKey) ?? "null")).toMatchObject({
      version: 1,
      completed: true
    });
  });

  it("temporarily yields the first-visit guide to another game overlay", () => {
    window.localStorage.removeItem(gameGuideStorageKey);

    render(<GameWorld profile={profile} />);

    expect(screen.getByRole("dialog", { name: "게임 첫 방문 안내" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));

    expect(screen.queryByRole("dialog", { name: "게임 첫 방문 안내" })).not.toBeInTheDocument();
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "초대장 메뉴 닫기" }));

    expect(screen.getByRole("dialog", { name: "게임 첫 방문 안내" })).toBeInTheDocument();
  });

  it("does not interrupt a returning guest who already has journey progress", () => {
    window.localStorage.removeItem(gameGuideStorageKey);
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));

    render(<GameWorld profile={profile} />);

    expect(screen.queryByRole("dialog", { name: "게임 첫 방문 안내" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 목적지 웨딩 갤러리, 예식장 로비로 이동" })).toBeInTheDocument();
  });

  it("starts walking to the recommended destination in the current map", () => {
    render(<GameWorld profile={profile} />);

    expect(screen.getByText("목적지 · 오시는 길")).toBeInTheDocument();
    expect(screen.getByTestId("minimap-destination-route")).toHaveAttribute("data-route-kind", "preview");
    expect(screen.getByTestId("minimap-route-progress")).toHaveTextContent("경로 미리보기");
    expect(screen.getByTestId("minimap-journey-marker")).toHaveClass("world-minimap__journey-marker--recommended");

    fireEvent.click(screen.getByRole("button", { name: "다음 목적지 오시는 길, 길 안내 시작" }));

    expect(screen.getByText("오시는 길 가까이 이동 중")).toBeInTheDocument();
    expect(getDirectionsWorldSpot()).toHaveClass("world-spot--target");
    const route = screen.getByTestId("world-journey-route");
    expect(route).toBeInTheDocument();
    expect(route.querySelector(".world-journey-route__player-fade")).toHaveAttribute("r", "48");
    expect(route.querySelector(".world-journey-route__visuals")).toHaveAttribute("mask");
    expect(route.querySelector(".world-journey-route__outline")).toBeInTheDocument();
    expect(route.querySelector(".world-journey-route__path")).toBeInTheDocument();
    expect(route.querySelector('[data-surface="wood"]')).toBeInTheDocument();
    expect(screen.getByTestId("minimap-destination-route")).toHaveAttribute("data-route-kind", "selected");
    expect(screen.getByTestId("minimap-route-progress")).toHaveTextContent("이동 중");
    expect(screen.getByRole("button", { name: /현재 위치에서 경로 다시 찾기/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /현재 위치에서 경로 다시 찾기/ }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByTestId("world-journey-route")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "길 안내 중단" }));
    expect(screen.queryByTestId("world-journey-route")).not.toBeInTheDocument();
    expect(screen.getByText("길 안내를 중단했어요")).toBeInTheDocument();
  });

  it("offers a text route with the remaining journey and starts guidance from it", async () => {
    render(<GameWorld profile={profile} />);

    openJourneyTools();
    fireEvent.click(screen.getByRole("button", { name: /쉬운 길찾기 열기/ }));
    await revealLazyGameFeature();

    const dialog = screen.getByRole("dialog", { name: "쉬운 길찾기" });
    expect(within(dialog).getByLabelText("남은 전체 여정 요약")).toHaveTextContent("남은 추억");
    expect(within(dialog).getByRole("list", { name: "오시는 길까지 이동 순서" })).toBeInTheDocument();
    const shortestRoute = within(dialog).getByRole("button", { name: /최단 경로/ });
    expect(shortestRoute).toHaveTextContent(/타일 · 포털/);
    fireEvent.click(shortestRoute);
    expect(shortestRoute).toHaveAttribute("aria-pressed", "true");
    const stepFreeRoute = within(dialog).getByRole("button", { name: /계단 없는 길 엘리베이터/ });
    fireEvent.click(stepFreeRoute);
    expect(stepFreeRoute).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "길 안내 시작" }));

    expect(screen.queryByRole("dialog", { name: "쉬운 길찾기" })).not.toBeInTheDocument();
    expect(screen.getByText("오시는 길 가까이 이동 중")).toBeInTheDocument();
  });

  it("moves to another map and continues walking to its recommended destination", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "다음 목적지 웨딩 갤러리, 예식장 로비로 이동" }));
    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveClass("world-portal--target");

    advanceRouteToPortalArrival();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-continuous-journey", "true");
    expect(screen.getByText("목적지 연속 안내")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "현재 구역 미니맵" }))
      .toHaveAttribute("data-route-continuing", "true");
    advancePortalTransition();
    act(() => vi.advanceTimersByTime(0));

    for (let index = 1; index < 5; index += 1) {
      finishCurrentRoute();
      act(() => vi.advanceTimersByTime(0));
    }

    expect(screen.getByText("예식장 로비", { selector: ".world-zone-summary strong" })).toBeInTheDocument();
    expect(screen.getByText("웨딩 갤러리 가까이 이동 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "웨딩 갤러리 사진 보기" })).toHaveClass("world-spot--target");
  });

  it("reopens the guide from the game vault without moving the guest", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const startingPosition = { left: player.style.left, top: player.style.top };

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /게임 안내/ }));

    expect(screen.getByRole("dialog", { name: "게임 첫 방문 안내" })).toBeInTheDocument();
    expect(player).toHaveStyle(startingPosition);
    fireEvent.click(screen.getByRole("button", { name: "게임 안내 닫기" }));
    expect(screen.queryByRole("dialog", { name: "게임 첫 방문 안내" })).not.toBeInTheDocument();
  });

  it("walks to a photo spot before opening the camera experience", async () => {
    render(<GameWorld profile={profile} />);
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식장 로비 바로 이동" }));

    fireEvent.click(screen.getByRole("button", { name: "로비 포토월 기념 촬영" }));
    expect(screen.queryByRole("dialog", { name: "웨딩 포토존 촬영" })).not.toBeInTheDocument();
    expect(screen.getByText("로비 포토월 가까이 이동 중")).toBeInTheDocument();

    advanceInteractionRoute();
    await revealLazyGameFeature();

    expect(screen.getByRole("dialog", { name: "웨딩 포토존 촬영" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "포토존 닫기" })).toHaveFocus();
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
  }, 10_000);

  it("keeps the expandable minimap in sync with portal travel and zone changes", () => {
    render(<GameWorld profile={profile} />);
    let minimap = screen.getByRole("complementary", { name: "현재 구역 미니맵" });

    expect(within(minimap).getByText("우리 집")).toBeInTheDocument();
    expect(within(minimap).getByRole("button", { name: "미니맵 확대 보기" })).toBeInTheDocument();
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

    expect(player).toHaveStyle({ left: "285px", top: "375px" });
  });

  it("당일 퀵 안내를 열 때 이동을 멈추고 지도 클릭을 발생시키지 않는다", () => {
    render(<GameWorld profile={profile} weddingDayPreview />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 265, clientY: 375 });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };

    fireEvent.click(within(screen.getByRole("navigation", { name: /예식 당일 바로가기/ }))
      .getByRole("button", { name: "일정" }));
    [240, 480, 720].forEach(advanceAnimation);

    expect(screen.getByRole("dialog", { name: "예식 당일 안내" })).toBeInTheDocument();
    expect(player).toHaveStyle(pausedAt);
  });

  it("opens invitation content without teleporting to its map", () => {
    render(<GameWorld profile={profile} />);
    const menuTrigger = screen.getByRole("button", { name: "초대장 메뉴" });
    fireEvent.click(menuTrigger);
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    const isolatedWorldSibling = Array.from(menu.parentElement?.children ?? [])
      .find((element) => element !== menu && !element.classList.contains("world-menu-backdrop") && element.contains(menuTrigger));
    expect(screen.getByRole("heading", { name: "초대장 바로가기" })).toHaveFocus();
    expect(menu).toHaveAccessibleDescription("예식 정보와 자주 찾는 초대장 항목을 순서대로 확인할 수 있습니다.");
    expect(isolatedWorldSibling).toHaveAttribute("aria-hidden", "true");
    expect(isolatedWorldSibling).toHaveAttribute("inert");
    expect(document.querySelector(".world-menu-backdrop")).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(screen.getByRole("heading", { name: "초대장 바로가기" }), { key: "Tab", shiftKey: true });
    expect(within(menu).getByRole("button", { name: "초대장 공유" })).toHaveFocus();
    fireEvent.click(within(menu).getByRole("button", { name: "축하 쓰기" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("축하 메시지");
    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
  });

  it("초대장 메뉴에서 간편 초대장 전환을 요청한다", () => {
    const onOpenQuickView = vi.fn();
    render(<GameWorld profile={profile} onOpenQuickView={onOpenQuickView} />);

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" }))
      .getByRole("button", { name: "간편 초대장" }));

    expect(onOpenQuickView).toHaveBeenCalledOnce();
  });

  it("초대장 메뉴의 공유 시트를 열 때 월드 입력을 멈춘다", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 265, clientY: 375 });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "초대장 공유" }));
    [240, 480, 720].forEach(advanceAnimation);

    expect(screen.getByRole("dialog", { name: "초대장 공유" })).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(player).toHaveStyle(pausedAt);
  });

  it.each([
    ["menu", () => {
      fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "답변하기" }));
    }],
    ["world spot", () => {
      openGameVault();
      fireEvent.click(screen.getByRole("button", { name: "예식장 로비 바로 이동" }));
      fireEvent.click(screen.getByRole("button", { name: "축의대 답변하기" }));
    }]
  ])("opens the shared RSVP panel from the %s without moving during form input", (_source, openRsvp) => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    openRsvp();
    advanceInteractionRoute();
    const before = { left: player.style.left, top: player.style.top };
    const dialog = screen.getByRole("dialog", { name: "참석 답변" });
    fireEvent.click(within(dialog).getByLabelText("이름"));
    fireEvent.change(within(dialog).getByLabelText("이름"), { target: { value: "김하객" } });
    fireEvent.click(within(dialog).getByLabelText("신부측"));
    advanceAnimation(0);

    expect(within(dialog).getByRole("button", { name: "참석 답변 보내기" })).toBeInTheDocument();
    expect(player).toHaveStyle(before);
  });

  it("stops an active map route when RSVP opens and keeps the release policy stable", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 265, clientY: 375 });
    advanceAnimation(0);
    expect(player).not.toHaveStyle({ left: "285px", top: "375px" });

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "답변하기" }));
    const pausedAt = { left: player.style.left, top: player.style.top };
    [240, 480, 720, 960].forEach(advanceAnimation);

    expect(screen.getByRole("dialog", { name: "참석 답변" })).toBeInTheDocument();
    expect(player).toHaveStyle(pausedAt);
  });

  it("keeps joystick input latched until release after RSVP interrupts movement", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "답변하기" }));

    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(screen.getByRole("dialog", { name: "참석 답변" })).getByRole("button", { name: "닫기" }));
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    expect(joystick).toHaveAttribute("aria-disabled", "false");
  });

  it.each([
    ["소개 보기", "신랑신부 정원"],
    ["사진 보기", "사진 갤러리"],
    ["스토리 보기", "연애 스토리 꽃길"]
  ])("pauses world input for %s opened from the menu", (actionLabel, dialogLabel) => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: actionLabel }));

    expect(screen.getByRole("dialog", { name: dialogLabel })).toBeInTheDocument();
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    [240, 480, 720].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
  });

  it("stops an active map route when the gallery opens", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByTestId("world-map-viewport");
    const player = screen.getByLabelText("하객1");
    mockMapRect(map);

    fireEvent.click(map, { clientX: 265, clientY: 375 });
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    expect(pausedAt).not.toEqual({ left: "285px", top: "375px" });

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "사진 보기" }));
    [240, 480, 720, 960].forEach(advanceAnimation);

    expect(screen.getByRole("dialog", { name: "사진 갤러리" })).toBeInTheDocument();
    expect(player).toHaveStyle(pausedAt);
  });

  it("keeps lightbox arrow navigation isolated from the character", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const before = { left: player.style.left, top: player.style.top };

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "사진 보기" }));
    fireEvent.click(screen.getAllByRole("button", { name: /사진 \d+:/ })[0]);
    const lightbox = screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" });

    fireEvent.keyDown(lightbox, { key: "ArrowRight" });

    expect(within(lightbox).getByText("2 / 10")).toBeInTheDocument();
    expect(player).toHaveStyle(before);
  });

  it("closes the lightbox before the gallery sheet and restores menu focus", () => {
    render(<GameWorld profile={profile} />);
    const menuButton = screen.getByRole("button", { name: "초대장 메뉴" });
    fireEvent.click(menuButton);
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "사진 보기" }));
    fireEvent.click(screen.getAllByRole("button", { name: /사진 \d+:/ })[0]);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "웨딩 사진 전체 화면" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "사진 갤러리" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByRole("dialog", { name: "사진 갤러리" })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it("keeps held joystick input latched after the gallery closes until keyup", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "사진 보기" }));
    expect(joystick).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(within(screen.getByRole("dialog", { name: "사진 갤러리" })).getByRole("button", { name: "닫기" }));
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    expect(joystick).toHaveAttribute("aria-disabled", "false");
  });

  it.each([
    ["답변하기", "참석 답변"],
    ["축하 쓰기", "방명록 우체통"]
  ])("restores menu-button focus after closing the %s spot opened from the menu", (actionLabel, dialogLabel) => {
    render(<GameWorld profile={profile} />);
    const menuButton = screen.getByRole("button", { name: "초대장 메뉴" });
    fireEvent.click(menuButton);
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: actionLabel }));

    fireEvent.click(within(screen.getByRole("dialog", { name: dialogLabel })).getByRole("button", { name: "닫기" }));
    act(() => vi.advanceTimersByTime(0));

    expect(menuButton).toHaveFocus();
  });

  it("restores a world spot trigger without forcing focus to the menu button", () => {
    render(<GameWorld profile={profile} />);
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식장 로비 바로 이동" }));
    const worldSpot = screen.getByRole("button", { name: "축의대 답변하기" });
    const menuButton = screen.getByRole("button", { name: "초대장 메뉴" });
    worldSpot.focus();
    fireEvent.click(worldSpot);
    expect(worldSpot).toHaveClass("world-spot--target");
    expect(screen.queryByRole("dialog", { name: "참석 답변" })).not.toBeInTheDocument();
    advanceInteractionRoute();

    fireEvent.click(within(screen.getByRole("dialog", { name: "참석 답변" })).getByRole("button", { name: "닫기" }));
    act(() => vi.advanceTimersByTime(0));

    expect(worldSpot).toHaveFocus();
    expect(menuButton).not.toHaveFocus();
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

  it("opens the same-device photo album from the game vault without moving the player", async () => {
    const { container } = render(<GameWorld profile={profile} />);
    const player = container.querySelector<HTMLElement>(".world-player");
    const before = { left: player?.style.left, top: player?.style.top };

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /포토앨범/ }));
    await revealLazyGameFeature();

    expect(screen.getByRole("dialog", { name: "웨딩 포토앨범" })).toBeInTheDocument();
    expect(player?.style.left).toBe(before.left);
    expect(player?.style.top).toBe(before.top);

    fireEvent.click(screen.getByRole("button", { name: "포토앨범 닫기" }));
    expect(screen.queryByRole("dialog", { name: "웨딩 포토앨범" })).not.toBeInTheDocument();
  });

  it("opens calendar choices from the menu without moving the player", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(player).toHaveStyle({ left: "285px", top: "375px" });
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
    openJourneyTools();
    fireEvent.click(getDirectionsWorldSpot());
    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(screen.getByText("오시는 길 가까이 이동 중")).toBeInTheDocument();
    advanceInteractionRoute();

    const directions = screen.getByRole("dialog", { name: "오시는 길" });
    expect(directions).toHaveTextContent("네이버지도");
    expect(directions).toHaveTextContent("주차 2시간 무료");
    expect(screen.queryByText("MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "방문 스탬프 1/5, 열기" })).toBeInTheDocument();
    expect(screen.getByTestId("minimap-journey-marker")).toHaveClass("world-minimap__journey-marker--complete");
    expect(JSON.parse(window.localStorage.getItem(journeyProgressStorageKey) ?? "null")).toMatchObject({
      completedIds: ["directions"]
    });
  });

  it("목적지 방문을 마치면 다음 행동과 연속 길 안내를 연결한다", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(getDirectionsWorldSpot());
    advanceInteractionRoute();
    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));

    const nextAction = screen.getByLabelText("도착 후 다음 행동");
    expect(nextAction).toHaveTextContent("오시는 길 완료");
    expect(nextAction).toHaveTextContent("다음 · 웨딩 갤러리");
    fireEvent.click(within(nextAction).getByRole("button", { name: /이어서 안내/ }));

    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveClass("world-portal--target");
  });

  it("예식이 임박하면 HUD에서 예식홀 최단 안내를 시작한다", () => {
    vi.setSystemTime(new Date("2027-05-01T17:00:00+09:00"));
    render(<GameWorld profile={profile} />);

    openJourneyTools();
    expect(screen.getByText("예식까지 10분")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /예식홀 최단 안내/ }));

    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveClass("world-portal--target");
  });

  it("restores saved stamps without reopening the completion reward", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions", "gallery"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));

    render(<GameWorld profile={profile} />);
    openJourneyTools();
    fireEvent.click(screen.getByRole("button", { name: "방문 스탬프 2/5, 열기" }));

    expect(screen.getByRole("button", { name: "오시는 길 완료" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "웨딩 갤러리 완료" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "신부에게 인사 방문하기" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "방문 여정 완주" })).not.toBeInTheDocument();
  });

  it("guides the guest to the next incomplete destination from the stamp book", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    openJourneyTools();
    fireEvent.click(screen.getByRole("button", { name: "방문 스탬프 1/5, 열기" }));
    const stampPanel = document.getElementById("journey-stamp-panel");
    expect(stampPanel).not.toBeNull();
    fireEvent.click(within(stampPanel as HTMLElement).getByRole("button", { name: /다음 목적지 웨딩 갤러리/ }));

    expect(screen.getByText("예식장 로비", { selector: ".world-zone-summary strong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "방문 스탬프 1/5, 열기" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reopens the keepsake reward from a completed stamp book", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "ceremony", "guestbook"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    openJourneyTools();
    fireEvent.click(screen.getByRole("button", { name: "방문 스탬프 5/5, 열기" }));
    fireEvent.click(screen.getByRole("button", { name: /기념 카드 다시 보기/ }));

    expect(screen.getByRole("dialog", { name: "방문 여정 완주" })).toHaveTextContent(`${profile.nickname}님`);
  });

  it("rewards the final checkpoint and keeps RSVP available as a direct action", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "guestbook"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식홀 바로 이동" }));

    expect(screen.getByRole("dialog", { name: "방문 여정 완주" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "방문 스탬프 5/5, 열기" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(journeyProgressStorageKey) ?? "null")).toMatchObject({
      completedIds: ["directions", "gallery", "bride", "ceremony", "guestbook"]
    });

    fireEvent.click(screen.getByRole("button", { name: "참석 답변하기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("참석 여부와 동행 인원을 알려주세요");
  });

  it("opens the real invitation share sheet from the journey reward", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "guestbook"],
      updatedAt: "2026-07-23T01:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식홀 바로 이동" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "방문 여정 완주" }))
      .getByRole("button", { name: "초대장 공유" }));

    expect(screen.getByRole("dialog", { name: "초대장 공유" })).toHaveTextContent("이건희 · 이승재");
  });

  it("recalculates a guided interaction after joystick input", () => {
    render(<GameWorld profile={profile} />);
    const directionsSpot = getDirectionsWorldSpot();
    const joystick = screen.getByLabelText("가상 조이스틱");

    expect(directionsSpot.querySelector(".world-spot__card")).toHaveTextContent("오시는 길");
    expect(directionsSpot).toHaveAttribute("data-label-visibility", "full");

    fireEvent.click(directionsSpot);
    expect(directionsSpot).toHaveClass("world-spot--target");

    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(0);
    fireEvent.keyUp(joystick, { key: "ArrowLeft" });
    finishJoystickRelease();

    expect(directionsSpot).toHaveClass("world-spot--target");
    expect(screen.getByText("오시는 길까지 경로를 다시 찾았어요")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
  });

  it("replaces a guided interaction when another world spot is selected", () => {
    render(<GameWorld profile={profile} />);
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식장 로비 바로 이동" }));
    const rsvpSpot = screen.getByRole("button", { name: "축의대 답변하기" });
    const gallerySpot = screen.getByRole("button", { name: "웨딩 갤러리 사진 보기" });

    fireEvent.click(rsvpSpot);
    expect(rsvpSpot).toHaveClass("world-spot--target");
    expect(screen.getByTestId("world-journey-route")).toHaveAttribute("data-route-kind", "selected");
    fireEvent.click(gallerySpot);

    expect(rsvpSpot).not.toHaveClass("world-spot--target");
    expect(gallerySpot).toHaveClass("world-spot--target");
    advanceInteractionRoute();
    expect(screen.getByRole("dialog", { name: "사진 갤러리" })).toBeInTheDocument();
  });

  it("previews and explicitly cancels a selected tile route", () => {
    render(<GameWorld profile={profile} />);
    const directionsSpot = getDirectionsWorldSpot();

    fireEvent.click(directionsSpot);

    expect(screen.getByTestId("world-journey-route")).toHaveAttribute("data-route-kind", "selected");
    expect(screen.getByRole("button", { name: "이동 취소" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이동 취소" }));

    expect(directionsSpot).not.toHaveClass("world-spot--target");
    expect(screen.queryByTestId("world-journey-route")).not.toBeInTheDocument();
    expect(screen.getByText("길 안내를 중단했어요")).toBeInTheDocument();
  });

  it("moves through the same tile path shown for a map selection", () => {
    render(<GameWorld profile={profile} />);
    const viewport = screen.getByTestId("world-map-viewport");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 390,
      bottom: 700,
      width: 390,
      height: 700,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    fireEvent.click(viewport, { clientX: 260, clientY: 420 });

    expect(screen.getByText("선택한 위치로 이동 중")).toBeInTheDocument();
    expect(screen.getByTestId("world-journey-route")).toHaveAttribute("data-route-kind", "selected");
  });

  it("pauses a started portal route when directions opens from the invitation details", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);
    const pausedAt = { left: player.style.left, top: player.style.top };
    expect(pausedAt).not.toEqual({ left: "285px", top: "375px" });

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
    Array.from({ length: 8 }, (_, index) => index * 240).forEach(advanceAnimation);
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
    expect(pausedAt).not.toEqual({ left: "285px", top: "375px" });

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "길 찾기" }));

    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    [240, 480, 720].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    [960, 1200].forEach(advanceAnimation);
    expect(player).toHaveStyle(pausedAt);
  });

  it("switches held joystick input to guided movement before opening a world spot", () => {
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
    expect(pausedAt).toEqual({ left: "315px", top: "375px" });

    fireEvent.click(getDirectionsWorldSpot());

    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(joystick).toHaveAttribute("aria-disabled", "true");
    advanceInteractionRoute();
    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
    expect(player).not.toHaveStyle(pausedAt);
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");

    const moves = socket.sentMessages.map((message) => JSON.parse(message)).filter((message) => message.type === "move");
    expect(moves.at(-1)).toMatchObject({ moving: false, zoneId: "home" });

    fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "닫기" }));
    [960, 1200].forEach(advanceAnimation);
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
    expect(priorMove).toMatchObject({ x: 315, y: 375, direction: "right", moving: true, zoneId: "home" });

    fireEvent.keyDown(joystick, { key: "ArrowDown" });
    advanceAnimation(50);
    expect(player).toHaveStyle({ left: "315px", top: "405px" });
    expect(socket.sentMessages).toHaveLength(1);
    const pausedAt = {
      x: Number.parseInt(player.style.left, 10),
      y: Number.parseInt(player.style.top, 10)
    };

    openDirectionsFromMenu();

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
    expect(priorStop).toMatchObject({ x: 285, y: 375, moving: false, zoneId: "home" });
    socket.sentMessages.length = 0;

    openDirectionsFromMenu();

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
    openDirectionsFromMenu();
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
    openDirectionsFromMenu();
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
    const closeButton = within(menu).getByRole("button", { name: "초대장 메뉴 닫기" });
    fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

    fireEvent.click(closeButton);

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

    const hiddenPortal = document.querySelector<HTMLButtonElement>('.world-portal[aria-label="동네로 나가기"]');
    expect(hiddenPortal).not.toBeNull();
    fireEvent.click(hiddenPortal!);

    advanceRouteToPortalArrival();

    expect(screen.queryByRole("dialog", { name: "오시는 길" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
  });

  it("초대장 메뉴에서 마음 전하실 곳을 열고 닫아도 캐릭터를 이동시키지 않는다", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const initialPosition = { left: player.style.left, top: player.style.top };

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "마음 전하실 곳" }));

    expect(screen.getByRole("dialog", { name: "마음 전하실 곳" })).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(player).toHaveStyle(initialPosition);

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "마음 전하실 곳" })).not.toBeInTheDocument();
    expect(menu).not.toHaveAttribute("aria-hidden");
    expect(player).toHaveStyle(initialPosition);
  });

  it("초대장 메뉴에서 혼주 연락처를 열고 닫아도 캐릭터를 이동시키지 않는다", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const initialPosition = { left: player.style.left, top: player.style.top };

    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
    fireEvent.click(within(menu).getByRole("button", { name: "혼주 연락처" }));

    expect(screen.getByRole("dialog", { name: "혼주 연락처" })).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(player).toHaveStyle(initialPosition);

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "혼주 연락처" })).not.toBeInTheDocument();
    expect(menu).not.toHaveAttribute("aria-hidden");
    expect(player).toHaveStyle(initialPosition);
  });

  it("선택 기능에서 환경 설정을 열면 월드 입력을 중지한다", () => {
    render(<GameWorld profile={profile} />);
    const player = screen.getByLabelText("하객1");
    const initialPosition = { left: player.style.left, top: player.style.top };

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "환경 설정" }));

    expect(screen.getByRole("dialog", { name: "환경 설정" })).toBeInTheDocument();
    expect(player).toHaveStyle(initialPosition);

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(player).toHaveStyle(initialPosition);
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

  it("첫 포털 목적지를 안내하고 도착한 이동 기록을 저장한다", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));

    expect(screen.getByText("첫 방문")).toBeInTheDocument();
    expect(screen.getByText("새로운 장소예요")).toBeInTheDocument();
    finishCurrentRoute();

    const history = JSON.parse(window.localStorage.getItem(worldTravelHistoryStorageKey) ?? "null");
    expect(history.visitedZoneIds).toContain("neighborhood");
    expect(history.records.at(-1)).toMatchObject({
      from: "home",
      to: "neighborhood",
      portalId: "home-to-neighborhood",
      method: "portal"
    });
  });

  it("대표 소품을 누르면 가까이 걸어가 짧은 반응을 보여준다", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "청첩장 보관함, 청첩장 살펴보기" }));
    advanceInteractionRoute();

    expect(screen.getByRole("status", { name: "하객1님의 하트" })).toBeInTheDocument();
    expect(screen.getAllByText("두 사람의 초대장을 다시 한번 정성껏 펼쳐봤어요")).toHaveLength(2);
    expect(screen.getByText("숨은 추억 · 첫 초대의 설렘")).toBeInTheDocument();
    expect(screen.getByText("업적 달성 · 첫 비밀 발견")).toBeInTheDocument();
    expect(window.localStorage.getItem(worldSecretCollectionStorageKey)).toContain("first-invitation");
  });

  it("cancels portal walking when another map point is clicked", () => {
    render(<GameWorld profile={profile} />);
    const map = screen.getByLabelText("우리 집 지도");
    mockMapRect(map);

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);
    fireEvent.click(map, { clientX: 235, clientY: 280 });
    finishCurrentRoute();

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByText("선택한 위치에 도착했어요")).toBeInTheDocument();
  });

  it("recalculates the portal route after joystick input is released", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    advanceAnimation(0);

    const joystick = screen.getByLabelText("가상 조이스틱");
    fireEvent.keyDown(joystick, { key: "ArrowLeft" });
    advanceAnimation(240);
    fireEvent.keyUp(joystick, { key: "ArrowLeft" });
    finishJoystickRelease();

    expect(screen.getByLabelText("우리 집 지도")).toBeInTheDocument();
    expect(screen.getByText("동네로 나가기까지 경로를 다시 찾았어요")).toBeInTheDocument();
    expect(screen.getByTestId("world-journey-route")).toHaveAttribute("data-route-kind", "selected");
    expect(screen.getByTestId("world-travel-progress")).toHaveTextContent(/타일 · 포털 1회 · 약 \d+초/);
    expect(screen.getByTestId("world-travel-progress")).toHaveTextContent("자동 재탐색 완료");
    expect(screen.getByTestId("minimap-route-progress")).toHaveTextContent(/타일 · 포털 1회 · 약 \d+초/);
    expect(screen.getByTestId("world-journey-route")).toHaveAttribute("data-route-recalculation", "1");

    finishCurrentRoute();
    expect(screen.getByLabelText("동네 거리 지도")).toBeInTheDocument();
  });

  it("shows the final three portal tiles and a compact arrival card", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));

    let now = 0;
    for (let index = 0; index < 70 && !screen.queryByText("3타일 앞"); index += 1) {
      advanceAnimation(now);
      now += 240;
    }
    expect(screen.getByText("3타일 앞")).toBeInTheDocument();
    expect(screen.getByText("포털 진입 방향을 확인하세요")).toBeInTheDocument();

    for (let index = 0; index < 70 && animationFrames.size > 0; index += 1) {
      advanceAnimation(now);
      now += 240;
    }
    expect(screen.getByText("포털 도착", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("동네 거리 맵으로 이동합니다")).toBeInTheDocument();
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
    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "135px", top: "375px" });
    expect(screen.getByText("길을 찾을 수 없어요")).toBeInTheDocument();

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(3240);
    fireEvent.keyUp(joystick, { key: "ArrowRight" });

    expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "165px", top: "375px" });
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
    expect(flowerArch).toHaveStyle({ left: "360px", top: "180px", width: "240px", height: "180px", zIndex: "1339" });

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

  it("switches the guest behind and in front of the aligned lobby reception desk", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();

    const player = screen.getByLabelText("하객1");
    const desk = container.querySelector<HTMLElement>('img[data-decoration="reception-desk"]');
    expect(desk).toHaveStyle({ left: "450px", top: "360px", width: "180px", height: "120px", zIndex: "1475" });
    expect(Number(player.style.zIndex)).toBeGreaterThan(Number(desk?.style.zIndex));

    fireEvent.click(screen.getByRole("button", { name: "예식홀" }));
    advanceRouteToPortalArrival();

    expect(player).toHaveStyle({ left: "495px", top: "105px", zIndex: "1105" });
    expect(Number(player.style.zIndex)).toBeLessThan(Number(desk?.style.zIndex));
  });

  it("keeps map diagnostics hidden behind an explicit developer URL toggle", async () => {
    const originalUrl = window.location.href;
    window.history.replaceState({}, "", "/?mapAudit=0");
    try {
      render(<GameWorld profile={profile} />);

      expect(screen.queryByTestId("world-geometry-audit")).not.toBeInTheDocument();
      const toggle = screen.getByRole("button", { name: "지도 진단 켜기" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(toggle);
      expect(screen.getByTestId("world-geometry-audit")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "지도 진단 끄기" })).toHaveAttribute("aria-pressed", "true");
      expect(new URLSearchParams(window.location.search).get("mapAudit")).toBe("1");
      expect(new URLSearchParams(window.location.search).get("mapAuditLayers"))
        .toBe("grid,collision,depth,heatmap,labels");
      expect(new URLSearchParams(window.location.search).get("mapAuditHeatmap")).toBe("color");
      expect(screen.getByRole("button", { name: "진단 오류 없음" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "충돌 영역 숨기기" }));
      expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-collision", "false");
      expect(new URLSearchParams(window.location.search).get("mapAuditLayers")).toBe("grid,depth,heatmap,labels");
      fireEvent.change(screen.getByRole("combobox", { name: "히트맵 표시 방식" }), {
        target: { value: "contrast" }
      });
      expect(screen.getByTestId("world-geometry-audit")).toHaveAttribute("data-heatmap-mode", "contrast");
      expect(new URLSearchParams(window.location.search).get("mapAuditHeatmap")).toBe("contrast");

      fireEvent.change(screen.getByRole("combobox", { name: "진단 구역 즉시 이동" }), {
        target: { value: "ceremony-hall" }
      });
      expect(screen.getByLabelText("예식홀 지도")).toBeInTheDocument();
      expect(screen.getByLabelText("하객1")).toHaveStyle({ left: "375px", top: "1785px" });
      expect(screen.getByText("예식홀 진단 위치로 이동했어요")).toBeInTheDocument();
      expect(window.location.search).toContain("mapAuditZone=ceremony-hall");
      expect(window.localStorage.getItem(journeyProgressStorageKey)).toBeNull();
      expect(window.localStorage.getItem(worldSessionStorageKey)).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "현재 진단 링크 복사" }));
      });
      expect(copyText).toHaveBeenCalled();
      const copiedDiagnosticUrl = new URL(vi.mocked(copyText).mock.calls.at(-1)?.[0] ?? "", window.location.origin);
      expect(copiedDiagnosticUrl.searchParams.get("mapAuditZone")).toBe("ceremony-hall");
      expect(copiedDiagnosticUrl.searchParams.get("mapAuditLayers")).toBe("grid,depth,heatmap,labels");
      expect(copiedDiagnosticUrl.searchParams.get("mapAuditHeatmap")).toBe("contrast");
      expect(screen.getByRole("button", { name: "현재 진단 링크 복사" })).toHaveTextContent("COPIED");

      fireEvent.click(screen.getByRole("button", { name: "지도 진단 끄기" }));
      expect(screen.queryByTestId("world-geometry-audit")).not.toBeInTheDocument();
      expect(window.location.search).toBe("?mapAudit=0");
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });

  it("opens shared diagnostic zone links and cycles zones with developer shortcuts", () => {
    const originalUrl = window.location.href;
    window.history.replaceState({}, "", "/?mapAudit=1&mapAuditZone=banquet&mapAuditLayers=grid,depth&mapAuditHeatmap=pattern");
    try {
      render(<GameWorld profile={profile} />);

      const selector = screen.getByRole("combobox", { name: "진단 구역 즉시 이동" });
      expect(selector).toHaveValue("banquet");
      expect(screen.getByLabelText("연회장 지도")).toBeInTheDocument();
      expect(screen.getByText("연회장 진단 링크로 바로 이동했어요")).toBeInTheDocument();
      expect(window.localStorage.getItem(worldSessionStorageKey)).toBeNull();
      expect(screen.getByRole("button", { name: "충돌 영역 표시" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "전경 식별자 표시" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("combobox", { name: "히트맵 표시 방식" })).toHaveValue("pattern");

      fireEvent.keyDown(window, { key: "[" });
      expect(selector).toHaveValue("ceremony-hall");
      expect(screen.getByLabelText("예식홀 지도")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "0" });
      expect(selector).toHaveValue("restroom");
      expect(screen.getByLabelText("화장실 지도")).toBeInTheDocument();
      expect(window.location.search).toContain("mapAuditZone=restroom");

      selector.focus();
      fireEvent.keyDown(selector, { key: "1" });
      expect(selector).toHaveValue("restroom");
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
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
    expect(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` }).parentElement)
      .toHaveStyle({ left: "360px", top: "285px", zIndex: "1285" });
    expect(flowerFront).toHaveAttribute("src", "/assets/maps/v2/bridal-room/flower-arrangement-front.png");
    expect(flowerFront).toHaveStyle({ left: "240px", top: "300px", width: "90px", height: "120px", zIndex: "1397" });

    fireEvent.click(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` }));
    expect(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` })).toHaveAttribute("data-approaching", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    advanceInteractionRoute();
    expect(screen.getByLabelText(`${brideNpcLabel}의 인사`)).toHaveTextContent("하객1님");
    expect(screen.queryByLabelText("도착 후 다음 행동")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "축하 전하기" }));
    expect(screen.getByRole("status", { name: "하객1님의 축하" })).toBeInTheDocument();
    expect(screen.getByLabelText(`${brideNpcLabel}의 인사`)).toHaveTextContent("더 환하게");
    expect(window.localStorage.getItem(zoneMiniQuestStorageKey)).toContain("bridal-greeting");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "두 사람 소개" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("신랑신부 정원");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    fireEvent.click(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` }));
    expect(screen.getByLabelText(`${brideNpcLabel}의 인사`)).toHaveTextContent("다시 인사");

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
      ["210px", "270px", "table-floral.png", "1490"],
      ["690px", "270px", "table-dining.png", "1468"],
      ["210px", "570px", "table-dining.png", "1768"],
      ["690px", "570px", "table-floral.png", "1790"]
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
    advanceInteractionRoute();
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

  it("switches the guest across both banquet table depth rows while walking", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();
    travelThroughPortal("연회장");

    const control = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");
    const tables = [...container.querySelectorAll<HTMLElement>('img[data-decoration="banquet-table"]')];
    expect(player).toHaveStyle({ left: "135px", top: "465px", zIndex: "1465" });
    expect(Number(player.style.zIndex)).toBeLessThan(Number(tables[0].style.zIndex));

    moveWithKeyboard(control, "ArrowDown", 2);
    expect(player).toHaveStyle({ left: "135px", top: "525px", zIndex: "1525" });
    expect(Number(player.style.zIndex)).toBeGreaterThan(Number(tables[0].style.zIndex));
    expect(Number(player.style.zIndex)).toBeLessThan(Number(tables[2].style.zIndex));

    moveWithKeyboard(control, "ArrowDown", 10);
    expect(player).toHaveStyle({ left: "135px", top: "825px", zIndex: "1825" });
    expect(Number(player.style.zIndex)).toBeGreaterThan(Number(tables[2].style.zIndex));

    moveWithKeyboard(control, "ArrowUp", 2);
    expect(player).toHaveStyle({ left: "135px", top: "765px", zIndex: "1765" });
    expect(Number(player.style.zIndex)).toBeLessThan(Number(tables[2].style.zIndex));
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
    expect(screen.getByRole("button", { name: `${groomNpcLabel}와 대화하기` }).parentElement)
      .toHaveStyle({ left: "360px", top: "255px", zIndex: "1255" });
    expect(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` }).parentElement)
      .toHaveStyle({ left: "420px", top: "255px", zIndex: "1255" });
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
      zIndex: "1277"
    });
    expect(bouquets).toHaveLength(4);
    [
      ["240px", "480px", "1555"],
      ["480px", "720px", "1795"],
      ["240px", "960px", "2035"],
      ["480px", "1200px", "2275"]
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

  it("switches the guest behind and in front of the ceremony aisle bouquet while walking", () => {
    const { container } = render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();
    travelThroughPortal("예식홀");

    const control = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");
    const bouquets = [...container.querySelectorAll<HTMLElement>('img[data-decoration="aisle-bouquet"]')];
    const bottomBouquet = bouquets[3];
    expect(player).toHaveStyle({ left: "375px", top: "1785px", zIndex: "2785" });
    expect(Number(player.style.zIndex)).toBeGreaterThan(Number(bottomBouquet.style.zIndex));

    moveWithKeyboard(control, "ArrowRight", 3);
    moveWithKeyboard(control, "ArrowUp", 18);
    expect(player).toHaveStyle({ left: "465px", top: "1245px", zIndex: "2245" });
    expect(Number(player.style.zIndex)).toBeLessThan(Number(bottomBouquet.style.zIndex));

    moveWithKeyboard(control, "ArrowDown", 2);
    expect(player).toHaveStyle({ left: "465px", top: "1305px", zIndex: "2305" });
    expect(Number(player.style.zIndex)).toBeGreaterThan(Number(bottomBouquet.style.zIndex));
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
    const spotButton = getDirectionsWorldSpot();

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
    const npcButton = screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` });
    fireEvent.click(npcButton);
    expect(screen.queryByLabelText(`${brideNpcLabel}의 인사`)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    advanceRouteToPortalArrival();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
    fireEvent.click(npcButton);
    expect(screen.queryByLabelText(`${brideNpcLabel}의 인사`)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "fade-out");
    fireEvent.click(npcButton);
    expect(screen.queryByLabelText(`${brideNpcLabel}의 인사`)).not.toBeInTheDocument();

    finishPortalFadeOut();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the open menu when portal arrival starts", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    advanceRouteToPortalArrival();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "arrival");
  });

  it("cancels a pending portal route when a regular spot opens", () => {
    render(<GameWorld profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기" }));
    fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "축하 쓰기" }));

    [0, 240, 480, 720].forEach(advanceAnimation);

    expect(screen.getByRole("dialog", { name: "방명록 우체통" })).toBeInTheDocument();
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("renders the actual world dimensions, pixel coordinates, and camera transform", () => {
    render(<GameWorld profile={profile} />);
    const stage = screen.getByLabelText("우리 집 지도");
    const player = screen.getByLabelText("하객1");

    expect(stage).toHaveStyle({ width: "600px", height: "720px" });
    expect(stage.style.transform).toContain("translate3d(");
    expect(player).toHaveStyle({ left: "285px", top: "375px", zIndex: "1375" });
  });

  it("recenters the camera after a Safari orientation viewport change", () => {
    render(<GameWorld profile={profile} />);
    const viewport = screen.getByTestId("world-map-viewport");
    const stage = screen.getByLabelText("우리 집 지도");

    expect(stage.style.transform).toContain("translate3d(-90px, -115px, 0)");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 874, 352));

    act(() => window.dispatchEvent(new Event("orientationchange")));
    advanceAnimation(manualAnimationClock);

    expect(stage.style.transform).toContain("translate3d(152px, -199px, 0)");
  });

  it("keeps portal effects behind characters while information buttons stay above the map", () => {
    render(<GameWorld profile={profile} />);

    const portal = screen.getByRole("button", { name: "동네로 나가기" });
    expect(portal).toHaveStyle({ zIndex: "1005" });
    expect(screen.getByLabelText("하객1")).toHaveStyle({ zIndex: "1375" });
    expect(Number(portal.style.zIndex)).toBeLessThan(worldDepth(105 - 88));
    expect(getDirectionsWorldSpot()).toHaveStyle({ zIndex: "9000" });
  });

  it("renders only three tile-local portal effects without global beams or particles", () => {
    render(<GameWorld profile={profile} />);
    const portal = screen.getByRole("button", { name: "동네로 나가기" });
    const effect = portal.querySelector(".world-portal__effect");

    expect(portal).toHaveAccessibleName("동네로 나가기");
    expect(effect).toHaveAttribute("aria-hidden", "true");
    expect(effect?.querySelectorAll(".world-portal__tile")).toHaveLength(3);
    expect(portal).toHaveAttribute("data-congestion", "open");
    expect(portal.querySelector(".world-portal__congestion")).toHaveTextContent("여유 3/3");
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

    fireEvent.click(map, { clientX: 145, clientY: 280 });
    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "255px", top: "375px" });
    advanceAnimation(239);
    expect(player).toHaveStyle({ left: "255px" });
    advanceAnimation(240);
    expect(player).toHaveStyle({ left: "225px" });
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

  it("follows a selected realtime guest and exposes a stop control", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest()]
    }));

    openCompanionDock();
    fireEvent.click(within(screen.getByLabelText("같이 걷기"))
      .getByRole("button", { name: "하객2" }));

    expect(socket.sentMessages.map((message) => JSON.parse(message))).toContainEqual({
      type: "companion_invite",
      targetGuestId: "guest_remote"
    });
    expect(screen.getByText("하객2님의 응답 기다리는 중")).toBeInTheDocument();
    act(() => socket.emitJson({
      type: "companion_replied",
      guestId: "guest_remote",
      guestNickname: "하객2",
      accepted: true,
      zoneId: "home"
    }));

    expect(screen.getByText("하객2님과 동행 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "동행 그만하기" })).toBeInTheDocument();
    expect(document.querySelector(".world-companion-link")).toBeInTheDocument();
    expect(screen.getByText("하객2님을 따라 이동 중")).toBeInTheDocument();
  });

  it("starts mutual companionship only after accepting an incoming invitation", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest()]
    }));
    act(() => socket.emitJson({
      type: "companion_invited",
      requesterGuestId: "guest_remote",
      requesterNickname: "하객2",
      zoneId: "home"
    }));

    expect(screen.getByRole("dialog", { name: "동행 초대" })).toHaveTextContent("하객2님의 같이 걷기 초대");
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    openCompanionDock();

    expect(socket.sentMessages.map((message) => JSON.parse(message))).toContainEqual({
      type: "companion_reply",
      requesterGuestId: "guest_remote",
      accepted: true
    });
    expect(screen.getByText("하객2님과 동행 중")).toBeInTheDocument();
    expect(screen.getByText("상대가 내 걸음을 따라와요")).toBeInTheDocument();
  });

  it("lets the companion leader choose a shared portal and waits for both guests", async () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest()]
    }));
    act(() => socket.emitJson({
      type: "companion_invited",
      requesterGuestId: "guest_remote",
      requesterNickname: "하객2",
      zoneId: "home"
    }));
    fireEvent.click(screen.getByRole("button", { name: "수락" }));

    openCompanionDock();
    fireEvent.click(screen.getByRole("button", { name: "동행 공동 목적지 선택" }));
    await revealLazyGameFeature();
    const destinationSheet = screen.getByRole("dialog", { name: "동행 공동 목적지 선택" });
    fireEvent.click(within(destinationSheet).getByRole("button", { name: /동네 거리/ }));

    expect(socket.sentMessages.map((message) => JSON.parse(message))).toContainEqual({
      type: "companion_destination",
      targetGuestId: "guest_remote",
      portalId: "home-to-neighborhood",
      destinationZoneId: "neighborhood"
    });
    advanceRouteToPortalArrival();
    expect(screen.getByText("포털에 도착했어요 · 동행 하객을 기다리는 중")).toBeInTheDocument();
    expect(socket.sentMessages.map((message) => JSON.parse(message))).toContainEqual({
      type: "companion_portal_ready",
      targetGuestId: "guest_remote",
      portalId: "home-to-neighborhood",
      destinationZoneId: "neighborhood"
    });

    act(() => socket.emitJson({
      type: "companion_portal_ready",
      guestId: "guest_remote",
      portalId: "home-to-neighborhood",
      destinationZoneId: "neighborhood"
    }));
    expect(screen.getByTestId("world-portal-transition")).toBeInTheDocument();
  });

  it("walks to a celebration item before collecting it", () => {
    startNearCelebrationItem();
    render(<GameWorld profile={profile} />);
    const collectButton = screen.getByRole("button", { name: "축하 꽃잎 수집하기" });

    fireEvent.click(collectButton);

    advanceInteractionRoute();
    expect(screen.getByLabelText(/축하 아이템 1\//)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "축하 꽃잎 수집하기" })).not.toBeInTheDocument();
  });

  it("opens the collection map and starts guidance to a remaining item", async () => {
    render(<GameWorld profile={profile} />);

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /축하 아이템 지도/ }));
    await revealLazyGameFeature();
    const guide = screen.getByRole("dialog", { name: "축하 아이템 수집 지도" });
    expect(within(guide).getByRole("region", { name: "맵별 수집 현황" })).toBeInTheDocument();
    fireEvent.click(within(guide).getByRole("button", { name: /축하 꽃잎/ }));

    expect(screen.queryByRole("dialog", { name: "축하 아이템 수집 지도" })).not.toBeInTheDocument();
    expect(screen.getByText("축하 꽃잎 가까이 이동 중")).toBeInTheDocument();
    expect(screen.getAllByTestId("minimap-collectible-marker")).toHaveLength(1);
  });

  it("수집 아이템은 가까이 가거나 안내를 시작했을 때만 나타난다", async () => {
    render(<GameWorld profile={profile} />);
    expect(screen.queryByRole("button", { name: /수집하기/ })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("minimap-collectible-marker")).toHaveLength(0);

    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /축하 아이템 지도/ }));
    await revealLazyGameFeature();
    const guide = screen.getByRole("dialog", { name: "축하 아이템 수집 지도" });
    fireEvent.click(within(guide).getByRole("button", { name: /축하 꽃잎/ }));

    expect(screen.getByRole("button", { name: "축하 꽃잎 수집하기" })).toBeInTheDocument();
  });

  it("unlocks the limited photo frame after collecting all thirty items", () => {
    const remainingId = "home-petal";
    window.localStorage.setItem(celebrationCollectionStorageKey, JSON.stringify(
      allCelebrationCollectibles().map(({ id }) => id).filter((id) => id !== remainingId)
    ));
    startNearCelebrationItem(remainingId);
    render(<GameWorld profile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "축하 꽃잎 수집하기" }));
    advanceInteractionRoute();

    expect(screen.getByRole("dialog", { name: "축하 아이템 완주 보상" }))
      .toHaveTextContent("축복의 꽃 정원 프레임 획득");
    expect(screen.getByRole("button", { name: /축하 아이템 30\/30/ })).toBeInTheDocument();
  });

  it("opens a combined game memory album from the game vault", async () => {
    render(<GameWorld profile={profile} />);
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /게임 추억/ }));
    await revealLazyGameFeature();

    expect(screen.getByRole("dialog", { name: "게임 추억 앨범" })).toBeInTheDocument();
    expect(screen.getByText("축하 아이템")).toBeInTheDocument();
  });

  it("creates a cooperative flower shower when two guests celebrate in the ceremony hall", async () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest({ zoneId: "ceremony-hall" })]
    }));
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: "예식홀 바로 이동" }));
    openQuickGameTools();
    fireEvent.click(screen.getByRole("button", { name: "하객 리액션 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "축하 보내기" }));
    act(() => socket.emitJson({
      type: "guest_reacted",
      guestId: "guest_remote",
      reaction: "celebrate",
      zoneId: "ceremony-hall"
    }));

    expect(screen.getByRole("status", { name: "하객 협동 축하 성공" })).toHaveTextContent("함께 만든 축하 꽃비");
    expect(window.localStorage.getItem(gameMemoryAlbumStorageKey)).toContain("celebration");
    fireEvent.click(screen.getByRole("button", { name: "단체 사진 남기기" }));
    await revealLazyGameFeature();
    expect(screen.getByRole("dialog", { name: "웨딩 포토존 촬영" })).toHaveTextContent("하객2님과 함께 촬영합니다");
  });

  it("stops before an occupied tile and continues after the remote guest moves", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest({ x: 315, y: 375 })]
    }));
    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "285px", top: "375px" });
    expect(screen.getByText("앞 타일에 다른 캐릭터가 있어 잠시 멈췄어요")).toBeInTheDocument();

    act(() => socket.emitJson({
      type: "guest_moved",
      guestId: "guest_remote",
      position: { x: 345, y: 375, direction: "right", moving: true, seq: 1, zoneId: "home" }
    }));
    advanceAnimation(300);
    expect(player).toHaveStyle({ left: "315px", top: "375px" });
  });

  it("renders remote guest movement with the same neutral-separated walk cycle", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest({ moving: true, seq: 1 })]
    }));
    const sprite = screen.getByLabelText("하객2 캐릭터");

    expect(sprite).toHaveAttribute("data-walk-frame", "0");
    act(() => socket.emitJson({
      type: "guest_moved",
      guestId: "guest_remote",
      position: { x: 195, y: 405, direction: "right", moving: true, seq: 2, zoneId: "home" }
    }));
    expect(sprite).toHaveAttribute("data-walk-frame", "1");

    act(() => socket.emitJson({
      type: "guest_moved",
      guestId: "guest_remote",
      position: { x: 225, y: 405, direction: "right", moving: true, seq: 3, zoneId: "home" }
    }));
    expect(sprite).toHaveAttribute("data-walk-frame", "2");
  });

  it("sends a local reaction without interrupting joystick movement", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({ type: "welcome", guestId: "guest_self", guests: [] }));
    socket.sentMessages.length = 0;

    const joystick = screen.getByLabelText("가상 조이스틱");
    const player = screen.getByLabelText("하객1");
    openQuickGameTools();
    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "하객 리액션 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "하트 보내기" }));

    expect(screen.getByRole("status", { name: "하객1님의 하트" })).toBeInTheDocument();
    expect(socket.sentMessages.map((message) => JSON.parse(message))).toContainEqual({
      type: "react",
      reaction: "heart"
    });

    advanceAnimation(0);
    expect(player).toHaveStyle({ left: "315px", top: "375px" });
    expect(screen.getByRole("status", { name: "하객1님의 하트" })).toBeInTheDocument();
  });

  it("keeps the reaction control inside the bottom action dock", () => {
    render(<GameWorld profile={profile} />);

    openQuickGameTools();
    const reactionButton = screen.getByRole("button", { name: "하객 리액션 열기" });
    expect(reactionButton.closest(".guest-reaction-dock")?.parentElement)
      .toHaveClass("world-control-actions");
  });

  it("가까운 포털을 상황형 HUD로 안내하고 기존 보행 경로를 시작한다", () => {
    window.localStorage.setItem(worldSessionStorageKey, JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: 285, y: 225 },
      direction: "up",
      guideCheckpointId: null,
      updatedAt: "2026-07-29T00:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "동네로 나가기 이동" }));
    expect(screen.getByRole("button", { name: "동네로 나가기" })).toHaveClass("world-portal--target");
    expect(screen.getByTestId("world-portal-transition")).toHaveAttribute("data-phase", "idle");
  });

  it("상단 다음 목적지와 같은 짧은 퀘스트 카드는 중복해서 표시하지 않는다", () => {
    render(<GameWorld profile={profile} />);

    expect(screen.queryByRole("button", { name: "오시는 길 확인" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 목적지 오시는 길, 길 안내 시작" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "하객 리액션 열기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "게임 도구 열기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "초대장 메뉴" })).toBeInTheDocument();
  });

  it("보조 게임 기능은 여정 안의 닫힌 선택 기능에 보관한다", () => {
    render(<GameWorld profile={profile} />);
    openJourneyTools();

    const summary = screen.getByText("게임 기록·설정").closest("summary");
    const vault = summary?.closest("details");
    expect(vault).toHaveAttribute("data-optional-features", "true");
    expect(vault).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: /축하 아이템 지도/ }).closest("details")).toBe(vault);
    expect(screen.getByRole("button", { name: /게임 추억/ }).closest("details")).toBe(vault);

    fireEvent.click(summary as HTMLElement);
    expect(vault).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: /축하 아이템 지도/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /게임 추억/ })).toBeInTheDocument();
  });

  it("최근 사용한 선택 기능만 다음 방문에 은은하게 강조한다", async () => {
    render(<GameWorld profile={profile} />);
    openGameVault();
    fireEvent.click(screen.getByRole("button", { name: /포토앨범/ }));
    await revealLazyGameFeature();
    fireEvent.click(screen.getByRole("button", { name: "포토앨범 닫기" }));

    openJourneyTools();
    expect(screen.getByText("최근 사용 · 포토앨범")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /포토앨범/ })).toHaveAttribute("data-recent", "true");
    expect(JSON.parse(window.localStorage.getItem(optionalFeatureUsageStorageKey) ?? "null"))
      .toMatchObject({ recentId: "photo-album", usedIds: ["photo-album"] });
  });

  it("완주 후 HUD를 예식 정보와 방명록 중심으로 전환한다", () => {
    window.localStorage.setItem(journeyProgressStorageKey, JSON.stringify({
      version: 1,
      completedIds: ["directions", "gallery", "bride", "ceremony", "guestbook"],
      updatedAt: "2026-08-03T00:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    const hud = document.querySelector(".world-hud");
    expect(hud).toHaveAttribute("data-journey-complete", "true");
    expect(hud).toHaveAttribute("data-density", "complete");
    expect(screen.getByRole("navigation", { name: "완주 후 초대장 바로가기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /예식 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /방명록/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /다음 목적지/ })).not.toBeInTheDocument();
  });

  it("카메라 가장자리에서 장소 버튼을 화면 안쪽으로 자동 배치한다", () => {
    window.localStorage.setItem(worldSessionStorageKey, JSON.stringify({
      version: 1,
      zoneId: "home",
      position: { x: 735, y: 360 },
      direction: "right",
      guideCheckpointId: null,
      updatedAt: "2026-08-03T00:00:00.000Z"
    }));
    render(<GameWorld profile={profile} />);

    expect(getDirectionsWorldSpot()).toHaveAttribute("data-edge-shifted", expect.stringContaining("left"));
  });

  it("이동 중에도 상단 HUD 골격을 유지하고 상태 밀도만 갱신한다", () => {
    render(<GameWorld profile={profile} />);
    const joystick = screen.getByLabelText("가상 조이스틱");
    const hud = document.querySelector(".world-hud");

    fireEvent.keyDown(joystick, { key: "ArrowRight" });
    advanceAnimation(0);
    expect(hud).toHaveAttribute("data-density", "moving");
    act(() => vi.advanceTimersByTime(800));
    expect(hud).not.toHaveAttribute("data-auto-hidden");

    fireEvent.keyUp(joystick, { key: "ArrowRight" });
    finishJoystickRelease();
    advanceAnimation(300);
    expect(hud).not.toHaveAttribute("data-density", "moving");
  });

  it("shows and expires a remote guest reaction above that guest", () => {
    configureRealtime();
    render(<GameWorld profile={profile} />);
    const socket = MockWebSocket.instances[0];
    act(() => socket.emit("open"));
    act(() => socket.emitJson({
      type: "welcome",
      guestId: "guest_self",
      guests: [serverGuest()]
    }));

    act(() => socket.emitJson({
      type: "guest_reacted",
      guestId: "guest_remote",
      reaction: "celebrate",
      zoneId: "home"
    }));

    const remotePlayer = screen.getByLabelText("하객2");
    expect(within(remotePlayer).getByRole("status", { name: "하객2님의 축하" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2200));
    expect(screen.queryByRole("status", { name: "하객2님의 축하" })).not.toBeInTheDocument();
  });

  it("uses shared Y depth for NPCs", () => {
    render(<GameWorld profile={profile} />);
    travelFromHomeToLobby();
    travelThroughPortal("신부 대기실");

    expect(screen.getByRole("button", { name: `${brideNpcLabel}와 대화하기` }).parentElement)
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

    expect(screen.getByLabelText("같이 걷기 만석 · 혼자 둘러보기")).toBeInTheDocument();
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
