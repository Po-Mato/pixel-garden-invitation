import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  invitationContent,
  type ClientMessage,
  type Direction,
  type RoomGuest,
  type SpotId,
  type WorldZoneId
} from "@wedding-game/shared";
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import {
  advanceTileInput,
  createTileInputState,
  tileInputRepeatIntervalMs,
  type TileInputState
} from "../game/tileInput";
import { gardenWorld, getWorldZone, getZoneForSpot, type Point } from "../game/world";
import { connectRealtimeWithRetry, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { CharacterSprite } from "./CharacterSprite";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";
import { WeddingNpc } from "./WeddingNpc";
import { WorldDecoration } from "./WorldDecoration";

type GameWorldProps = {
  profile: EntryProfile;
};

const joystickDeadZone = 0.05;
const realtimeMoveIntervalMs = 100;

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;
const samePoint = (first: Point, second: Point) => first.x === second.x && first.y === second.y;
type RealtimeStatus = "offline" | "connecting" | "reconnecting" | "online" | "full";
type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type RealtimeConnection = ReturnType<typeof connectRealtimeWithRetry>;

function withoutCurrentGuest(guests: RoomGuest[], currentGuestId: string | null): RoomGuest[] {
  return currentGuestId ? guests.filter((guest) => guest.guestId !== currentGuestId) : guests;
}

function upsertGuest(guests: RoomGuest[], guest: RoomGuest, currentGuestId: string | null): RoomGuest[] {
  if (guest.guestId === currentGuestId) {
    return guests;
  }

  const existingIndex = guests.findIndex((candidate) => candidate.guestId === guest.guestId);
  if (existingIndex === -1) {
    return [...guests, guest];
  }

  return guests.map((candidate, index) => (index === existingIndex ? guest : candidate));
}

function moveGuest(guests: RoomGuest[], guestId: string, position: MoveMessage): RoomGuest[] {
  return guests.map((guest) =>
    guest.guestId === guestId
      ? {
          ...guest,
          x: position.x,
          y: position.y,
          direction: position.direction,
          moving: position.moving,
          seq: position.seq,
          zoneId: position.zoneId
        }
      : guest
  );
}

function realtimeStatusText(status: RealtimeStatus) {
  if (status === "online") return "실시간 정원";
  if (status === "full") return "실시간 만석 · 솔로 모드";
  if (status === "reconnecting") return "실시간 재연결 중";
  if (status === "connecting") return "실시간 연결 중";
  return "오프라인 정원";
}

export function GameWorld({ profile }: GameWorldProps) {
  const [activeZoneId, setActiveZoneId] = useState<WorldZoneId>(gardenWorld.defaultZoneId);
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeZone = getWorldZone(gardenWorld, activeZoneId);
  const [position, setPosition] = useState<Point>(activeZone.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(1);
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const activeZoneIdRef = useRef<WorldZoneId>(gardenWorld.defaultZoneId);
  const positionRef = useRef<Point>(activeZone.spawn);
  const targetStepAtRef = useRef<number | null>(null);
  const tileInputStateRef = useRef<TileInputState | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const currentGuestIdRef = useRef<string | null>(null);
  const directionRef = useRef<Direction>("down");
  const moveSeqRef = useRef(0);
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);
  const joystickWasMovingRef = useRef(false);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const sendRealtimeMove = useCallback((nextPosition: Point, moving: boolean, direction: Direction, zoneId: WorldZoneId, now: number) => {
    const throttle = moveThrottleRef.current;
    if (!throttle) {
      return;
    }

    throttle(
      {
        type: "move",
        x: nextPosition.x,
        y: nextPosition.y,
        direction,
        moving,
        seq: moveSeqRef.current + 1,
        zoneId
      },
      now
    );
  }, []);

  const moveToZone = useCallback((zoneId: WorldZoneId, spawn?: Point) => {
    const zone = getWorldZone(gardenWorld, zoneId);
    const nextPosition = snapToGrid(spawn ?? zone.spawn, zone);

    activeZoneIdRef.current = zone.id;
    setActiveZoneId(zone.id);
    setTarget(null);
    setJoystickVector({ x: 0, y: 0 });
    setMoving(false);
    setStepFrame(1);
    setDirection("down");
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    positionRef.current = nextPosition;
    setPosition(nextPosition);
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
  }, []);

  const openSpot = useCallback((spotId: SpotId) => {
    const zone = getZoneForSpot(gardenWorld, spotId);

    if (zone.id !== activeZoneId) {
      moveToZone(zone.id, zone.spawn);
    }

    setMenuOpen(false);
    setActiveSpotId(spotId);
  }, [activeZoneId, moveToZone]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    menuCloseButtonRef.current?.focus();

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

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
          onOpen: () => {
            if (active) {
              setRealtimeStatus("online");
            }
          },
          onClose: () => {
            if (!active) {
              return;
            }

            currentGuestIdRef.current = null;
            setRemoteGuests([]);
            setRealtimeStatus("reconnecting");
          },
          onMessage: (message) => {
            if (!active) {
              return;
            }

            if (message.type === "error" && message.code === "room_full") {
              currentGuestIdRef.current = null;
              setRemoteGuests([]);
              setRealtimeStatus("full");
              return;
            }

            if (message.type === "welcome") {
              currentGuestIdRef.current = message.guestId;
              setRemoteGuests(withoutCurrentGuest(message.guests, message.guestId));
              const currentPosition = positionRef.current;
              const presence: MoveMessage = {
                type: "move",
                x: currentPosition.x,
                y: currentPosition.y,
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
              if (message.guestId === currentGuestIdRef.current) {
                return;
              }

              setRemoteGuests((guests) => moveGuest(guests, message.guestId, { type: "move", ...message.position }));
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
      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }
      moveThrottleRef.current = null;
      currentGuestIdRef.current = null;
      connection.close();
    };
  }, [profile.appearance, profile.nickname]);

  useEffect(() => {
    const hasJoystickInput = hasJoystickMovement(joystickVector);

    if (!target && !hasJoystickInput) {
      targetStepAtRef.current = null;
      tileInputStateRef.current = null;
      return;
    }

    const movementTarget = target;
    const movementVector = joystickVector;
    let frame = 0;

    function tick(now: number) {
      const current = positionRef.current;
      const hasDirectionalInput = hasJoystickMovement(movementVector);
      const direction = hasDirectionalInput
        ? directionFromVector(movementVector)
        : movementTarget
          ? directionTowardPoint(current, movementTarget)
          : null;

      if (!direction) {
        setMoving(false);
        setStepFrame(1);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        setTarget(null);
        return;
      }

      if (hasDirectionalInput) {
        const inputState = tileInputStateRef.current ?? createTileInputState(direction, now);
        const inputResult = advanceTileInput(inputState, direction, now);
        tileInputStateRef.current = inputResult.state;

        if (!inputResult.shouldStep) {
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

      const next = computeNextGridPosition({
        current,
        direction,
        world: activeZone
      });
      const didMove = !samePoint(current, next);
      const reachedTarget = movementTarget ? samePoint(next, movementTarget) : false;

      directionRef.current = direction;
      setDirection(direction);

      if (!didMove) {
        setMoving(false);
        setStepFrame(1);
        sendRealtimeMove(current, false, direction, activeZone.id, now);
        setTarget(null);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        return;
      }

      positionRef.current = next;
      setPosition(next);
      setMoving(true);
      setStepFrame((currentFrame) => (currentFrame + 1) % 3);
      sendRealtimeMove(next, hasDirectionalInput || !reachedTarget, direction, activeZone.id, now);

      if (reachedTarget) {
        setMoving(false);
        setStepFrame(1);
        setTarget(null);
        targetStepAtRef.current = null;
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [activeZone, target, joystickVector, sendRealtimeMove]);

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || activeZone.bounds.width;
    const height = rect.height || activeZone.bounds.height;
    const x = activeZone.bounds.x + ((event.clientX - rect.left) / width) * activeZone.bounds.width;
    const y = activeZone.bounds.y + ((event.clientY - rect.top) / height) * activeZone.bounds.height;
    const nextTarget = snapToGrid({ x, y }, activeZone);

    const direction = directionTowardPoint(positionRef.current, nextTarget);
    if (direction) {
      directionRef.current = direction;
    }

    setTarget(nextTarget);
    targetStepAtRef.current = null;
  }

  function handleJoystickVectorChange(vector: Point) {
    const wasMoving = joystickWasMovingRef.current;
    const isMoving = hasJoystickMovement(vector);

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

  return (
    <section className="game-world" aria-label="모바일 청첩장 월드">
      <header className="world-hud">
        <div className="world-hud__status">
          <div className="world-zone-summary">
            <span>현재 구역</span>
            <strong>{activeZone.label}</strong>
            <small>{activeZone.subtitle}</small>
          </div>
          <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>
            {realtimeStatusText(realtimeStatus)}
          </div>
        </div>
        <div className="world-zone-tabs" aria-label="맵 구역 이동">
          {gardenWorld.zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              aria-pressed={zone.id === activeZone.id}
              onClick={() => moveToZone(zone.id)}
            >
              {zone.label}
            </button>
          ))}
        </div>
      </header>
      <div className="world-map-shell">
        <div className={`world-map world-map--${activeZone.id}`}>
        <div
          className="world-map__stage"
          aria-label={`${activeZone.label} 지도`}
          data-zone={activeZone.id}
          data-logical-width={activeZone.bounds.width}
          data-logical-height={activeZone.bounds.height}
          onClick={handleMapClick}
        >
          <div className="world-path world-path--vertical" />
          <div className="world-path world-path--middle" />
          <div className="world-path world-path--bottom" />
          <div className="world-decoration-layer">
            {activeZone.decorations.map((decoration) => (
              <WorldDecoration key={decoration.id} decoration={decoration} zone={activeZone} />
            ))}
          </div>
          {activeZone.spots.map((spot) => {
            const content = invitationContent.spots.find((candidate) => candidate.id === spot.id);

            return (
              <button
                key={spot.id}
                type="button"
                className={`world-spot world-spot--${spot.id}`}
                style={{
                  left: toPercent(spot.x, activeZone.bounds.width),
                  top: toPercent(spot.y, activeZone.bounds.height),
                  width: toPercent(spot.width, activeZone.bounds.width),
                  height: toPercent(spot.height, activeZone.bounds.height)
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  openSpot(spot.id);
                }}
              >
                <span>{spot.label}</span>
                <small>{content?.actionLabel ?? "보기"}</small>
              </button>
            );
          })}
          {activeZone.portals.map((portal) => (
            <button
              key={portal.id}
              type="button"
              className="world-portal"
              style={{
                left: toPercent(portal.x, activeZone.bounds.width),
                top: toPercent(portal.y, activeZone.bounds.height),
                width: toPercent(portal.width, activeZone.bounds.width),
                height: toPercent(portal.height, activeZone.bounds.height)
              }}
              onClick={(event) => {
                event.stopPropagation();
                moveToZone(portal.to, portal.spawn);
              }}
            >
              {portal.label}
            </button>
          ))}
          {remoteGuests.filter((guest) => guest.zoneId === activeZone.id).map((guest) => (
            <div
              key={guest.guestId}
              className="world-player player player--remote"
              aria-label={guest.nickname}
              data-remote-motion="pixel-step-3"
              style={{
                left: toPercent(guest.x, activeZone.bounds.width),
                top: toPercent(guest.y, activeZone.bounds.height)
              }}
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
            <div
              key={npc.id}
              className="world-npc"
              style={{
                left: toPercent(npc.x, activeZone.bounds.width),
                top: toPercent(npc.y, activeZone.bounds.height)
              }}
            >
              <WeddingNpc
                id={npc.id}
                label={npc.label}
                onSelect={() => setActiveSpotId("couple")}
              />
            </div>
          ))}
          <div
            className="world-player player"
            aria-label={profile.nickname}
            style={{
              left: toPercent(position.x, activeZone.bounds.width),
              top: toPercent(position.y, activeZone.bounds.height)
            }}
          >
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
            <button
              type="button"
              className="world-menu-button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden="true">+</span>
              초대장 메뉴
            </button>
          </div>
        </div>
      </div>
      {menuOpen ? (
        <>
          <button
            type="button"
            className="world-menu-backdrop"
            aria-label="초대장 메뉴 닫기"
            onClick={() => setMenuOpen(false)}
          />
          <section className="world-menu-sheet" role="dialog" aria-modal="true" aria-label="초대장 바로가기">
            <header className="world-menu-sheet__header">
              <div>
                <span>WEDDING MENU</span>
                <h2>초대장 바로가기</h2>
              </div>
              <button
                ref={menuCloseButtonRef}
                type="button"
                aria-label="초대장 메뉴 닫기"
                onClick={() => setMenuOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="world-menu-grid">
              {invitationContent.spots.map((spot) => (
                <button key={spot.id} type="button" onClick={() => openSpot(spot.id)}>
                  {spot.actionLabel}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {activeSpotId ? (
        <SpotModal spotId={activeSpotId} nickname={profile.nickname} onClose={() => setActiveSpotId(null)} />
      ) : null}
    </section>
  );
}
