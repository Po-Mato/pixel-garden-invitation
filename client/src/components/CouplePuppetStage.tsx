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
  label: string;
  priority?: boolean;
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

function slotsFor(character: CoupleSide | undefined, order: CoupleDisplayOrder): PuppetSlot[] {
  if (character) return [{ character, x: 256 }];
  return coupleSides(order).map((side, index) => ({
    character: side,
    x: index === 0 ? 324 : 700
  }));
}

export function CouplePuppetStage({
  character,
  order = "bride-first",
  framing = character ? "full" : "portrait",
  label,
  priority = false,
  className = ""
}: CouplePuppetStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [inRange, setInRange] = useState(() => priority || import.meta.env.MODE === "test");
  const [ready, setReady] = useState(false);
  const slots = slotsFor(character, order);

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
    if (!inRange || !hostRef.current || import.meta.env.MODE === "test") return;
    if (!allowsCouplePuppetMotion()) return;

    let disposed = false;
    let destroy: (() => void) | undefined;

    const mount = async () => {
      const PIXI = await import("pixi.js");
      if (disposed || !hostRef.current) return;

      const viewport = character
        ? { width: 512, height: 768 }
        : { width: 1024, height: framing === "portrait" ? 560 : 768 };
      const app = new PIXI.Application();
      await app.init({
        width: viewport.width,
        height: viewport.height,
        autoDensity: true,
        antialias: true,
        backgroundAlpha: 0,
        preference: "webgl",
        resolution: Math.min(window.devicePixelRatio || 1, 2)
      });
      if (disposed || !hostRef.current) {
        app.destroy(true);
        return;
      }

      app.canvas.setAttribute("aria-hidden", "true");
      app.canvas.setAttribute("tabindex", "-1");
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      hostRef.current.replaceChildren(app.canvas);

      const cleanups: Array<() => void> = [];
      let appDestroyed = false;
      const onVisibility = () => {
        if (document.hidden) app.ticker.stop();
        else app.ticker.start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      destroy = () => {
        if (appDestroyed) return;
        appDestroyed = true;
        cleanups.forEach((cleanup) => cleanup());
        document.removeEventListener("visibilitychange", onVisibility);
        app.destroy(true);
      };

      for (const slot of slots) {
        const basePath = resolveCouplePuppetAssetPath(slot.character, "").replace(/\/$/, "");
        const manifestResponse = await fetch(`${basePath}/rig.json`);
        if (!manifestResponse.ok) throw new Error(`${slot.character} 퍼펫 리그를 불러오지 못했습니다.`);
        const manifest = await manifestResponse.json() as PuppetManifest;
        const [bodyTexture, headOpenTexture, headBlinkTexture] = await Promise.all([
          PIXI.Assets.load(`${basePath}/${manifest.layers.body}`),
          PIXI.Assets.load(`${basePath}/${manifest.layers.headOpen}`),
          PIXI.Assets.load(`${basePath}/${manifest.layers.headBlink}`)
        ]);
        if (disposed) {
          destroy();
          return;
        }

        const rootBone = new PIXI.Container();
        const placement = resolvePuppetPlacement(
          viewport.height,
          manifest.canvas.height,
          manifest.bones.root.y,
          !character && framing === "portrait"
        );
        rootBone.pivot.set(manifest.bones.root.x, manifest.bones.root.y);
        rootBone.position.set(slot.x, placement.rootY);
        rootBone.scale.set(placement.scale);

        const body = new PIXI.Sprite(bodyTexture);
        const headBone = new PIXI.Container();
        headBone.pivot.set(manifest.bones.head.x, manifest.bones.head.y);
        headBone.position.set(manifest.bones.head.x, manifest.bones.head.y);
        const headOpen = new PIXI.Sprite(headOpenTexture);
        const headBlink = new PIXI.Sprite(headBlinkTexture);
        headBlink.visible = false;

        headBone.addChild(headOpen, headBlink);
        rootBone.addChild(body, headBone);
        app.stage.addChild(rootBone);

        const motion = manifest.motion;
        const minBlink = motion.blinkEveryMs[0];
        const blinkRange = motion.blinkEveryMs[1] - minBlink;
        let nextBlinkAt = performance.now() + minBlink + Math.random() * blinkRange;

        const animate = () => {
          const now = performance.now();
          const time = now / 1000 + motion.phase;
          const breath = Math.sin(time * 1.8) * motion.breathScale;
          rootBone.scale.y = placement.scale * (1 + breath);
          headBone.rotation = Math.sin(time * 0.72) * motion.headDegrees * Math.PI / 180;
          headBone.position.y = manifest.bones.head.y + Math.sin(time * 1.1) * motion.headLift;

          const blinking = now >= nextBlinkAt && now < nextBlinkAt + motion.blinkDurationMs;
          headOpen.visible = !blinking;
          headBlink.visible = blinking;
          if (now >= nextBlinkAt + motion.blinkDurationMs) {
            nextBlinkAt = now + minBlink + Math.random() * blinkRange;
          }
        };
        app.ticker.add(animate);
        cleanups.push(() => app.ticker.remove(animate));
      }

      if (!disposed) setReady(true);
    };

    mount().catch(() => {
      destroy?.();
      destroy = undefined;
      if (!disposed) setReady(false);
    });

    return () => {
      disposed = true;
      destroy?.();
    };
  }, [character, framing, inRange, order]);

  return (
    <div
      ref={containerRef}
      className={`couple-puppet-stage couple-puppet-stage--${framing} ${className}`.trim()}
      data-character={character ?? "couple"}
      data-renderer-ready={ready ? "true" : "false"}
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
