import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import {
  defaultCharacterAppearance,
  type CharacterAppearance
} from "@wedding-game/shared";
import { loadAppearance, saveAppearance } from "../character/storage";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { CharacterCustomizer } from "./CharacterCustomizer";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";

export type EntryProfile = {
  nickname: string;
  appearance: CharacterAppearance;
};

type EntryScreenProps = {
  onEnter: (profile: EntryProfile) => void;
  onEnterIntent?: () => void;
  onQuickView?: () => void;
  onQuickViewIntent?: () => void;
  weddingDayPreview?: boolean;
};

export function EntryScreen({
  onEnter,
  onEnterIntent,
  onQuickView,
  onQuickViewIntent,
  weddingDayPreview = false
}: EntryScreenProps) {
  const { event } = usePublishedInvitationContent();
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
    <section className="entry-screen" aria-labelledby="entry-screen-title">
      <div className="entry-screen__ambient" aria-hidden="true">
        <span className="entry-screen__prism entry-screen__prism--one" />
        <span className="entry-screen__prism entry-screen__prism--two" />
        <span className="entry-screen__petals" />
      </div>
      <div className="entry-screen__view-settings">
        <ViewSettingsAccess variant="icon" />
      </div>
      <header className="entry-screen__header">
        <p>WEDDING GARDEN · {weddingYear}</p>
        <h1 id="entry-screen-title">{formatCoupleNames(event, coupleOrder, " & ")}의 정원</h1>
        <span>정원에 입장할 하객 캐릭터를 선택해주세요.</span>
      </header>
      <WeddingEventSummary
        variant="compact"
        weddingDayPreview={weddingDayPreview}
        onFamilyContactOpen={() => setFamilyContactOpen(true)}
      />
      {onQuickView ? (
        <button
          className="entry-screen__quick-access"
          type="button"
          onFocus={onQuickViewIntent}
          onPointerEnter={onQuickViewIntent}
          onPointerDown={onQuickViewIntent}
          onClick={onQuickView}
        >
          <BookOpen aria-hidden="true" />
          <span><small>게임 없이</small><strong>초대장 바로 보기</strong></span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
      <CharacterCustomizer value={appearance} onChange={setAppearance} />
      <div className="entry-screen__controls">
        <label className="field">
          <span>닉네임</span>
          <input
            name="nickname"
            autoComplete="nickname"
            placeholder="예: 신부 친구…"
            value={nickname}
            maxLength={16}
            onFocus={onEnterIntent}
            onChange={(event) => {
              onEnterIntent?.();
              setNickname(event.target.value);
            }}
          />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!canEnter}
          onFocus={onEnterIntent}
          onPointerEnter={onEnterIntent}
          onPointerDown={onEnterIntent}
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
