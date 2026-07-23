import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Footprints,
  MapPinned,
  Sparkles,
  X,
  type LucideIcon
} from "lucide-react";

type GameFirstVisitGuideProps = {
  onDismiss: () => void;
};

type GuideStep = {
  eyebrow: string;
  title: string;
  detail: string;
  Icon: LucideIcon;
  visual: "move" | "portal" | "destination";
};

const guideSteps: readonly GuideStep[] = [
  {
    eyebrow: "STEP 01 · MOVE",
    title: "한 칸씩 차분하게 걸어요",
    detail: "화면 아래 조이스틱을 누르면 캐릭터가 타일 단위로 이동해요.",
    Icon: Footprints,
    visual: "move"
  },
  {
    eyebrow: "STEP 02 · PORTAL",
    title: "빛나는 타일이 다음 맵의 문이에요",
    detail: "포털 타일에 캐릭터가 닿으면 자연스럽게 다음 장소로 이동해요.",
    Icon: Sparkles,
    visual: "portal"
  },
  {
    eyebrow: "STEP 03 · GUIDE",
    title: "분홍 목적지 표시를 따라가요",
    detail: "상단의 다음 목적지를 누르면 해당 맵으로 이동해 목적지까지 걸어가요.",
    Icon: MapPinned,
    visual: "destination"
  }
] as const;

function GuideVisual({ type }: { type: GuideStep["visual"] }) {
  if (type === "move") {
    return (
      <div className="game-guide__move" aria-hidden="true">
        <span className="game-guide__tile game-guide__tile--start"><Footprints /></span>
        <span className="game-guide__move-line"><i /><i /><i /></span>
        <span className="game-guide__tile game-guide__tile--finish"><Sparkles /></span>
        <span className="game-guide__joystick">
          <ChevronUp /><ChevronLeft /><i /><ChevronRight /><ChevronDown />
        </span>
      </div>
    );
  }
  if (type === "portal") {
    return (
      <div className="game-guide__portal" aria-hidden="true">
        <span className="game-guide__portal-tiles"><i /><i /><i /></span>
        <span className="game-guide__portal-rings"><i /><i /><i /></span>
        <Footprints />
      </div>
    );
  }
  return (
    <div className="game-guide__destination" aria-hidden="true">
      <span><MapPinned /><i>목적지</i></span>
      <svg viewBox="0 0 240 90"><path d="M32 68 C78 15 145 82 206 28" /></svg>
      <span><Footprints /><i>현재 위치</i></span>
    </div>
  );
}

export function GameFirstVisitGuide({ onDismiss }: GameFirstVisitGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onDismissRef = useRef(onDismiss);
  const step = guideSteps[stepIndex];
  const StepIcon = step.Icon;
  const lastStep = stepIndex === guideSteps.length - 1;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismissRef.current();
      if (event.key === "ArrowRight") setStepIndex((current) => Math.min(current + 1, guideSteps.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(current - 1, 0));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="game-guide" role="dialog" aria-modal="true" aria-label="게임 첫 방문 안내">
      <article className="game-guide__panel">
        <header>
          <div><small>PIXEL GARDEN GUIDE</small><strong>정원 산책 안내</strong></div>
          <button ref={closeButtonRef} type="button" aria-label="게임 안내 닫기" onClick={onDismiss}><X /></button>
        </header>

        <div className={`game-guide__visual game-guide__visual--${step.visual}`}>
          <GuideVisual type={step.visual} />
        </div>

        <section className="game-guide__copy" aria-live="polite">
          <span><StepIcon aria-hidden="true" />{step.eyebrow}</span>
          <h2>{step.title}</h2>
          <p>{step.detail}</p>
        </section>

        <div className="game-guide__progress" aria-label={`안내 ${stepIndex + 1}/${guideSteps.length}`}>
          {guideSteps.map((item, index) => <i key={item.eyebrow} className={index === stepIndex ? "is-active" : undefined} />)}
        </div>

        <footer>
          <button type="button" className="game-guide__skip" onClick={onDismiss}>건너뛰기</button>
          <div>
            {stepIndex > 0 ? (
              <button type="button" aria-label="이전 안내" onClick={() => setStepIndex((current) => current - 1)}><ArrowLeft /></button>
            ) : null}
            <button
              type="button"
              className="game-guide__next"
              onClick={() => {
                if (lastStep) onDismiss();
                else setStepIndex((current) => current + 1);
              }}
            >
              <span>{lastStep ? "정원 산책 시작" : "다음"}</span><ArrowRight />
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
