import { useState } from "react";
import {
  characterCatalog,
  defaultCharacterAppearance,
  resolveAppearanceOptions,
  type AccessorySlot,
  type CharacterAppearance,
  type CharacterFamily
} from "@wedding-game/shared";
import {
  changeFamily,
  randomizeAppearance,
  updateAppearance
} from "../character/appearanceState";
import { CharacterSprite } from "./CharacterSprite";

type Props = {
  value: CharacterAppearance;
  onChange: (appearance: CharacterAppearance) => void;
};

type CustomizerTab =
  | "family"
  | "hair"
  | "hair-color"
  | "outfit"
  | "outfit-palette"
  | "accessories";

const tabs: Array<{ id: CustomizerTab; label: string }> = [
  { id: "family", label: "기본" },
  { id: "hair", label: "헤어" },
  { id: "hair-color", label: "헤어 색" },
  { id: "outfit", label: "의상" },
  { id: "outfit-palette", label: "의상 색" },
  { id: "accessories", label: "액세서리" }
];

const familyOptions: Array<{ id: CharacterFamily; label: string }> = [
  { id: "masculine", label: "남성 스타일" },
  { id: "feminine", label: "여성 스타일" }
];

const hairSwatches: Record<string, string> = {
  black: "#181414",
  "dark-brown": "#38251f",
  brown: "#674331",
  "light-brown": "#9b714e",
  gray: "#7c7b7d",
  platinum: "#d6cbc0"
};

const skinSwatches: Record<string, string> = {
  "skin-01-light": "#ffe0c7",
  "skin-02-fair": "#f6c5a4",
  "skin-03-medium": "#dca07b",
  "skin-04-tan": "#b97655",
  "skin-05-deep": "#865039"
};

const paletteLabels: Record<string, string> = {
  navy: "네이비",
  charcoal: "차콜",
  sage: "세이지",
  burgundy: "버건디",
  "midnight-blue": "미드나이트 블루",
  graphite: "그래파이트",
  "muted-blue": "뮤트 블루",
  plum: "플럼",
  "navy-beige": "네이비 베이지",
  "brown-cream": "브라운 크림",
  "sage-charcoal": "세이지 차콜",
  "blue-gray": "블루 그레이",
  "oat-charcoal": "오트 차콜",
  "forest-navy": "포레스트 네이비",
  "dusty-blue": "더스티 블루",
  "wine-gray": "와인 그레이",
  "navy-ivory": "네이비 아이보리",
  "sage-cream": "세이지 크림",
  "plum-gray": "플럼 그레이",
  "blue-silver": "블루 실버",
  "dusty-rose": "더스티 로즈",
  wine: "와인",
  forest: "포레스트",
  mauve: "모브",
  "cream-rose": "크림 로즈",
  "ivory-navy": "아이보리 네이비",
  "sky-gray": "스카이 그레이",
  "sage-brown": "세이지 브라운",
  "beige-brown": "베이지 브라운",
  "navy-cream": "네이비 크림",
  "gray-blue": "그레이 블루",
  "rose-cream": "로즈 크림",
  "jade-ivory": "제이드 아이보리",
  "plum-pink": "플럼 핑크",
  "blue-lilac": "블루 라일락"
};

const paletteSwatches: Record<string, string> = {
  navy: "#293a55",
  charcoal: "#474a51",
  sage: "#6f8a72",
  burgundy: "#7b3443",
  "midnight-blue": "#203252",
  graphite: "#3c424b",
  "muted-blue": "#6f879f",
  plum: "#76506e",
  "navy-beige": "#314867",
  "brown-cream": "#775746",
  "sage-charcoal": "#718c77",
  "blue-gray": "#687f91",
  "oat-charcoal": "#b49b76",
  "forest-navy": "#3b6950",
  "dusty-blue": "#8da0b2",
  "wine-gray": "#874458",
  "navy-ivory": "#304467",
  "sage-cream": "#7b967c",
  "plum-gray": "#7d5376",
  "blue-silver": "#6384a0",
  "dusty-rose": "#bf7883",
  wine: "#873d4f",
  forest: "#3d684e",
  mauve: "#946d7f",
  "cream-rose": "#efe0c4",
  "ivory-navy": "#f0e6cf",
  "sky-gray": "#9eb9ca",
  "sage-brown": "#819a7d",
  "beige-brown": "#b89d78",
  "navy-cream": "#3c5476",
  "gray-blue": "#858b94",
  "rose-cream": "#c77d89",
  "jade-ivory": "#51a084",
  "plum-pink": "#845478",
  "blue-lilac": "#698dad"
};

const slotLabels: Record<AccessorySlot, string> = {
  face: "안경",
  jewelry: "주얼리",
  neckwear: "넥웨어",
  carry: "가방"
};

function CharacterOption({
  appearance,
  label,
  selected,
  onSelect
}: {
  appearance: CharacterAppearance;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`customizer-option customizer-option--image ${selected ? "customizer-option--selected" : ""}`}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="customizer-option__sprite" aria-hidden="true">
        <CharacterSprite appearance={appearance} direction="down" moving={false} />
      </span>
      <span>{label}</span>
      {selected ? <span className="customizer-option__check" aria-hidden="true">✓</span> : null}
    </button>
  );
}

function SwatchOption({
  color,
  label,
  selected,
  onSelect
}: {
  color: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`customizer-option customizer-option--swatch ${selected ? "customizer-option--selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="customizer-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
      <span>{label}</span>
      {selected ? <span className="customizer-option__check" aria-hidden="true">✓</span> : null}
    </button>
  );
}

export function CharacterCustomizer({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<CustomizerTab>("hair");
  const options = resolveAppearanceOptions(value.family);
  const selectedOutfit = options.outfits.find((outfit) => outfit.id === value.outfit)
    ?? options.outfits[0];

  const chooseAccessory = (slot: AccessorySlot, id: string | null) => {
    onChange(updateAppearance(value, {
      accessories: { ...value.accessories, [slot]: id }
    }));
  };

  return (
    <section className="character-customizer" aria-label="하객 캐릭터 꾸미기">
      <div className="character-customizer__preview">
        <div className="character-customizer__halo" aria-hidden="true" />
        <div className="character-customizer__sprite">
          <CharacterSprite
            appearance={value}
            direction="down"
            moving={false}
            label="선택한 하객 캐릭터"
          />
        </div>
      </div>

      <div className="character-customizer__actions">
        <button type="button" className="choice" onClick={() => onChange(randomizeAppearance())}>
          무작위 꾸미기
        </button>
        <button type="button" className="choice" onClick={() => onChange(defaultCharacterAppearance)}>
          초기화
        </button>
      </div>

      <div className="character-customizer__tabs" role="tablist" aria-label="캐릭터 꾸미기">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`character-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`character-panel-${tab.id}`}
            className={activeTab === tab.id ? "customizer-tab customizer-tab--selected" : "customizer-tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`character-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`character-tab-${activeTab}`}
        className="character-customizer__panel"
      >
        {activeTab === "family" ? (
          <>
            <h2>캐릭터 기본</h2>
            <div className="customizer-options customizer-options--compact">
              {familyOptions.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  className={`customizer-option ${value.family === family.id ? "customizer-option--selected" : ""}`}
                  aria-pressed={value.family === family.id}
                  onClick={() => onChange(changeFamily(value, family.id))}
                >
                  {family.label}
                  {value.family === family.id ? <span aria-hidden="true"> ✓</span> : null}
                </button>
              ))}
            </div>
            <h3>피부 톤</h3>
            <div className="customizer-options customizer-options--swatches">
              {options.skinTones.map((skin) => (
                <SwatchOption
                  key={skin.id}
                  color={skinSwatches[skin.id]}
                  label={skin.label}
                  selected={value.skinTone === skin.id}
                  onSelect={() => onChange(updateAppearance(value, { skinTone: skin.id }))}
                />
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "hair" ? (
          <>
            <h2>헤어스타일</h2>
            <div className="customizer-options customizer-options--images">
              {options.hairStyles.map((hair) => (
                <CharacterOption
                  key={hair.id}
                  appearance={updateAppearance(value, { hairStyle: hair.id })}
                  label={hair.label}
                  selected={value.hairStyle === hair.id}
                  onSelect={() => onChange(updateAppearance(value, { hairStyle: hair.id }))}
                />
              ))}
            </div>
            <h3>헤어 컬러</h3>
            <div className="customizer-options customizer-options--swatches">
              {options.hairColors.map((color) => (
                <SwatchOption
                  key={color.id}
                  color={hairSwatches[color.id]}
                  label={color.label}
                  selected={value.hairColor === color.id}
                  onSelect={() => onChange(updateAppearance(value, { hairColor: color.id }))}
                />
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "hair-color" ? (
          <>
            <h2>헤어 컬러</h2>
            <div className="customizer-options customizer-options--swatches">
              {options.hairColors.map((color) => (
                <SwatchOption
                  key={color.id}
                  color={hairSwatches[color.id]}
                  label={color.label}
                  selected={value.hairColor === color.id}
                  onSelect={() => onChange(updateAppearance(value, { hairColor: color.id }))}
                />
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "outfit" ? (
          <>
            <h2>하객 의상</h2>
            <div className="customizer-options customizer-options--images">
              {options.outfits.map((outfit) => {
                const appearance = updateAppearance(value, {
                  outfit: outfit.id,
                  outfitPalette: outfit.palettes[0]
                });
                return (
                  <CharacterOption
                    key={outfit.id}
                    appearance={appearance}
                    label={outfit.label}
                    selected={value.outfit === outfit.id}
                    onSelect={() => onChange(appearance)}
                  />
                );
              })}
            </div>
          </>
        ) : null}

        {activeTab === "outfit-palette" ? (
          <>
            <h2>의상 컬러</h2>
            <div className="customizer-options customizer-options--swatches">
              {selectedOutfit.palettes.map((palette) => (
                <SwatchOption
                  key={palette}
                  color={paletteSwatches[palette] ?? "#777"}
                  label={paletteLabels[palette] ?? palette}
                  selected={value.outfitPalette === palette}
                  onSelect={() => onChange(updateAppearance(value, { outfitPalette: palette }))}
                />
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "accessories" ? (
          <div className="customizer-accessories">
            {(Object.keys(slotLabels) as AccessorySlot[]).map((slot) => (
              <section key={slot} className="customizer-accessory-group">
                <h2>{slotLabels[slot]}</h2>
                <div className="customizer-options customizer-options--compact">
                  <button
                    type="button"
                    className={`customizer-option ${value.accessories[slot] === null ? "customizer-option--selected" : ""}`}
                    aria-pressed={value.accessories[slot] === null}
                    onClick={() => chooseAccessory(slot, null)}
                  >
                    {slotLabels[slot]} 없음
                  </button>
                  {characterCatalog.accessories
                    .filter((accessory) => accessory.slot === slot)
                    .map((accessory) => (
                      <button
                        key={accessory.id}
                        type="button"
                        className={`customizer-option ${value.accessories[slot] === accessory.id ? "customizer-option--selected" : ""}`}
                        aria-pressed={value.accessories[slot] === accessory.id}
                        onClick={() => chooseAccessory(slot, accessory.id)}
                      >
                        {accessory.label}
                        {value.accessories[slot] === accessory.id ? <span aria-hidden="true"> ✓</span> : null}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
