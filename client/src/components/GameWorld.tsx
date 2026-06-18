import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { invitationContent, type ClientMessage, type Direction, type RoomGuest, type SpotId } from "@wedding-game/shared";
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import { gardenWorld, type Point } from "../game/world";
import { connectRealtime, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { CharacterSprite } from "./CharacterSprite";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";

type GameWorldProps = {
  profile: EntryProfile;
};

const joystickDeadZone = 0.05;
const gridStepIntervalMs = 150;
const realtimeMoveIntervalMs = 100;

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;
const samePoint = (first: Point, second: Point) => first.x === second.x && first.y === second.y;
type RealtimeStatus = "offline" | "connecting" | "online";
type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type RealtimeConnection = ReturnType<typeof connectRealtime>;

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
          seq: position.seq
        }
      : guest
  );
}

function realtimeStatusText(status: RealtimeStatus) {
  if (status === "online") return "실시간 정원";
  if (status === "connecting") return "실시간 연결 중";
  return "오프라인 정원";
}

export function GameWorld({ profile }: GameWorldProps) {
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [position, setPosition] = useState<Point>(gardenWorld.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(1);
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const positionRef = useRef<Point>(gardenWorld.spawn);
  const lastStepRef = useRef<number | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const currentGuestIdRef = useRef<string | null>(null);
  const directionRef = useRef<Direction>("down");
  const moveSeqRef = useRef(0);
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);
  const joystickWasMovingRef = useRef(false);

  const sendRealtimeMove = useCallback((nextPosition: Point, moving: boolean, direction: Direction, now: number) => {
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
        seq: moveSeqRef.current + 1
      },
      now
    );
  }, []);

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
      connection = connectRealtime(
        getRoomUrl(workerUrl, import.meta.env.VITE_INVITATION_ID ?? "sample-garden"),
        {
          type: "join",
          nickname: profile.nickname,
          appearance: profile.appearance
        },
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

            connectionRef.current = null;
            moveThrottleRef.current = null;
            currentGuestIdRef.current = null;
            setRemoteGuests([]);
            setRealtimeStatus("offline");
          },
          onMessage: (message) => {
            if (!active) {
              return;
            }

            if (message.type === "welcome") {
              currentGuestIdRef.current = message.guestId;
              setRemoteGuests(withoutCurrentGuest(message.guests, message.guestId));
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
      lastStepRef.current = null;
      return;
    }

    const movementTarget = target;
    const movementVector = joystickVector;
    let frame = 0;

    function tick(now: number) {
      if (lastStepRef.current === null) {
        lastStepRef.current = now - gridStepIntervalMs;
      }

      if (now - lastStepRef.current < gridStepIntervalMs) {
        frame = requestAnimationFrame(tick);
        return;
      }

      lastStepRef.current = now;

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
        lastStepRef.current = null;
        setTarget(null);
        return;
      }

      const next = computeNextGridPosition({
        current,
        direction,
        world: gardenWorld
      });
      const didMove = !samePoint(current, next);
      const reachedTarget = movementTarget ? samePoint(next, movementTarget) : false;

      directionRef.current = direction;
      setDirection(direction);

      if (!didMove) {
        setMoving(false);
        setStepFrame(1);
        sendRealtimeMove(current, false, direction, now);
        setTarget(null);
        lastStepRef.current = null;
        return;
      }

      positionRef.current = next;
      setPosition(next);
      setMoving(true);
      setStepFrame((currentFrame) => (currentFrame + 1) % 3);
      sendRealtimeMove(next, hasDirectionalInput || !reachedTarget, direction, now);

      if (reachedTarget) {
        setMoving(false);
        setStepFrame(1);
        setTarget(null);
        lastStepRef.current = null;
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, joystickVector, sendRealtimeMove]);

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || gardenWorld.bounds.width;
    const height = rect.height || gardenWorld.bounds.height;
    const x = gardenWorld.bounds.x + ((event.clientX - rect.left) / width) * gardenWorld.bounds.width;
    const y = gardenWorld.bounds.y + ((event.clientY - rect.top) / height) * gardenWorld.bounds.height;
    const nextTarget = snapToGrid({ x, y }, gardenWorld);

    const direction = directionTowardPoint(positionRef.current, nextTarget);
    if (direction) {
      directionRef.current = direction;
    }

    setTarget(nextTarget);
  }

  function handleJoystickVectorChange(vector: Point) {
    const wasMoving = joystickWasMovingRef.current;
    const isMoving = hasJoystickMovement(vector);

    setJoystickVector(vector);

    if (isMoving) {
      joystickWasMovingRef.current = true;
      setTarget(null);
      lastStepRef.current = null;
      directionRef.current = directionFromVector(vector);
      return;
    }

    joystickWasMovingRef.current = false;
    if (wasMoving) {
      setMoving(false);
      setStepFrame(1);
      sendRealtimeMove(positionRef.current, false, directionRef.current, performance.now());
    }
  }

  return (
    <section className="game-world" aria-label="정원 월드">
      <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>
        {realtimeStatusText(realtimeStatus)}
      </div>
      <div className="world-map">
        <div
          className="world-map__stage"
          aria-label="정원 지도"
          data-logical-width={gardenWorld.bounds.width}
          data-logical-height={gardenWorld.bounds.height}
          onClick={handleMapClick}
        >
          <div className="world-path world-path--vertical" />
          <div className="world-path world-path--middle" />
          <div className="world-path world-path--bottom" />
          {gardenWorld.spots.map((spot) => {
            const content = invitationContent.spots.find((candidate) => candidate.id === spot.id);

            return (
              <button
                key={spot.id}
                type="button"
                className={`world-spot world-spot--${spot.id}`}
                style={{
                  left: toPercent(spot.x, gardenWorld.bounds.width),
                  top: toPercent(spot.y, gardenWorld.bounds.height),
                  width: toPercent(spot.width, gardenWorld.bounds.width),
                  height: toPercent(spot.height, gardenWorld.bounds.height)
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveSpotId(spot.id);
                }}
              >
                <span>{spot.label}</span>
                <small>{content?.actionLabel ?? "보기"}</small>
              </button>
            );
          })}
          {remoteGuests.map((guest) => (
            <div
              key={guest.guestId}
              className="world-player player player--remote"
              aria-label={guest.nickname}
              style={{
                left: toPercent(guest.x, gardenWorld.bounds.width),
                top: toPercent(guest.y, gardenWorld.bounds.height)
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
          <div
            className="world-player player"
            aria-label={profile.nickname}
            style={{
              left: toPercent(position.x, gardenWorld.bounds.width),
              top: toPercent(position.y, gardenWorld.bounds.height)
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
      </div>
      <div className="world-controls">
        <VirtualJoystick onVectorChange={handleJoystickVectorChange} />
        <div className="world-actions" aria-label="초대장 바로가기">
          {invitationContent.spots.map((spot) => (
            <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)}>
              {spot.actionLabel}
            </button>
          ))}
        </div>
      </div>
      {activeSpotId ? (
        <SpotModal spotId={activeSpotId} nickname={profile.nickname} onClose={() => setActiveSpotId(null)} />
      ) : null}
    </section>
  );
}
