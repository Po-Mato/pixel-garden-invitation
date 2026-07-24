import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  resolveGuestPreset,
  type CharacterAppearance
} from "@wedding-game/shared";
import { RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  randomizeAppearance,
  updateAppearance
} from "../character/appearanceState";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterSprite } from "./CharacterSprite";

type Props = {
  value: CharacterAppearance;
  onChange: (appearance: CharacterAppearance) => void;
};

export function CharacterCustomizer({ value, onChange }: Props) {
  const selectedPreset = resolveGuestPreset(value);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);

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
          <CharacterPortrait
            appearance={value}
            label="선택한 하객 캐릭터"
          />
        </div>
        <p className="character-customizer__selected-name">{selectedPreset.label}</p>
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
