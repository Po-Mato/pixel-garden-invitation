import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  resolveGuestPreset,
  type CharacterAppearance,
  type Direction
} from "@wedding-game/shared";
import { Pause, Play, RotateCcw, RotateCw, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  randomizeAppearance,
  updateAppearance
} from "../character/appearanceState";
import { CharacterSprite } from "./CharacterSprite";

type Props = {
  value: CharacterAppearance;
  onChange: (appearance: CharacterAppearance) => void;
};

const previewDirections: Direction[] = ["down", "right", "up", "left"];
const previewDirectionLabels: Record<Direction, string> = {
  down: "정면",
  right: "오른쪽",
  up: "뒷면",
  left: "왼쪽"
};
const previewWalkFrames = [0, 1, 2, 1] as const;

export function CharacterCustomizer({ value, onChange }: Props) {
  const selectedPreset = resolveGuestPreset(value);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const [previewDirection, setPreviewDirection] = useState<Direction>("down");
  const [previewWalking, setPreviewWalking] = useState(true);
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);

  useEffect(() => {
    if (!previewWalking) return;
    const timer = window.setInterval(() => {
      setPreviewFrameIndex((current) => (current + 1) % previewWalkFrames.length);
    }, 240);
    return () => window.clearInterval(timer);
  }, [previewWalking]);

  useEffect(() => {
    selectedOptionRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [selectedPreset.id]);

  return (
    <section className="character-customizer" aria-label="하객 캐릭터 선택">
      <div className="character-customizer__preview">
        <div className="character-customizer__stage" aria-hidden="true">
          <span className="character-customizer__glass" />
          <span className="character-customizer__arch" />
          <span className="character-customizer__flowers character-customizer__flowers--left" />
          <span className="character-customizer__flowers character-customizer__flowers--right" />
        </div>
        <div className="character-customizer__halo" aria-hidden="true" />
        <div className="character-customizer__sprite">
          <CharacterSprite
            appearance={value}
            direction={previewDirection}
            moving={previewWalking}
            stepFrame={previewWalkFrames[previewFrameIndex]}
            displayMode="preview"
            label="선택한 하객 캐릭터"
          />
        </div>
        <div className="character-customizer__selected-name">
          <strong>{selectedPreset.label}</strong>
          <span aria-live="polite">
            {previewDirectionLabels[previewDirection]} · {previewWalking ? "보행 중" : "정지"}
          </span>
        </div>
        <div className="character-customizer__preview-controls" role="group" aria-label="캐릭터 보행 미리보기">
          <button
            type="button"
            aria-label={`캐릭터 회전, 현재 ${previewDirectionLabels[previewDirection]}`}
            onClick={() => {
              setPreviewDirection((current) => (
                previewDirections[(previewDirections.indexOf(current) + 1) % previewDirections.length]
              ));
              if (previewWalking) setPreviewFrameIndex(0);
            }}
          >
            <RotateCw aria-hidden="true" />
            <span>회전</span>
            <strong>{previewDirectionLabels[previewDirection]}</strong>
          </button>
          <button
            type="button"
            aria-label={previewWalking ? "보행 애니메이션 정지" : "보행 애니메이션 재생"}
            aria-pressed={previewWalking}
            onClick={() => {
              setPreviewWalking((current) => !current);
              setPreviewFrameIndex(previewWalking ? 1 : 0);
            }}
          >
            {previewWalking ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            <span>보행</span>
            <strong>{previewWalking ? "걷는 중" : "정지"}</strong>
          </button>
        </div>
      </div>

      <div className="character-customizer__actions">
        <button type="button" className="choice" onClick={() => onChange(randomizeAppearance())}>
          <Shuffle className="character-customizer__action-icon" aria-hidden="true" />
          무작위 선택
        </button>
        <button type="button" className="choice" onClick={() => onChange(defaultCharacterAppearance)}>
          <RotateCcw className="character-customizer__action-icon" aria-hidden="true" />
          기본 캐릭터
        </button>
      </div>

      <div className="character-customizer__panel">
        <h2>완성 하객 캐릭터</h2>
        <div className="customizer-options customizer-options--images">
          {guestCharacterPresets.map((preset) => {
            const appearance = updateAppearance(value, preset.id);
            const selected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                ref={selected ? selectedOptionRef : undefined}
                type="button"
                className={`customizer-option customizer-option--image ${selected ? "customizer-option--selected" : ""}`}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onChange(appearance)}
              >
                <span className="customizer-option__sprite" aria-hidden="true">
                  <CharacterSprite
                    appearance={appearance}
                    direction="down"
                    moving={false}
                    displayMode="thumbnail"
                  />
                </span>
                <span className="customizer-option__label">{preset.label}</span>
                {selected ? <span className="customizer-option__check" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
