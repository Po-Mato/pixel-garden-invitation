import { useEffect } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  UsersRound
} from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { shouldReduceMotion } from "../accessibility/viewPreferences";
import { formatEventDate, formatEventStartTime } from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames } from "../invitation/coupleOrder";
import { CoupleProfilePanel } from "./CoupleProfilePanel";
import { DirectionsContent } from "./DirectionsSheet";
import { FamilyContactContent } from "./FamilyContactSheet";
import { GiftAccountContent } from "./GiftAccountSheet";
import { GuestbookExperience } from "./GuestbookExperience";
import { InvitationShareAccess } from "./InvitationShareAccess";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";
import { RsvpPanel } from "./RsvpPanel";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";
import { WeddingGallery } from "./WeddingGallery";
import { WeddingStoryTimeline } from "./WeddingStoryTimeline";

type QuickInvitationProps = {
  nickname?: string;
  canReturnToGarden?: boolean;
  onOpenGarden: () => void;
  weddingDayPreview?: boolean;
};

type SectionHeadingProps = {
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

function SectionHeading({ eyebrow, title, body }: SectionHeadingProps) {
  return (
    <header className="quick-section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </header>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: shouldReduceMotion() ? "auto" : "smooth",
    block: "start"
  });
}

export function QuickInvitation({
  nickname = "",
  canReturnToGarden = false,
  onOpenGarden,
  weddingDayPreview = false
}: QuickInvitationProps) {
  const event = invitationContent.event;
  const coupleOrder = useCoupleOrder();
  const cover = invitationContent.content.gallery[0];
  const names = formatCoupleNames(event, coupleOrder, " & ");

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = window.requestAnimationFrame(() => scrollToSection(id));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <article className="quick-invitation">
      <header className="quick-invitation__topbar">
        <button type="button" onClick={onOpenGarden}>
          <ArrowLeft aria-hidden="true" />
          {canReturnToGarden ? "정원으로 돌아가기" : "캐릭터 정원"}
        </button>
        <div className="quick-invitation__topbar-actions">
          <ViewSettingsAccess variant="icon" />
          <InvitationShareAccess variant="icon" />
        </div>
      </header>

      <section className="quick-hero" id="top" aria-label={`${names} 결혼식 초대`}>
        <div className="quick-hero__image">
          <ResponsiveGalleryImage photo={cover} priority sizes="(max-width: 520px) 100vw, 430px" />
        </div>
        <div className="quick-hero__shade" aria-hidden="true" />
        <div className="quick-hero__content">
          <p>WEDDING INVITATION</p>
          <h1>{names}</h1>
          <time dateTime={event.startAt}>{formatEventDate(event)} · {formatEventStartTime(event)}</time>
          <span>{event.venue.name} {event.venue.hall}</span>
        </div>
      </section>

      <nav className="quick-invitation__nav" aria-label="간편 초대장 목차">
        {navigation.map(([label, id]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <section className="quick-intro quick-band" aria-labelledby="quick-intro-title">
        <Sparkles aria-hidden="true" />
        <p>서로의 계절을 함께 걷기로 했습니다.</p>
        <h2 id="quick-intro-title">소중한 분들을<br />저희의 첫날에 초대합니다.</h2>
        <span>{invitationContent.content.coupleMessage}</span>
      </section>

      <section className="quick-band quick-band--profiles" id="couple">
        <SectionHeading
          eyebrow="BRIDE & GROOM"
          title="두 사람을 소개합니다"
          body="서로의 일상에 가장 편안한 사람이 된 두 사람입니다."
        />
        <CoupleProfilePanel />
      </section>

      <section className="quick-band quick-band--story" id="story">
        <SectionHeading eyebrow="OUR STORY" title="함께 걸어온 시간" />
        <WeddingStoryTimeline />
      </section>

      <section className="quick-band quick-band--gallery" id="gallery">
        <SectionHeading
          eyebrow="GALLERY"
          title="우리의 장면들"
          body="사진을 누르면 한 장씩 크게 감상할 수 있습니다."
        />
        <WeddingGallery />
      </section>

      <section className="quick-band quick-band--event" id="schedule">
        <SectionHeading eyebrow="WEDDING DAY" title="예식 일정" />
        <WeddingEventSummary
          variant="detail"
          weddingDayPreview={weddingDayPreview}
          onFamilyContactOpen={() => scrollToSection("contact")}
        />
      </section>

      <section className="quick-band quick-band--directions" id="directions">
        <SectionHeading
          eyebrow="LOCATION"
          title="오시는 길"
          body="소사역 1번 출구에서 도보 약 3분 거리입니다."
        />
        <DirectionsContent />
      </section>

      <section className="quick-band quick-band--rsvp" id="rsvp">
        <SectionHeading
          eyebrow="RSVP"
          title="참석 여부를 알려주세요"
          body="예식 준비를 위해 2027년 4월 24일까지 답변 부탁드립니다."
        />
        <RsvpPanel />
      </section>

      <section className="quick-band quick-band--gift" id="gift">
        <SectionHeading eyebrow="WITH GRATITUDE" title="마음 전하실 곳" />
        <GiftAccountContent />
      </section>

      <section className="quick-band quick-band--contact" id="contact">
        <SectionHeading eyebrow="CONTACT" title="혼주 연락처" />
        <FamilyContactContent />
      </section>

      <section className="quick-band quick-band--guestbook" id="guestbook">
        <SectionHeading
          eyebrow="GUESTBOOK"
          title="축하의 말을 남겨주세요"
          body="남겨주신 마음은 두 사람에게 오래도록 소중한 선물이 됩니다."
        />
        <GuestbookExperience nickname={nickname} />
      </section>

      <section className="quick-closing quick-band" id="share">
        <Heart aria-hidden="true" />
        <h2>기쁜 날, 함께해 주세요.</h2>
        <p>{names}</p>
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
        <button type="button" onClick={() => scrollToSection("top")}>맨 위로</button>
      </footer>
    </article>
  );
}
