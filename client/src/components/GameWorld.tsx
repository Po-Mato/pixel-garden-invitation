import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  invitationContent,
  type ClientMessage,
  type Direction,
  type RoomGuest,
  type SpotId,
  type WorldZoneId
} from "@wedding-game/shared";
import { computeCameraTransform, screenToWorld, type ViewportSize } from "../game/camera";
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import { findTilePath } from "../game/pathfinding";
import {
  advanceTileInput,
  createTileInputState,
  tileInputRepeatIntervalMs,
  type TileInputState
} from "../game/tileInput";
import { gardenWorld, getWorldZone, type Point, type WorldPortal } from "../game/world";
import { connectRealtimeWithRetry, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { CharacterSprite } from "./CharacterSprite";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";
import { WeddingNpc } from "./WeddingNpc";
import { WorldDecoration } from "./WorldDecoration";

type GameWorldProps = { profile: EntryProfile };
type RealtimeStatus = "offline" | "connecting" | "reconnecting" | "online" | "full";
type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type RealtimeConnection = ReturnType<typeof connectRealtimeWithRetry>;
type PortalIntent = { portal: WorldPortal; path: Point[] };

const joystickDeadZone = 0.05;
const realtimeMoveIntervalMs = 100;
const defaultViewport: ViewportSize = { width: 390, height: 520 };
const samePoint = (first: Point, second: Point) => first.x === second.x && first.y === second.y;
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;
const pixelRect = (rect: { x: number; y: number; width: number; height: number }) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height
});

function withoutCurrentGuest(guests: RoomGuest[], currentGuestId: string | null): RoomGuest[] {
  return currentGuestId ? guests.filter((guest) => guest.guestId !== currentGuestId) : guests;
}

function upsertGuest(guests: RoomGuest[], guest: RoomGuest, currentGuestId: string | null): RoomGuest[] {
  if (guest.guestId === currentGuestId) return guests;
  const found = guests.some((candidate) => candidate.guestId === guest.guestId);
  return found
    ? guests.map((candidate) => (candidate.guestId === guest.guestId ? guest : candidate))
    : [...guests, guest];
}

function moveGuest(guests: RoomGuest[], guestId: string, position: MoveMessage): RoomGuest[] {
  return guests.map((guest) => guest.guestId === guestId ? {
    ...guest,
    x: position.x,
    y: position.y,
    direction: position.direction,
    moving: position.moving,
    seq: position.seq,
    zoneId: position.zoneId
  } : guest);
}

function realtimeStatusText(status: RealtimeStatus) {
  if (status === "online") return "실시간 정원";
  if (status === "full") return "실시간 만석 · 솔로 모드";
  if (status === "reconnecting") return "실시간 재연결 중";
  if (status === "connecting") return "실시간 연결 중";
  return "오프라인 정원";
}

export function GameWorld({ profile }: GameWorldProps) {
  const initialZone = getWorldZone(gardenWorld, gardenWorld.defaultZoneId);
  const [activeZoneId, setActiveZoneId] = useState<WorldZoneId>(initialZone.id);
  const activeZone = getWorldZone(gardenWorld, activeZoneId);
  const [position, setPosition] = useState<Point>(initialZone.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [portalIntent, setPortalIntentState] = useState<PortalIntent | null>(null);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(1);
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [travelStatus, setTravelStatus] = useState("우리 집에서 여정을 시작해요");
  const [viewport, setViewport] = useState<ViewportSize>(defaultViewport);
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeZoneIdRef = useRef<WorldZoneId>(initialZone.id);
  const positionRef = useRef<Point>(initialZone.spawn);
  const directionRef = useRef<Direction>("down");
  const portalIntentRef = useRef<PortalIntent | null>(null);
  const targetStepAtRef = useRef<number | null>(null);
  const tileInputStateRef = useRef<TileInputState | null>(null);
  const joystickWasMovingRef = useRef(false);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const currentGuestIdRef = useRef<string | null>(null);
  const moveSeqRef = useRef(0);
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);

  const setPortalIntent = useCallback((intent: PortalIntent | null) => {
    portalIntentRef.current = intent;
    setPortalIntentState(intent);
  }, []);

  const cancelPortalWalk = useCallback(() => {
    if (!portalIntentRef.current) return;
    setPortalIntent(null);
    setTravelStatus("포털 이동을 취소했어요");
    targetStepAtRef.current = null;
  }, [setPortalIntent]);

  const sendRealtimeMove = useCallback((nextPosition: Point, isMoving: boolean, nextDirection: Direction, zoneId: WorldZoneId, now: number) => {
    moveThrottleRef.current?.({
      type: "move",
      x: nextPosition.x,
      y: nextPosition.y,
      direction: nextDirection,
      moving: isMoving,
      seq: moveSeqRef.current + 1,
      zoneId
    }, now);
  }, []);

  const moveToZone = useCallback((zoneId: WorldZoneId, spawn?: Point) => {
    const zone = getWorldZone(gardenWorld, zoneId);
    const nextPosition = snapToGrid(spawn ?? zone.spawn, zone);
    activeZoneIdRef.current = zone.id;
    positionRef.current = nextPosition;
    directionRef.current = "down";
    setActiveZoneId(zone.id);
    setPosition(nextPosition);
    setTarget(null);
    setPortalIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setDirection("down");
    setMoving(false);
    setStepFrame(1);
    setTravelStatus(`${zone.label} 도착`);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;

    const connection = connectionRef.current;
    if (connection) {
      const message: MoveMessage = {
        type: "move",
        x: nextPosition.x,
        y: nextPosition.y,
        direction: "down",
        moving: false,
        seq: moveSeqRef.current + 1,
        zoneId: zone.id
      };
      moveSeqRef.current = message.seq;
      connection.send(message);
    }
  }, [setPortalIntent]);

  const openSpot = useCallback((spotId: SpotId) => {
    setMenuOpen(false);
    setActiveSpotId(spotId);
  }, []);

  useEffect(() => {
    const element = mapViewportRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeZoneId]);

  useEffect(() => {
    if (!menuOpen) return;
    menuCloseButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl) {
      setRealtimeStatus("offline");
      setRemoteGuests([]);
      return;
    }

    let active = true;
    let connection: RealtimeConnection;
    currentGuestIdRef.current = null;
    moveSeqRef.current = 0;
    setRemoteGuests([]);
    setRealtimeStatus("connecting");

    try {
      connection = connectRealtimeWithRetry(
        getRoomUrl(workerUrl, import.meta.env.VITE_INVITATION_ID ?? "sample-garden"),
        () => ({
          type: "join",
          nickname: profile.nickname,
          appearance: profile.appearance,
          zoneId: activeZoneIdRef.current
        }),
        {
          onOpen: () => active && setRealtimeStatus("online"),
          onClose: () => {
            if (!active) return;
            currentGuestIdRef.current = null;
            setRemoteGuests([]);
            setRealtimeStatus("reconnecting");
          },
          onMessage: (message) => {
            if (!active) return;
            if (message.type === "error" && message.code === "room_full") {
              currentGuestIdRef.current = null;
              setRemoteGuests([]);
              setRealtimeStatus("full");
              return;
            }
            if (message.type === "welcome") {
              currentGuestIdRef.current = message.guestId;
              setRemoteGuests(withoutCurrentGuest(message.guests, message.guestId));
              const presence: MoveMessage = {
                type: "move",
                x: positionRef.current.x,
                y: positionRef.current.y,
                direction: directionRef.current,
                moving: false,
                seq: moveSeqRef.current + 1,
                zoneId: activeZoneIdRef.current
              };
              moveSeqRef.current = presence.seq;
              connection.send(presence);
              return;
            }
            if (message.type === "guest_joined") {
              setRemoteGuests((guests) => upsertGuest(guests, message.guest, currentGuestIdRef.current));
              return;
            }
            if (message.type === "guest_moved") {
              if (message.guestId !== currentGuestIdRef.current) {
                setRemoteGuests((guests) => moveGuest(guests, message.guestId, { type: "move", ...message.position }));
              }
              return;
            }
            if (message.type === "guest_left") {
              setRemoteGuests((guests) => guests.filter((guest) => guest.guestId !== message.guestId));
              return;
            }
            if (message.type === "room_state") {
              setRemoteGuests(withoutCurrentGuest(message.guests, currentGuestIdRef.current));
            }
          }
        }
      );
    } catch {
      setRealtimeStatus("offline");
      return;
    }

    connectionRef.current = connection;
    moveThrottleRef.current = createMoveThrottle((message) => {
      moveSeqRef.current = message.seq;
      connection.send(message);
    }, realtimeMoveIntervalMs);

    return () => {
      active = false;
      if (connectionRef.current === connection) connectionRef.current = null;
      moveThrottleRef.current = null;
      currentGuestIdRef.current = null;
      connection.close();
    };
  }, [profile.appearance, profile.nickname]);

  useEffect(() => {
    const hasJoystickInput = hasJoystickMovement(joystickVector);
    const movementTarget = portalIntent?.path[0] ?? target;
    if (!movementTarget && !hasJoystickInput) {
      targetStepAtRef.current = null;
      tileInputStateRef.current = null;
      return;
    }

    const movementVector = joystickVector;
    let frame = 0;
    function tick(now: number) {
      const current = positionRef.current;
      const hasDirectionalInput = hasJoystickMovement(movementVector);
      const nextDirection = hasDirectionalInput
        ? directionFromVector(movementVector)
        : movementTarget
          ? directionTowardPoint(current, movementTarget)
          : null;

      if (!nextDirection) {
        setMoving(false);
        setStepFrame(1);
        setTarget(null);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        return;
      }

      if (hasDirectionalInput) {
        const input = tileInputStateRef.current ?? createTileInputState(nextDirection, now);
        const result = advanceTileInput(input, nextDirection, now);
        tileInputStateRef.current = result.state;
        if (!result.shouldStep) {
          frame = requestAnimationFrame(tick);
          return;
        }
      } else {
        tileInputStateRef.current = null;
        const nextStepAt = targetStepAtRef.current ?? now;
        if (now < nextStepAt) {
          frame = requestAnimationFrame(tick);
          return;
        }
        targetStepAtRef.current = now + tileInputRepeatIntervalMs;
      }

      const next = computeNextGridPosition({ current, direction: nextDirection, world: activeZone });
      const didMove = !samePoint(current, next);
      const reachedTarget = movementTarget ? samePoint(next, movementTarget) : false;
      directionRef.current = nextDirection;
      setDirection(nextDirection);

      if (!didMove) {
        setMoving(false);
        setStepFrame(1);
        setTarget(null);
        setPortalIntent(null);
        setTravelStatus("길을 찾을 수 없어요");
        sendRealtimeMove(current, false, nextDirection, activeZone.id, now);
        targetStepAtRef.current = null;
        return;
      }

      positionRef.current = next;
      setPosition(next);
      setMoving(true);
      setStepFrame((currentFrame) => (currentFrame + 1) % 3);
      sendRealtimeMove(next, hasDirectionalInput || !reachedTarget, nextDirection, activeZone.id, now);

      if (reachedTarget) {
        if (portalIntent) {
          if (portalIntent.path.length > 1) {
            setPortalIntent({ ...portalIntent, path: portalIntent.path.slice(1) });
          } else {
            directionRef.current = portalIntent.portal.facing;
            setDirection(portalIntent.portal.facing);
            setMoving(false);
            setStepFrame(1);
            moveToZone(portalIntent.portal.to, portalIntent.portal.spawn);
          }
        } else {
          setMoving(false);
          setStepFrame(1);
          setTarget(null);
          targetStepAtRef.current = null;
        }
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeZone, joystickVector, moveToZone, portalIntent, sendRealtimeMove, setPortalIntent, target]);

  function handlePortalClick(portalItem: WorldPortal) {
    const route = findTilePath(activeZone, positionRef.current, portalItem.approach);
    setTarget(null);
    setJoystickVector({ x: 0, y: 0 });
    targetStepAtRef.current = null;
    if (!route) {
      setPortalIntent(null);
      setTravelStatus("길을 찾을 수 없어요");
      return;
    }
    if (route.length === 0) {
      moveToZone(portalItem.to, portalItem.spawn);
      return;
    }
    setPortalIntent({ portal: portalItem, path: route });
    setTravelStatus(`${portalItem.label}까지 이동 중`);
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    cancelPortalWalk();
    const rect = event.currentTarget.getBoundingClientRect();
    const worldPoint = screenToWorld({
      client: { x: event.clientX, y: event.clientY },
      viewportRect: rect,
      camera
    });
    const nextTarget = snapToGrid(worldPoint, activeZone);
    const nextDirection = directionTowardPoint(positionRef.current, nextTarget);
    if (nextDirection) directionRef.current = nextDirection;
    setTarget(nextTarget);
    targetStepAtRef.current = null;
  }

  function handleJoystickVectorChange(vector: Point) {
    const wasMoving = joystickWasMovingRef.current;
    const isMoving = hasJoystickMovement(vector);
    if (isMoving) cancelPortalWalk();
    setJoystickVector(vector);

    if (isMoving) {
      joystickWasMovingRef.current = true;
      setTarget(null);
      targetStepAtRef.current = null;
      directionRef.current = directionFromVector(vector);
      return;
    }

    joystickWasMovingRef.current = false;
    tileInputStateRef.current = null;
    if (wasMoving) {
      setMoving(false);
      setStepFrame(1);
      sendRealtimeMove(positionRef.current, false, directionRef.current, activeZone.id, performance.now());
    }
  }

  const camera = computeCameraTransform({ player: position, viewport, zoom: 1 });

  return (
    <section className="game-world" aria-label="모바일 청첩장 월드">
      <header className="world-hud">
        <div className="world-hud__status">
          <div className="world-zone-summary">
            <span>현재 구역 · {activeZone.journeyIndex + 1}/10</span>
            <strong>{activeZone.label}</strong>
            <small>{activeZone.subtitle}</small>
          </div>
          <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>{realtimeStatusText(realtimeStatus)}</div>
        </div>
        <ol className="world-journey" aria-label="하객 여정">
          {gardenWorld.zones.map((zone) => (
            <li key={zone.id} aria-current={zone.id === activeZone.id ? "location" : undefined}>
              <span>{zone.label}</span>
            </li>
          ))}
        </ol>
        <p className="world-travel-status" aria-live="polite">{travelStatus}</p>
      </header>

      <div className="world-map-shell">
        <div
          ref={mapViewportRef}
          className={`world-map world-map--${activeZone.theme}`}
          data-testid="world-map-viewport"
          onClick={handleMapClick}
        >
          <div
            className="world-map__stage"
            aria-label={`${activeZone.label} 지도`}
            data-zone={activeZone.id}
            data-logical-width={activeZone.bounds.width}
            data-logical-height={activeZone.bounds.height}
            style={{
              width: activeZone.bounds.width,
              height: activeZone.bounds.height,
              transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`
            }}
          >
            {activeZone.paths.map((worldPath) => (
              <div
                key={worldPath.id}
                className={`world-path world-path--${worldPath.kind}`}
                style={pixelRect(worldPath)}
              />
            ))}
            <div className="world-decoration-layer">
              {activeZone.decorations.map((item) => <WorldDecoration key={item.id} decoration={item} />)}
            </div>
            {activeZone.spots.map((worldSpot) => {
              const content = invitationContent.spots.find((candidate) => candidate.id === worldSpot.id);
              return (
                <button
                  key={worldSpot.id}
                  type="button"
                  className={`world-spot world-spot--${worldSpot.id}`}
                  style={pixelRect(worldSpot)}
                  onClick={(event) => {
                    event.stopPropagation();
                    openSpot(worldSpot.id);
                  }}
                >
                  <span>{worldSpot.label}</span>
                  <small>{content?.actionLabel ?? "보기"}</small>
                </button>
              );
            })}
            {activeZone.portals.map((portalItem) => (
              <button
                key={portalItem.id}
                type="button"
                className={`world-portal${portalIntent?.portal.id === portalItem.id ? " world-portal--target" : ""}`}
                style={pixelRect(portalItem)}
                onClick={(event) => {
                  event.stopPropagation();
                  handlePortalClick(portalItem);
                }}
              >
                {portalItem.label}
              </button>
            ))}
            {remoteGuests.filter((guest) => guest.zoneId === activeZone.id).map((guest) => (
              <div
                key={guest.guestId}
                className="world-player player player--remote"
                aria-label={guest.nickname}
                data-remote-motion="pixel-step-3"
                style={{ left: guest.x, top: guest.y }}
              >
                <CharacterSprite
                  appearance={guest.appearance}
                  direction={guest.direction}
                  moving={guest.moving}
                  stepFrame={guest.seq % 3}
                  label={`${guest.nickname} 캐릭터`}
                />
                <span>{guest.nickname}</span>
              </div>
            ))}
            {activeZone.npcs.map((npc) => (
              <div key={npc.id} className="world-npc" style={{ left: npc.x, top: npc.y }}>
                <WeddingNpc id={npc.id} label={npc.label} onSelect={() => setActiveSpotId("couple")} />
              </div>
            ))}
            <div className="world-player player" aria-label={profile.nickname} style={{ left: position.x, top: position.y }}>
              <CharacterSprite
                appearance={profile.appearance}
                direction={direction}
                moving={moving}
                stepFrame={stepFrame}
                label={`${profile.nickname} 캐릭터`}
              />
              <span>{profile.nickname}</span>
            </div>
          </div>

          <div className="world-control-dock">
            <VirtualJoystick onVectorChange={handleJoystickVectorChange} />
            <button type="button" className="world-menu-button" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span aria-hidden="true">+</span>
              초대장 메뉴
            </button>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button type="button" className="world-menu-backdrop" aria-label="초대장 메뉴 닫기" onClick={() => setMenuOpen(false)} />
          <section className="world-menu-sheet" role="dialog" aria-modal="true" aria-label="초대장 바로가기">
            <header className="world-menu-sheet__header">
              <div><span>WEDDING MENU</span><h2>초대장 바로가기</h2></div>
              <button ref={menuCloseButtonRef} type="button" aria-label="초대장 메뉴 닫기" onClick={() => setMenuOpen(false)}>×</button>
            </header>
            <div className="world-menu-grid">
              {invitationContent.spots.map((item) => (
                <button key={item.id} type="button" onClick={() => openSpot(item.id)}>{item.actionLabel}</button>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {activeSpotId ? <SpotModal spotId={activeSpotId} nickname={profile.nickname} onClose={() => setActiveSpotId(null)} /> : null}
    </section>
  );
}
