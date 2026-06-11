import { useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };

type VirtualJoystickProps = {
  onVectorChange: (vector: Point) => void;
};

const radius = 30;
const zeroVector: Point = { x: 0, y: 0 };

function roundToTwo(value: number) {
  return Number(value.toFixed(2));
}

function normalize(dx: number, dy: number): Point {
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return zeroVector;
  }

  const clampedDistance = Math.min(distance, radius);
  const scale = clampedDistance / distance;

  return {
    x: roundToTwo((dx * scale) / radius),
    y: roundToTwo((dy * scale) / radius)
  };
}

export function VirtualJoystick({ onVectorChange }: VirtualJoystickProps) {
  const activePointerIdRef = useRef<number | null>(null);
  const [thumbOffset, setThumbOffset] = useState<Point>(zeroVector);

  function updateVector(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const vector = normalize(event.clientX - centerX, event.clientY - centerY);

    setThumbOffset({ x: vector.x * radius, y: vector.y * radius });
    onVectorChange(vector);
  }

  function resetVector(event: PointerEvent<HTMLDivElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setThumbOffset(zeroVector);
    onVectorChange(zeroVector);
  }

  return (
    <div
      className="virtual-joystick"
      role="application"
      aria-label="가상 조이스틱"
      onPointerDown={(event) => {
        activePointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateVector(event);
      }}
      onPointerMove={(event) => {
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }

        updateVector(event);
      }}
      onPointerUp={resetVector}
      onPointerCancel={resetVector}
    >
      <span style={{ transform: `translate(${thumbOffset.x}px, ${thumbOffset.y}px)` }} />
    </div>
  );
}
