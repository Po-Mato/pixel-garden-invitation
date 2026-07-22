import { useEffect, useState } from "react";
import {
  Car,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  TrainFront,
  UsersRound
} from "lucide-react";
import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import {
  formatEventDate,
  formatEventEndTime,
  formatEventStartTime,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { buildDirectionsLinks } from "../invitation/directions";
import {
  getWeddingDayPreviewNow,
  getWeddingDayStatus
} from "../invitation/weddingDay";
import { BottomSheet } from "./BottomSheet";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";

type WeddingDayQuickAccessProps = {
  variant: "summary" | "world";
  preview?: boolean;
  now?: Date;
  event?: WeddingEvent;
  onOpenChange?: (open: boolean) => void;
  onFamilyContactOpen?: () => void;
};

const clockRefreshMs = 30_000;

export function WeddingDayQuickAccess({
  variant,
  preview = false,
  now,
  event = invitationContent.event,
  onOpenChange,
  onFamilyContactOpen
}: WeddingDayQuickAccessProps) {
  const [clock, setClock] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const effectiveNow = preview ? getWeddingDayPreviewNow(event) : now ?? clock;
  const status = getWeddingDayStatus(event, effectiveNow);

  useEffect(() => {
    if (preview || now) return;
    const timer = window.setInterval(() => setClock(new Date()), clockRefreshMs);
    return () => window.clearInterval(timer);
  }, [now, preview]);

  if (!status) return null;

  const links = buildDirectionsLinks(event.venue);
  const mapLinks = [
    ["네이버지도", links.naver, "naver"],
    ["카카오맵", links.kakao, "kakao"],
    ["Google 지도", links.google, "google"]
  ] as const;
  const hasFamilyContacts = event.familyContacts.contacts.some((contact) => contact.phone.trim());

  const setVisibility = (visible: boolean) => {
    setOpen(visible);
    onOpenChange?.(visible);
  };

  const openFamilyContacts = () => {
    setVisibility(false);
    onFamilyContactOpen?.();
  };

  return (
    <>
      <button
        type="button"
        className={`wedding-day-trigger wedding-day-trigger--${variant}`}
        aria-label={`예식 당일 안내: ${status.headline}`}
        onClick={() => setVisibility(true)}
      >
        <Clock3 aria-hidden="true" />
        {variant === "world" ? (
          <span><small>WEDDING DAY</small>당일 안내</span>
        ) : (
          <span>{status.headline}</span>
        )}
      </button>

      {open ? (
        <BottomSheet title="예식 당일 안내" onClose={() => setVisibility(false)}>
          <div className="wedding-day-sheet">
            <section className="wedding-day-sheet__status" data-phase={status.phase}>
              <Sparkles aria-hidden="true" />
              <div>
                <span>{preview ? "당일 모드 미리보기" : "오늘, 결혼식 날"}</span>
                <strong>{status.headline}</strong>
                <p>{status.detail}</p>
              </div>
            </section>

            <section className="wedding-day-sheet__event">
              <Clock3 aria-hidden="true" />
              <div>
                <span>{formatEventDate(event)}</span>
                <strong>{formatEventStartTime(event)} - {formatEventEndTime(event)}</strong>
              </div>
            </section>

            <section className="wedding-day-sheet__event">
              <MapPin aria-hidden="true" />
              <div>
                <strong>{formatVenueLabel(event)}</strong>
                <span>{event.venue.address}</span>
              </div>
            </section>

            <div className="wedding-day-sheet__maps" aria-label="지도 앱 선택">
              {mapLinks.map(([label, href, provider]) => href ? (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackInvitationAnalytics("map_click", provider)}
                >
                  {label === "네이버지도" ? <Navigation aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
                  {label}
                </a>
              ) : null)}
            </div>

            <section className="wedding-day-sheet__travel">
              <TrainFront aria-hidden="true" />
              <div><strong>대중교통</strong><span>{event.venue.directions.transit}</span></div>
            </section>
            <section className="wedding-day-sheet__travel">
              <Car aria-hidden="true" />
              <div><strong>자가용·주차</strong><span>{event.venue.directions.parking}</span></div>
            </section>

            <div className="wedding-day-sheet__actions">
              {links.telephone ? (
                <a
                  href={links.telephone}
                  aria-label={`${event.venue.name}에 전화하기`}
                  onClick={() => trackInvitationAnalytics("call_click", "venue")}
                >
                  <Phone aria-hidden="true" />
                  예식장 전화
                </a>
              ) : null}
              {hasFamilyContacts && onFamilyContactOpen ? (
                <button type="button" onClick={openFamilyContacts}>
                  <UsersRound aria-hidden="true" />
                  혼주 연락처
                </button>
              ) : null}
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
