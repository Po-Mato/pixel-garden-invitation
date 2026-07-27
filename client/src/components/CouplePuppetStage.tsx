import { useEffect, useRef, useState } from "react";
import { allowsCouplePuppetMotion, resolveCouplePuppetAssetPath } from "../character/couplePuppet";
import { coupleSides, type CoupleDisplayOrder, type CoupleSide } from "../invitation/coupleOrder";

type PuppetManifest = {
  canvas: { width: number; height: number };
  layers: { body: string; headOpen: string; headBlink: string; preview: string };
  bones: {
    root: { x: number; y: number };
    head: { x: number; y: number };
  };
  motion: {
    headDegrees: number;
    headLift: number;
    breathScale: number;
    phase: number;
    blinkEveryMs: [number, number];
    blinkDurationMs: number;
  };
};

type CouplePuppetStageProps = {
  character?: CoupleSide;
  order?: CoupleDisplayOrder;
  framing?: "full" | "portrait";
  arrangement?: "standard" | "close";
  label: string;
  priority?: boolean;
  motionEnabled?: boolean;
  className?: string;
};

type PuppetSlot = {
  character: CoupleSide;
  x: number;
};

type PuppetPlacement = {
  scale: number;
  rootY: number;
};

type LoadedPuppet = {
  slot: PuppetSlot;
  manifest: PuppetManifest;
  placement: PuppetPlacement;
  body: HTMLImageElement;
  headOpen: HTMLImageElement;
  headBlink: HTMLImageElement;
  nextBlinkAt: number;
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`퍼펫 이미지를 불러오지 못했습니다: ${source}`));
    image.src = source;
  });
}

export function resolvePuppetPlacement(
  viewportHeight: number,
  canvasHeight: number,
  sourceRootY: number,
  fitFullBody: boolean
): PuppetPlacement {
  if (!fitFullBody) return { scale: 1, rootY: sourceRootY };

  const topPadding = 20;
  const bottomPadding = 32;
  const scale = (viewportHeight - topPadding - bottomPadding) / canvasHeight;
  const sourceBelowRoot = canvasHeight - sourceRootY;
  return {
    scale,
    rootY: viewportHeight - bottomPadding - sourceBelowRoot * scale
  };
}

export function resolveCouplePuppetSlotXs(arrangement: "standard" | "close"): [number, number] {
  return arrangement === "close" ? [400, 624] : [324, 700];
}

function slotsFor(
  character: CoupleSide | undefined,
  order: CoupleDisplayOrder,
  arrangement: "standard" | "close"
): PuppetSlot[] {
  if (character) return [{ character, x: 256 }];
  const slotXs = resolveCouplePuppetSlotXs(arrangement);
  return coupleSides(order).map((side, index) => ({
    character: side,
    x: slotXs[index]
  }));
}

export function CouplePuppetStage({
  character,
  order = "bride-first",
  framing = character ? "full" : "portrait",
  arrangement = "standard",
  label,
  priority = false,
  motionEnabled = false,
  className = ""
}: CouplePuppetStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [inRange, setInRange] = useState(() => priority || import.meta.env.MODE === "test");
  const [ready, setReady] = useState(false);
  const slots = slotsFor(character, order, arrangement);

  useEffect(() => {
    if (import.meta.env.MODE === "test" || !containerRef.current) return;
    if (typeof IntersectionObserver !== "function") {
      setInRange(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInRange(entry.isIntersecting);
      if (!entry.isIntersecting) setReady(false);
    }, { rootMargin: "160px 0px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!motionEnabled || !inRange || !hostRef.current || import.meta.env.MODE === "test") return;
    if (!allowsCouplePuppetMotion()) return;

    let disposed = false;
    let animationFrame = 0;
    let canvas: HTMLCanvasElement | null = null;

    const stopAnimation = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const mount = async () => {
      const viewport = character
        ? { width: 512, height: 768 }
        : { width: 1024, height: framing === "portrait" ? 560 : 768 };
      const loaded = await Promise.all(slots.map(async (slot): Promise<LoadedPuppet> => {
        const basePath = resolveCouplePuppetAssetPath(slot.character, "").replace(/\/$/, "");
        const manifestResponse = await fetch(`${basePath}/rig.json`);
        if (!manifestResponse.ok) throw new Error(`${slot.character} 퍼펫 리그를 불러오지 못했습니다.`);
        const manifest = await manifestResponse.json() as PuppetManifest;
        const [body, headOpen, headBlink] = await Promise.all([
          loadImage(`${basePath}/${manifest.layers.body}`),
          loadImage(`${basePath}/${manifest.layers.headOpen}`),
          loadImage(`${basePath}/${manifest.layers.headBlink}`)
        ]);
        const placement = resolvePuppetPlacement(
          viewport.height,
          manifest.canvas.height,
          manifest.bones.root.y,
          !character && framing === "portrait"
        );
        const minBlink = manifest.motion.blinkEveryMs[0];
        const blinkRange = manifest.motion.blinkEveryMs[1] - minBlink;
        return {
          slot,
          manifest,
          placement,
          body,
          headOpen,
          headBlink,
          nextBlinkAt: performance.now() + minBlink + Math.random() * blinkRange
        };
      }));
      if (disposed || !hostRef.current) return;

      const resolution = Math.min(window.devicePixelRatio || 1, 2);
      canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width * resolution);
      canvas.height = Math.round(viewport.height * resolution);
      canvas.setAttribute("aria-hidden", "true");
      canvas.setAttribute("tabindex", "-1");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Canvas 2D 렌더러를 사용할 수 없습니다.");
      context.setTransform(resolution, 0, 0, resolution, 0, 0);
      context.imageSmoothingEnabled = true;
      hostRef.current.replaceChildren(canvas);

      const draw = (now: number) => {
        if (disposed || document.hidden) return;
        context.clearRect(0, 0, viewport.width, viewport.height);
        for (const puppet of loaded) {
          const { manifest, placement, slot } = puppet;
          const motion = manifest.motion;
          const time = now / 1_000 + motion.phase;
          const breath = Math.sin(time * 1.8) * motion.breathScale;
          const headRotation = Math.sin(time * 0.72) * motion.headDegrees * Math.PI / 180;
          const headLift = Math.sin(time * 1.1) * motion.headLift;
          const blinking = now >= puppet.nextBlinkAt
            && now < puppet.nextBlinkAt + motion.blinkDurationMs;

          if (now >= puppet.nextBlinkAt + motion.blinkDurationMs) {
            const minBlink = motion.blinkEveryMs[0];
            puppet.nextBlinkAt = now + minBlink + Math.random() * (motion.blinkEveryMs[1] - minBlink);
          }

          context.save();
          context.translate(slot.x, placement.rootY);
          context.scale(placement.scale, placement.scale * (1 + breath));
          context.translate(-manifest.bones.root.x, -manifest.bones.root.y);
          context.drawImage(puppet.body, 0, 0);
          context.translate(manifest.bones.head.x, manifest.bones.head.y + headLift);
          context.rotate(headRotation);
          context.translate(-manifest.bones.head.x, -manifest.bones.head.y);
          context.drawImage(blinking ? puppet.headBlink : puppet.headOpen, 0, 0);
          context.restore();
        }
        animationFrame = requestAnimationFrame(draw);
      };

      const onVisibility = () => {
        stopAnimation();
        if (!document.hidden && !disposed) animationFrame = requestAnimationFrame(draw);
      };
      document.addEventListener("visibilitychange", onVisibility);
      animationFrame = requestAnimationFrame(draw);

      if (!disposed) {
        setReady(true);
      }
      return () => document.removeEventListener("visibilitychange", onVisibility);
    };

    let removeVisibilityListener: (() => void) | undefined;
    mount().then((cleanup) => {
      removeVisibilityListener = cleanup;
    }).catch(() => {
      stopAnimation();
      if (!disposed) setReady(false);
    });

    return () => {
      disposed = true;
      stopAnimation();
      removeVisibilityListener?.();
      canvas?.remove();
    };
  }, [arrangement, character, framing, inRange, motionEnabled, order]);

  return (
    <div
      ref={containerRef}
      className={`couple-puppet-stage couple-puppet-stage--${framing} ${className}`.trim()}
      data-character={character ?? "couple"}
      data-arrangement={arrangement}
      data-renderer-enabled={motionEnabled ? "true" : "false"}
      data-renderer-ready={ready ? "true" : "false"}
      data-renderer="canvas-2d"
      role="img"
      aria-label={label}
    >
      <div className="couple-puppet-stage__fallback" aria-hidden="true">
        {slots.map((slot) => (
          <img
            key={slot.character}
            src={resolveCouplePuppetAssetPath(slot.character, "preview.webp")}
            alt=""
            decoding="async"
          />
        ))}
      </div>
      <div ref={hostRef} className="couple-puppet-stage__canvas" aria-hidden="true" />
    </div>
  );
}
