import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from "react";

type Point = { x: number; y: number };

type VirtualJoystickProps = {
  disabled?: boolean;
  onVectorChange: (vector: Point) => void;
};

const zeroVector: Point = { x: 0, y: 0 };

function normalize(dx: number, dy: number): Point {
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return zeroVector;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx >= 0 ? 1 : -1, y: 0 };
  }

  return { x: 0, y: dy >= 0 ? 1 : -1 };
}

function vectorFromKey(key: string): Point | null {
  if (key === "ArrowUp") {
    return { x: 0, y: -1 };
  }

  if (key === "ArrowDown") {
    return { x: 0, y: 1 };
  }

  if (key === "ArrowLeft") {
    return { x: -1, y: 0 };
  }

  if (key === "ArrowRight") {
    return { x: 1, y: 0 };
  }

  return null;
}

export function VirtualJoystick({ disabled = false, onVectorChange }: VirtualJoystickProps) {
  const activePointerIdRef = useRef<number | null>(null);
  const activeKeysRef = useRef<string[]>([]);
  const [thumbVector, setThumbVector] = useState<Point>(zeroVector);

  useEffect(() => {
    if (disabled) setThumbVector(zeroVector);
  }, [disabled]);

  function applyVector(vector: Point) {
    setThumbVector(vector);
    onVectorChange(vector);
  }

  function updateVector(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const vector = normalize(event.clientX - centerX, event.clientY - centerY);

    applyVector(vector);
  }

  function resetVector(event: PointerEvent<HTMLDivElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const activeKey = activeKeysRef.current.at(-1);
    if (activeKey) {
      if (!disabled) applyVector(vectorFromKey(activeKey) ?? zeroVector);
      return;
    }
    applyVector(zeroVector);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const vector = vectorFromKey(event.key);

    if (!vector) {
      return;
    }

    event.preventDefault();
    if (disabled) return;
    activeKeysRef.current = [
      ...activeKeysRef.current.filter((key) => key !== event.key),
      event.key
    ];
    applyVector(vector);
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (!vectorFromKey(event.key)) {
      return;
    }

    event.preventDefault();
    releaseKey(event.key);
  }

  function releaseKey(key: string) {
    if (!activeKeysRef.current.includes(key)) return;

    activeKeysRef.current = activeKeysRef.current.filter((activeKey) => activeKey !== key);
    if (activePointerIdRef.current !== null) return;

    const activeKey = activeKeysRef.current.at(-1);
    if (activeKey) {
      if (!disabled) applyVector(vectorFromKey(activeKey) ?? zeroVector);
      return;
    }
    applyVector(zeroVector);
  }

  useEffect(() => {
    const handleWindowKeyUp = (event: globalThis.KeyboardEvent) => {
      if (!activeKeysRef.current.includes(event.key)) return;
      event.preventDefault();
      releaseKey(event.key);
    };

    window.addEventListener("keyup", handleWindowKeyUp);
    return () => window.removeEventListener("keyup", handleWindowKeyUp);
  });

  return (
    <div
      className="virtual-joystick"
      role="application"
      aria-label="가상 조이스틱"
      aria-disabled={disabled}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      tabIndex={0}
      onPointerDown={(event) => {
        if (disabled) return;
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
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <img
        className="virtual-joystick__base"
        src={`${import.meta.env.BASE_URL}assets/ui/joystick-wedding-compass-base.png`}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <img
        className="virtual-joystick__thumb"
        src={`${import.meta.env.BASE_URL}assets/ui/joystick-wedding-compass-thumb.png`}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={
          {
            "--joystick-x": thumbVector.x,
            "--joystick-y": thumbVector.y
          } as CSSProperties
        }
      />
    </div>
  );
}
