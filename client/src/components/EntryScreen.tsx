import { useState } from "react";
import {
  defaultCharacterAppearance,
  type CharacterAppearance
} from "@wedding-game/shared";
import { loadAppearance, saveAppearance } from "../character/storage";
import { CharacterCustomizer } from "./CharacterCustomizer";

export type EntryProfile = {
  nickname: string;
  appearance: CharacterAppearance;
};

type EntryScreenProps = {
  onEnter: (profile: EntryProfile) => void;
};

export function EntryScreen({ onEnter }: EntryScreenProps) {
  const [nickname, setNickname] = useState("");
  const [appearance, setAppearance] = useState(
    () => loadAppearance() ?? defaultCharacterAppearance
  );

  const canEnter = nickname.trim().length > 0;
  const enterGarden = () => {
    saveAppearance(appearance);
    onEnter({ nickname: nickname.trim(), appearance });
  };

  return (
    <section className="entry-screen">
      <header className="entry-screen__header">
        <p>WEDDING GARDEN · 2026</p>
        <h1>서준 & 하린의 정원</h1>
        <span>정원에 입장할 완성 하객 캐릭터를 선택해주세요.</span>
      </header>
      <CharacterCustomizer value={appearance} onChange={setAppearance} />
      <label className="field">
        <span>닉네임</span>
        <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} />
      </label>
      <button
        className="primary-button"
        type="button"
        disabled={!canEnter}
        onClick={enterGarden}
      >
        정원 입장
      </button>
    </section>
  );
}
