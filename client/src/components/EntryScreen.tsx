import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { BookOpen, CalendarDays, ChevronRight, CircleHelp, Ellipsis, MapPin, RotateCcw, Sparkles } from "lucide-react";
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
  returningProfile?: EntryProfile | null;
  onResumeGarden?: () => void;
  weddingDayPreview?: boolean;
  invitedGuest?: PublicInvitationInvite | null;
  inviteNotice?: string;
};

export function EntryScreen({
  onEnter,
  onEnterIntent,
  onQuickView,
  onQuickViewIntent,
  returningProfile = null,
  onResumeGarden,
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
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [puppetMotionEnabled, setPuppetMotionEnabled] = useState(false);
  const [characterReady, setCharacterReady] = useState(() => import.meta.env.MODE === "test");
  const utilitiesId = useId();
  const utilitiesButtonRef = useRef<HTMLButtonElement>(null);
  const utilitiesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!utilitiesOpen) return;
    utilitiesMenuRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus({ preventScroll: true });
  }, [utilitiesOpen]);

  const handleUtilityMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(utilitiesMenuRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    if (event.key === "Escape") {
      event.preventDefault();
      setUtilitiesOpen(false);
      utilitiesButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  };

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
  const prepareGarden = () => {
    setPuppetMotionEnabled(true);
    onEnterIntent?.();
  };
  const openCharacterPicker = () => {
    prepareGarden();
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
          ref={utilitiesButtonRef}
          className="entry-screen__utility-button entry-screen__utility-button--more"
          type="button"
          aria-label={utilitiesOpen ? "도구 더보기 닫기" : "도구 더보기"}
          aria-expanded={utilitiesOpen}
          aria-controls={utilitiesId}
          aria-haspopup="true"
          title="도구 더보기"
          onClick={() => setUtilitiesOpen((current) => !current)}
        >
          <Ellipsis aria-hidden="true" />
        </button>
        {utilitiesOpen ? (
          <div
            ref={utilitiesMenuRef}
            id={utilitiesId}
            className="entry-screen__utility-menu"
            role="group"
            aria-label="도움말·공유·설정"
            onKeyDown={handleUtilityMenuKeyDown}
            onClickCapture={() => setUtilitiesOpen(false)}
          >
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
          </div>
        ) : null}
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
          arrangement="close"
          label={`${formatCoupleNames(event, coupleOrder)} 2D 퍼펫`}
          priority
          motionEnabled={puppetMotionEnabled}
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
        {onQuickView ? (
          <button
            className="entry-screen__quick-access entry-screen__quick-access--primary"
            type="button"
            onFocus={onQuickViewIntent}
            onPointerEnter={onQuickViewIntent}
            onPointerDown={onQuickViewIntent}
            onClick={onQuickView}
          >
            <BookOpen aria-hidden="true" />
            <span><small>일정 · 사진 · 오시는 길</small><strong>초대장 바로 보기</strong></span>
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
        {returningProfile && onResumeGarden ? (
          <button
            className="entry-screen__resume-access"
            type="button"
            onFocus={onEnterIntent}
            onPointerEnter={onEnterIntent}
            onPointerDown={onEnterIntent}
            onClick={onResumeGarden}
          >
            <RotateCcw aria-hidden="true" />
            <span>
              <small>{returningProfile.nickname}님의 저장된 여정</small>
              <strong>지난 정원 이어가기</strong>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
        <button
          className="entry-screen__character-access"
          type="button"
          aria-label={`입장 캐릭터 ${selectedPreset.label} 설정하고 게임으로 둘러보기`}
          onFocus={prepareGarden}
          onPointerEnter={prepareGarden}
          onPointerDown={prepareGarden}
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
            <small>게임은 선택 사항</small>
            <strong>{selectedPreset.label}로 정원 둘러보기</strong>
          </span>
          <span className="entry-screen__character-command">
            <Sparkles aria-hidden="true" />
            설정
          </span>
        </button>
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
                  onFocus={prepareGarden}
                  onChange={(event) => {
                    prepareGarden();
                    setNickname(event.target.value);
                  }}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={!canEnter}
                onFocus={prepareGarden}
                onPointerEnter={prepareGarden}
                onPointerDown={prepareGarden}
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
