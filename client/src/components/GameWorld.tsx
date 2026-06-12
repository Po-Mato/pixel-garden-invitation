import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { invitationContent, type ClientMessage, type Direction, type RoomGuest, type SpotId } from "@wedding-game/shared";
import { computeNextPosition, directionFromVector } from "../game/movement";
import { gardenWorld, type Point } from "../game/world";
import { connectRealtime, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { PixelAvatar } from "./PixelAvatar";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";

type GameWorldProps = {
  profile: EntryProfile;
};

const speed = 120;
const arrivalDistance = 0.5;
const progressDistance = 0.01;
const joystickDeadZone = 0.05;
const joystickTargetDistance = 120;
const realtimeMoveIntervalMs = 100;

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
const distanceBetween = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y);
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;
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
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const positionRef = useRef<Point>(gardenWorld.spawn);
  const lastFrameRef = useRef<number | null>(null);
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
          avatar: profile.avatar,
          color: profile.color
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
  }, [profile.avatar, profile.color, profile.nickname]);

  useEffect(() => {
    const hasJoystickInput = hasJoystickMovement(joystickVector);

    if (!target && !hasJoystickInput) {
      lastFrameRef.current = null;
      return;
    }

    const movementTarget = target;
    const movementVector = joystickVector;
    let frame = 0;

    function tick(now: number) {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }

      const deltaMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const current = positionRef.current;

      if (hasJoystickMovement(movementVector)) {
        const direction = directionFromVector(movementVector);
        const next = computeNextPosition({
          current,
          target: {
            x: current.x + movementVector.x * joystickTargetDistance,
            y: current.y + movementVector.y * joystickTargetDistance
          },
          deltaMs,
          speed,
          world: gardenWorld
        });

        directionRef.current = direction;
        positionRef.current = next;
        setPosition(next);
        sendRealtimeMove(next, true, direction, now);
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!movementTarget) {
        lastFrameRef.current = null;
        return;
      }

      const direction = directionFromVector({
        x: movementTarget.x - current.x,
        y: movementTarget.y - current.y
      });
      const next = computeNextPosition({
        current,
        target: movementTarget,
        deltaMs,
        speed,
        world: gardenWorld
      });
      const reachedTarget = distanceBetween(next, movementTarget) <= arrivalDistance;
      const madeNoProgress = deltaMs > 0 && distanceBetween(current, next) <= progressDistance;
      const nextPosition = reachedTarget ? movementTarget : next;

      directionRef.current = direction;
      positionRef.current = nextPosition;
      setPosition(nextPosition);
      sendRealtimeMove(nextPosition, !(reachedTarget || madeNoProgress), direction, now);

      if (reachedTarget || madeNoProgress) {
        setTarget(null);
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
    const nextTarget = { x, y };

    if (distanceBetween(positionRef.current, nextTarget) > arrivalDistance) {
      directionRef.current = directionFromVector({
        x: nextTarget.x - positionRef.current.x,
        y: nextTarget.y - positionRef.current.y
      });
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
      directionRef.current = directionFromVector(vector);
      return;
    }

    joystickWasMovingRef.current = false;
    if (wasMoving) {
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
              <PixelAvatar avatar={guest.avatar} color={guest.color} label={`${guest.nickname} 캐릭터`} />
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
            <PixelAvatar avatar={profile.avatar} color={profile.color} label={`${profile.nickname} 캐릭터`} />
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
