import {
  defaultCharacterAppearance,
  guestCharacterPresets,
  resolveGuestPreset,
  type CharacterAppearance
} from "@wedding-game/shared";
import {
  randomizeAppearance,
  updateAppearance
} from "../character/appearanceState";
import { CharacterSprite } from "./CharacterSprite";

type Props = {
  value: CharacterAppearance;
  onChange: (appearance: CharacterAppearance) => void;
};

export function CharacterCustomizer({ value, onChange }: Props) {
  const selectedPreset = resolveGuestPreset(value);

  return (
    <section className="character-customizer" aria-label="하객 캐릭터 선택">
      <div className="character-customizer__preview">
        <div className="character-customizer__halo" aria-hidden="true" />
        <div className="character-customizer__sprite">
          <CharacterSprite
            appearance={value}
            direction="down"
            moving={false}
            label="선택한 하객 캐릭터"
            displayMode="preview"
          />
        </div>
        <p className="character-customizer__selected-name">{selectedPreset.label}</p>
      </div>

      <div className="character-customizer__actions">
        <button type="button" className="choice" onClick={() => onChange(randomizeAppearance())}>
          무작위 선택
        </button>
        <button type="button" className="choice" onClick={() => onChange(defaultCharacterAppearance)}>
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
                <span>{preset.label}</span>
                {selected ? <span className="customizer-option__check" aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
