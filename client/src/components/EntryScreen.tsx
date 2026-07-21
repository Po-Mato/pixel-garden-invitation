import { useState } from "react";
import {
  defaultCharacterAppearance,
  invitationContent,
  type CharacterAppearance
} from "@wedding-game/shared";
import { loadAppearance, saveAppearance } from "../character/storage";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { CharacterCustomizer } from "./CharacterCustomizer";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { WeddingEventSummary } from "./WeddingEventSummary";

export type EntryProfile = {
  nickname: string;
  appearance: CharacterAppearance;
};

type EntryScreenProps = {
  onEnter: (profile: EntryProfile) => void;
  weddingDayPreview?: boolean;
};

export function EntryScreen({ onEnter, weddingDayPreview = false }: EntryScreenProps) {
  const event = invitationContent.event;
  const coupleOrder = useCoupleOrder();
  const weddingYear = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: event.timeZone
  }).format(new Date(event.startAt));
  const [nickname, setNickname] = useState("");
  const [appearance, setAppearance] = useState(
    () => loadAppearance() ?? defaultCharacterAppearance
  );
  const [familyContactOpen, setFamilyContactOpen] = useState(false);

  const canEnter = nickname.trim().length > 0;
  const enterGarden = () => {
    saveAppearance(appearance);
    onEnter({ nickname: nickname.trim(), appearance });
  };

  return (
    <section className="entry-screen">
      <div className="entry-screen__ambient" aria-hidden="true">
        <span className="entry-screen__prism entry-screen__prism--one" />
        <span className="entry-screen__prism entry-screen__prism--two" />
        <span className="entry-screen__petals" />
      </div>
      <header className="entry-screen__header">
        <p>WEDDING GARDEN · {weddingYear}</p>
        <h1>{formatCoupleNames(event, coupleOrder, " & ")}의 정원</h1>
        <span>정원에 입장할 하객 캐릭터를 선택해주세요.</span>
      </header>
      <WeddingEventSummary
        variant="compact"
        weddingDayPreview={weddingDayPreview}
        onFamilyContactOpen={() => setFamilyContactOpen(true)}
      />
      <CharacterCustomizer value={appearance} onChange={setAppearance} />
      <div className="entry-screen__controls">
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
      </div>
      {familyContactOpen ? (
        <FamilyContactSheet onClose={() => setFamilyContactOpen(false)} />
      ) : null}
    </section>
  );
}
