import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Gamepad2,
  Heart,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  UsersRound
} from "lucide-react";
import { shouldReduceMotion } from "../accessibility/viewPreferences";
import { formatEventDate, formatEventStartTime } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { DirectionsContent } from "./DirectionsSheet";
import { DeferredContent } from "./DeferredContent";
import { FamilyContactContent } from "./FamilyContactSheet";
import { GiftAccountContent } from "./GiftAccountSheet";
import { GuestbookExperience } from "./GuestbookExperience";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { InvitationShareAccess } from "./InvitationShareAccess";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";
import { RsvpPanel } from "./RsvpPanel";
import { RsvpSavedStatus } from "./RsvpSavedStatus";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";
import { WeddingGallery } from "./WeddingGallery";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";
import { observeAnalyticsSections } from "../analytics/invitationAnalytics";
import { journeyCheckpoints } from "../game/journeyProgress";
import { quickInvitationHashForCheckpoint } from "../game/journeyAccessibility";
import { InvitationPriorityActions } from "./InvitationPriorityActions";
import {
  loadInvitationViewSync,
  saveQuickViewSection,
  type QuickInvitationSectionId
} from "../game/invitationViewSync";
import "../invitation-priority-actions.css";
import "../quick-invitation-continuity.css";
import "../rsvp-saved-status.css";

type QuickInvitationProps = {
  nickname?: string;
  canReturnToGarden?: boolean;
  onOpenGarden: () => void;
  weddingDayPreview?: boolean;
  now?: Date;
};

type SectionHeadingProps = {
  number: string;
  eyebrow: string;
  title: string;
  body?: string;
};

const navigation = [
  ["두 사람", "couple"],
  ["사진", "gallery"],
  ["일정", "schedule"],
  ["오시는 길", "directions"],
  ["참석", "rsvp"],
  ["방명록", "guestbook"]
] as const;

const invitationSectionOrder: readonly QuickInvitationSectionId[] = [
  "top", "couple", "story", "gallery", "schedule", "directions", "rsvp", "gift", "contact", "guestbook", "share"
];

const invitationSectionLabels: Record<QuickInvitationSectionId, string> = {
  top: "초대장",
  couple: "두 사람",
  story: "우리 이야기",
  gallery: "웨딩 사진",
  schedule: "예식 일정",
  directions: "오시는 길",
  rsvp: "참석 답변",
  gift: "마음 전하실 곳",
  contact: "혼주 연락처",
  guestbook: "방명록",
  share: "마무리"
};

function SectionHeading({ number, eyebrow, title, body }: SectionHeadingProps) {
  return (
    <header className="quick-section-heading">
      <div className="quick-section-heading__eyebrow">
        <span aria-hidden="true">{number}</span>
        <span>{eyebrow}</span>
      </div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </header>
  );
}

function scrollToSection(id: string) {
  const timers: number[] = [];
  const align = (smooth: boolean) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({
      behavior: smooth && !shouldReduceMotion() ? "smooth" : "auto",
      block: "start"
    });
    if (smooth && target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  };
  align(true);
  [180, 520, 1_200].forEach((delay) => {
    timers.push(window.setTimeout(() => align(false), delay));
  });
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export function QuickInvitation({
  nickname = "",
  canReturnToGarden = false,
  onOpenGarden,
  weddingDayPreview = false,
  now
}: QuickInvitationProps) {
  const { event, content } = usePublishedInvitationContent();
  const coupleOrder = useCoupleOrder();
  const cover = content.gallery[0];
  const names = formatCoupleNames(event, coupleOrder, " & ");
  const heroNames = names.split(" & ");
  const activeSectionRef = useRef<QuickInvitationSectionId>(
    loadInvitationViewSync()?.sectionId ?? "top"
  );
  const invitationRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<QuickInvitationSectionId>(activeSectionRef.current);
  const [topbarState, setTopbarState] = useState<"hero" | "scrolled">("hero");
  const activeSectionNumber = Math.max(1, invitationSectionOrder.indexOf(activeSection) + 1);
  const activeSectionProgress = activeSectionNumber / invitationSectionOrder.length * 100;

  const selectSection = (id: QuickInvitationSectionId) => {
    if (activeSectionRef.current !== id) {
      activeSectionRef.current = id;
      setActiveSection(id);
      saveQuickViewSection(id);
    }
    return scrollToSection(id);
  };

  useEffect(() => {
    const synced = loadInvitationViewSync();
    const id = window.location.hash.slice(1) || (synced?.source === "game" ? synced.sectionId : "");
    if (!id) return;
    let cancelAlignment: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      cancelAlignment = scrollToSection(id);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cancelAlignment?.();
    };
  }, []);

  useEffect(() => {
    const invitation = invitationRef.current;
    if (!invitation) return;
    const sections = [...invitation.querySelectorAll<HTMLElement>("section[id]")];
    let frame = 0;
    const updateScrollContext = () => {
      const nextState = invitation.scrollTop > 72 ? "scrolled" : "hero";
      setTopbarState((current) => current === nextState ? current : nextState);
      const activationLine = invitation.getBoundingClientRect().top + Math.min(220, invitation.clientHeight * 0.3);
      const visibleSection = invitation.scrollTop <= 1
        ? sections[0]
        : [...sections].reverse().find((section) => section.getBoundingClientRect().top <= activationLine);
      const id = visibleSection?.id as QuickInvitationSectionId | undefined;
      if (id && activeSectionRef.current !== id) {
        activeSectionRef.current = id;
        setActiveSection(id);
        saveQuickViewSection(id);
      }
    };
    const scheduleUpdate = () => {
      const nextState = invitation.scrollTop > 72 ? "scrolled" : "hero";
      setTopbarState((current) => current === nextState ? current : nextState);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateScrollContext);
    };
    setTopbarState(invitation.scrollTop > 72 ? "scrolled" : "hero");
    invitation.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      invitation.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const returnToGarden = () => {
    saveQuickViewSection(activeSectionRef.current);
    onOpenGarden();
  };

  useEffect(() => observeAnalyticsSections([
    { id: "gallery", event: "gallery_view" },
    { id: "directions", event: "directions_view" },
    { id: "rsvp", event: "rsvp_view" },
    { id: "guestbook", event: "guestbook_view" }
  ]), []);

  return (
    <article ref={invitationRef} className="quick-invitation" data-scroll-state={topbarState}>
      <header className="quick-invitation__topbar" data-scrolled={topbarState === "scrolled" ? "true" : undefined}>
        <button
          type="button"
          aria-label={canReturnToGarden ? "정원으로 돌아가기" : "입장 선택"}
          onClick={returnToGarden}
        >
          <ArrowLeft aria-hidden="true" />
          <span className="quick-invitation__topbar-label">
            {canReturnToGarden ? "정원으로 돌아가기" : "입장 선택"}
          </span>
        </button>
        <div className="quick-invitation__topbar-brand" aria-hidden="true">
          <small>
            {topbarState === "hero" && activeSection === "top"
              ? `WEDDING DAY · ${event.startAt.slice(0, 10).replaceAll("-", ".")}`
              : `${String(activeSectionNumber).padStart(2, "0")} / ${invitationSectionOrder.length} · ${invitationSectionLabels[activeSection]}`}
          </small>
          <strong>{formatCoupleNames(event, coupleOrder, " · ")}</strong>
        </div>
        <div className="quick-invitation__topbar-actions">
          <GuestInformationAccess variant="quick" />
          <ViewSettingsAccess variant="icon" />
          <InvitationShareAccess variant="icon" />
        </div>
        <i className="quick-invitation__topbar-progress" aria-hidden="true">
          <span style={{ width: `${activeSectionProgress}%` }} />
        </i>
      </header>

      <section className="quick-hero" id="top" aria-label={`${names} 결혼식 초대`}>
        <div className="quick-hero__image">
          <ResponsiveGalleryImage photo={cover} priority sizes="(max-width: 520px) 100vw, 430px" />
        </div>
        <div className="quick-hero__shade" aria-hidden="true" />
        <div className="quick-hero__content">
          <p className="quick-hero__eyebrow">WEDDING INVITATION</p>
          <h1 aria-label={names}>
            <span>{heroNames[0]}</span>
            <i aria-hidden="true">·</i>
            <span>{heroNames[1]}</span>
          </h1>
          <div className="quick-hero__facts" aria-label="예식 핵심 정보">
            <div>
              <CalendarDays aria-hidden="true" />
              <span>
                <small>일시</small>
                <time dateTime={event.startAt}>{formatEventDate(event)}</time>
                <b>{formatEventStartTime(event)}</b>
              </span>
            </div>
            <div>
              <MapPin aria-hidden="true" />
              <span>
                <small>장소</small>
                <strong>{event.venue.name}</strong>
                <b>{event.venue.hall}</b>
              </span>
            </div>
          </div>
          <div className="quick-hero__actions">
            <button type="button" onClick={() => selectSection("schedule")}>
              예식 정보 보기 <ArrowDown aria-hidden="true" />
            </button>
            <button type="button" onClick={() => selectSection("couple")}>
              두 사람 이야기부터 보기
            </button>
          </div>
        </div>
      </section>

      <nav className="quick-invitation__nav" aria-label="간편 초대장 목차">
        {navigation.map(([label, id]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeSection === id ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              selectSection(id);
            }}
          >
            {label}
          </a>
        ))}
      </nav>

      <InvitationPriorityActions event={event} now={now} onSelect={(id) => scrollToSection(id)} />
      <RsvpSavedStatus event={event} onOpenDetails={() => scrollToSection("rsvp")} />

      <section className="quick-intro quick-band" aria-labelledby="quick-intro-title">
        <Sparkles aria-hidden="true" />
        <p>서로의 계절을 함께 걷기로 했습니다.</p>
        <h2 id="quick-intro-title">소중한 분들을<br />저희의 첫날에 초대합니다.</h2>
        <span>{content.coupleMessage}</span>
      </section>

      <section className="quick-band quick-band--profiles" id="couple" data-flow="story">
        <SectionHeading
          number="01"
          eyebrow="BRIDE & GROOM"
          title="두 사람을 소개합니다"
          body="서로의 일상에 가장 편안한 사람이 된 두 사람입니다."
        />
        <CoupleProfilePanel />
      </section>

      <section className="quick-band quick-band--story" id="story" data-flow="story">
        <SectionHeading number="02" eyebrow="OUR STORY" title="함께 걸어온 시간" />
        <WeddingStoryTimeline />
      </section>

      <section className="quick-band quick-band--gallery" id="gallery" data-flow="story">
        <SectionHeading
          number="03"
          eyebrow="GALLERY"
          title="우리의 장면들"
          body="사진을 누르면 한 장씩 크게 감상할 수 있습니다."
        />
        <DeferredContent label="사진 갤러리" minHeight={420}>
          <WeddingGallery />
        </DeferredContent>
      </section>

      <section className="quick-band quick-band--event" id="schedule" data-flow="visit">
        <SectionHeading number="04" eyebrow="WEDDING DAY" title="예식 일정" />
        <WeddingEventSummary
          variant="detail"
          weddingDayPreview={weddingDayPreview}
          onFamilyContactOpen={() => scrollToSection("contact")}
        />
      </section>

      <section className="quick-band quick-band--directions" id="directions" data-flow="visit">
        <SectionHeading
          number="05"
          eyebrow="LOCATION"
          title="오시는 길"
          body="소사역 1번 출구에서 도보 약 3분 거리입니다."
        />
        <DirectionsContent />
      </section>

      <section className="quick-band quick-band--rsvp" id="rsvp" data-flow="reply">
        <SectionHeading
          number="06"
          eyebrow="RSVP"
          title="참석 여부를 알려주세요"
          body="예식 준비를 위해 2027년 4월 24일까지 답변 부탁드립니다."
        />
        <DeferredContent label="참석 답변" minHeight={360} rootMargin="360px 0px">
          <RsvpPanel onBackToDirections={() => selectSection("directions")} />
        </DeferredContent>
      </section>

      <section className="quick-band quick-band--gift" id="gift" data-flow="reply">
        <SectionHeading number="07" eyebrow="WITH GRATITUDE" title="마음 전하실 곳" />
        <GiftAccountContent />
      </section>

      <section className="quick-band quick-band--contact" id="contact" data-flow="reply">
        <SectionHeading number="08" eyebrow="CONTACT" title="혼주 연락처" />
        <FamilyContactContent />
      </section>

      <section className="quick-band quick-band--guestbook" id="guestbook" data-flow="reply">
        <SectionHeading
          number="09"
          eyebrow="GUESTBOOK"
          title="축하의 말을 남겨주세요"
          body="남겨주신 마음은 두 사람에게 오래도록 소중한 선물이 됩니다."
        />
        <DeferredContent label="방명록" minHeight={320} rootMargin="320px 0px">
          <GuestbookExperience nickname={nickname} />
        </DeferredContent>
      </section>

      <details className="quick-destination-disclosure">
        <summary>
          <Gamepad2 aria-hidden="true" />
          <span><strong>게임으로 둘러볼 장소</strong><small>선택 사항 · 여정 {journeyCheckpoints.length}곳</small></span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <nav className="quick-destination-nav" aria-label="초대장 목적지 탐색">
          <ol>
            {journeyCheckpoints.map((checkpoint, index) => (
              <li key={checkpoint.id}>
                <a href={quickInvitationHashForCheckpoint(checkpoint)}>
                  <b>{index + 1}</b>
                  <span><strong>{checkpoint.label}</strong><small>{checkpoint.detail}</small></span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </details>

      <section className="quick-closing quick-band" id="share">
        <Heart aria-hidden="true" />
        <span className="quick-closing__eyebrow">THANK YOU</span>
        <h2>기쁜 날, 함께해 주세요.</h2>
        <p>{names}</p>
        <small className="quick-closing__note">초대장을 간직하거나 참석 여부를 알려주세요.</small>
        <div className="quick-closing__actions">
          <InvitationShareAccess variant="menu" />
          <button type="button" onClick={() => scrollToSection("rsvp")}>
            <Send aria-hidden="true" /> 참석 답변
          </button>
        </div>
        <div className="quick-closing__links" aria-label="안내 바로가기">
          <button type="button" onClick={() => scrollToSection("schedule")}>
            <CalendarDays aria-hidden="true" /> 일정
          </button>
          <button type="button" onClick={() => scrollToSection("directions")}>
            <MapPin aria-hidden="true" /> 장소
          </button>
          <button type="button" onClick={() => scrollToSection("gift")}>
            <HeartHandshake aria-hidden="true" /> 계좌
          </button>
          <button type="button" onClick={() => scrollToSection("contact")}>
            <UsersRound aria-hidden="true" /> 연락처
          </button>
          <button type="button" onClick={() => scrollToSection("guestbook")}>
            <MessageCircle aria-hidden="true" /> 방명록
          </button>
        </div>
      </section>

      <footer className="quick-invitation__footer">
        <span>{event.startAt.slice(0, 10).replaceAll("-", ".")}</span>
        <strong>{names}</strong>
        <button type="button" onClick={() => scrollToSection("top")}><ArrowUp aria-hidden="true" /> 맨 위로</button>
      </footer>
      <nav className="quick-core-actions" aria-label="초대장 핵심 바로가기" data-active-section={activeSection}>
        <button
          type="button"
          aria-current={activeSection === "schedule" ? "page" : undefined}
          onClick={() => selectSection("schedule")}
        >
          <CalendarDays aria-hidden="true" />
          <span>일정</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === "directions" ? "page" : undefined}
          onClick={() => selectSection("directions")}
        >
          <MapPin aria-hidden="true" />
          <span>길 찾기</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === "rsvp" ? "page" : undefined}
          onClick={() => selectSection("rsvp")}
        >
          <Send aria-hidden="true" />
          <span>참석</span>
        </button>
        <InvitationShareAccess variant="menu" compactLabel current={activeSection === "share"} />
      </nav>
    </article>
  );
}
