import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, CircleHelp, MapPin, Sparkles } from "lucide-react";
import {
  defaultCharacterAppearance,
  resolveGuestPreset,
  type CharacterAppearance,
  type PublicInvitationInvite
} from "@wedding-game/shared";
import { loadAppearance, saveAppearance } from "../character/storage";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import {
  formatEventDate,
  formatEventStartTime,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { BottomSheet } from "./BottomSheet";
import { CharacterCustomizer } from "./CharacterCustomizer";
import { CharacterSprite } from "./CharacterSprite";
import { CouplePuppetStage } from "./CouplePuppetStage";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { InvitationShareAccess } from "./InvitationShareAccess";
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
  const [eventInfoOpen, setEventInfoOpen] = useState(false);
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [characterReady, setCharacterReady] = useState(() => import.meta.env.MODE === "test");

  useEffect(() => {
    if (invitedGuest?.guestName) setNickname((current) => current || invitedGuest.guestName);
  }, [invitedGuest]);

  useEffect(() => {
    if (!characterPickerOpen || characterReady) return;
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
  }, [characterPickerOpen, characterReady]);

  const canEnter = nickname.trim().length > 0;
  const selectedPreset = resolveGuestPreset(appearance);
  const openCharacterPicker = () => {
    onEnterIntent?.();
    setCharacterPickerOpen(true);
  };
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
      <nav className="entry-screen__utilities" aria-label="빠른 도구">
        <button
          className="entry-screen__utility-button entry-screen__utility-button--help"
          type="button"
          aria-label="예식 도움말"
          title="예식 도움말"
          onClick={() => setEventInfoOpen(true)}
        >
          <CircleHelp aria-hidden="true" />
        </button>
        <InvitationShareAccess variant="icon" />
        <ViewSettingsAccess variant="icon" />
      </nav>
      <div className="entry-screen__hero">
        <header className="entry-screen__header">
          <p>WEDDING GARDEN · {weddingYear}</p>
          <h1 id="entry-screen-title">{formatCoupleNames(event, coupleOrder, " & ")}의 정원</h1>
          <span>두 사람의 새로운 시작에 함께해 주세요.</span>
        </header>
        <CouplePuppetStage
          className="entry-screen__couple-puppets"
          order={coupleOrder}
          framing="portrait"
          label={`${formatCoupleNames(event, coupleOrder)} 2D 퍼펫`}
          priority
        />
        {invitedGuest ? (
          <p className="entry-screen__invite">
            <strong>{invitedGuest.guestName}님을 초대합니다.</strong>
            <span>{invitedGuest.groupLabel ? `${invitedGuest.groupLabel} 하객으로 ` : ""}두 사람의 소중한 날을 함께해 주세요.</span>
          </p>
        ) : null}
        {inviteNotice ? <p className="entry-screen__invite-notice" role="status">{inviteNotice}</p> : null}
      </div>
      <div className="entry-screen__actions">
        <button
          className="entry-screen__event-brief"
          type="button"
          aria-label="예식 정보 열기"
          onClick={() => setEventInfoOpen(true)}
        >
          <span>
            <CalendarDays aria-hidden="true" />
            <span className="entry-screen__event-date">
              <time dateTime={event.startAt}>{formatEventDate(event)}</time>
              <span aria-hidden="true">·</span>
              <time dateTime={event.startAt}>{formatEventStartTime(event)}</time>
            </span>
          </span>
          <span>
            <MapPin aria-hidden="true" />
            <strong>{formatVenueLabel(event)}</strong>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          className="entry-screen__character-access"
          type="button"
          onFocus={onEnterIntent}
          onPointerEnter={onEnterIntent}
          onPointerDown={onEnterIntent}
          onClick={openCharacterPicker}
        >
          <span className="entry-screen__character-thumb" aria-hidden="true">
            <CharacterSprite
              appearance={appearance}
              direction="down"
              moving={false}
              displayMode="thumbnail"
            />
          </span>
          <span>
            <small>입장 캐릭터</small>
            <strong>{selectedPreset.label}</strong>
          </span>
          <span className="entry-screen__character-command">
            <Sparkles aria-hidden="true" />
            선택하기
          </span>
        </button>
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
      </div>
      {eventInfoOpen ? (
        <BottomSheet title="예식 정보" className="entry-event-sheet" onClose={() => setEventInfoOpen(false)}>
          <WeddingEventSummary
            variant="detail"
            weddingDayPreview={weddingDayPreview}
            onFamilyContactOpen={() => setFamilyContactOpen(true)}
          />
          <GuestInformationAccess variant="entry" />
        </BottomSheet>
      ) : null}
      {characterPickerOpen ? (
        <BottomSheet
          title="하객 캐릭터 선택"
          className="entry-character-sheet"
          onClose={() => setCharacterPickerOpen(false)}
        >
          <div className="entry-character-picker">
            {characterReady ? (
              <CharacterCustomizer value={appearance} onChange={setAppearance} />
            ) : (
              <div className="character-customizer-loading" role="status" aria-label="하객 캐릭터 목록 준비 중">
                <span /><span /><span />
              </div>
            )}
            <div className="entry-character-picker__controls">
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
          </div>
        </BottomSheet>
      ) : null}
      {familyContactOpen ? (
        <FamilyContactSheet onClose={() => setFamilyContactOpen(false)} />
      ) : null}
    </section>
  );
}
