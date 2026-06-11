import { useEffect, useRef, useState, type MouseEvent } from "react";
import { invitationContent, type RoomGuest, type SpotId } from "@wedding-game/shared";
import { computeNextPosition, directionFromVector } from "../game/movement";
import { gardenWorld, type Point } from "../game/world";
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

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
const distanceBetween = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y);
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;

export function GameWorld({ profile }: GameWorldProps) {
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [position, setPosition] = useState<Point>(gardenWorld.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [remoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus] = useState<"offline" | "connecting" | "online">("offline");
  const positionRef = useRef<Point>(gardenWorld.spawn);
  const lastFrameRef = useRef<number | null>(null);

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

        positionRef.current = next;
        setPosition(next);
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!movementTarget) {
        lastFrameRef.current = null;
        return;
      }

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

      positionRef.current = nextPosition;
      setPosition(nextPosition);

      if (reachedTarget || madeNoProgress) {
        setTarget(null);
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, joystickVector]);

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || gardenWorld.bounds.width;
    const height = rect.height || gardenWorld.bounds.height;
    const x = gardenWorld.bounds.x + ((event.clientX - rect.left) / width) * gardenWorld.bounds.width;
    const y = gardenWorld.bounds.y + ((event.clientY - rect.top) / height) * gardenWorld.bounds.height;

    setTarget({ x, y });
  }

  function handleJoystickVectorChange(vector: Point) {
    setJoystickVector(vector);

    if (hasJoystickMovement(vector)) {
      setTarget(null);
      directionFromVector(vector);
    }
  }

  return (
    <section className="game-world" aria-label="정원 월드">
      <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>
        {realtimeStatus === "online" ? "실시간 정원" : "오프라인 정원"}
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
