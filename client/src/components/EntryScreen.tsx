import { useEffect, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import {
  defaultCharacterAppearance,
  type CharacterAppearance,
  type PublicInvitationInvite
} from "@wedding-game/shared";
import { loadAppearance, saveAppearance } from "../character/storage";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { CharacterCustomizer } from "./CharacterCustomizer";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";
import "../invite-link-public.css";

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
  invitedGuest?: PublicInvitationInvite | null;
  inviteNotice?: string;
};

export function EntryScreen({
  onEnter,
  onEnterIntent,
  onQuickView,
  onQuickViewIntent,
  weddingDayPreview = false,
  invitedGuest = null,
  inviteNotice = ""
}: EntryScreenProps) {
  const { event } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const weddingYear = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: event.timeZone
  }).format(new Date(event.startAt));
  const [nickname, setNickname] = useState(() => invitedGuest?.guestName ?? "");
  const [appearance, setAppearance] = useState(
    () => loadAppearance() ?? defaultCharacterAppearance
  );
  const [familyContactOpen, setFamilyContactOpen] = useState(false);
  const [characterReady, setCharacterReady] = useState(() => import.meta.env.MODE === "test");

  useEffect(() => {
    if (invitedGuest?.guestName) setNickname((current) => current || invitedGuest.guestName);
  }, [invitedGuest]);

  useEffect(() => {
    if (characterReady) return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(() => setCharacterReady(true), { timeout: 450 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => setCharacterReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [characterReady]);

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
      {invitedGuest ? (
        <p className="entry-screen__invite">
          <strong>{invitedGuest.guestName}님을 초대합니다.</strong>
          <span>{invitedGuest.groupLabel ? `${invitedGuest.groupLabel} 하객으로 ` : ""}두 사람의 소중한 날을 함께해 주세요.</span>
        </p>
      ) : null}
      {inviteNotice ? <p className="entry-screen__invite-notice" role="status">{inviteNotice}</p> : null}
      <WeddingEventSummary
        variant="compact"
        weddingDayPreview={weddingDayPreview}
        onFamilyContactOpen={() => setFamilyContactOpen(true)}
      />
      <GuestInformationAccess variant="entry" />
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
      {characterReady ? (
        <CharacterCustomizer value={appearance} onChange={setAppearance} />
      ) : (
        <div className="character-customizer-loading" role="status" aria-label="하객 캐릭터 목록 준비 중">
          <span /><span /><span />
        </div>
      )}
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
