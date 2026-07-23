import { CalendarClock, Car, MapPinned, MessageCircleHeart, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeddingEvent } from "@wedding-game/shared";
import { buildDirectionsLinks } from "../invitation/directions";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { getWeddingDayPreviewNow, getWeddingDayStatus } from "../invitation/weddingDay";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";
import { DirectionsSheet } from "./DirectionsSheet";

type WeddingDayActionBarProps = {
  variant: "quick" | "world";
  preview?: boolean;
  now?: Date;
  event?: WeddingEvent;
  onSchedule: () => void;
  onRsvp: () => void;
  onOpenChange?: (open: boolean) => void;
};

export function WeddingDayActionBar({
  variant,
  preview = false,
  now,
  event: eventOverride,
  onSchedule,
  onRsvp,
  onOpenChange
}: WeddingDayActionBarProps) {
  const { event: publishedEvent } = usePublishedInvitationContent();
  const event = eventOverride ?? publishedEvent;
  const [clock, setClock] = useState(() => new Date());
  const effectiveNow = preview ? getWeddingDayPreviewNow(event) : now ?? clock;
  const status = getWeddingDayStatus(event, effectiveNow);
  const [directionsOpen, setDirectionsOpen] = useState(false);

  useEffect(() => {
    if (preview || now) return;
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [now, preview]);

  if (!status) return null;

  const links = buildDirectionsLinks(event.venue);
  const setDirectionsVisibility = (open: boolean) => {
    setDirectionsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <>
      <nav
        className={`wedding-day-action-bar wedding-day-action-bar--${variant}`}
        aria-label={`예식 당일 바로가기: ${status.headline}`}
        onClick={(eventInput) => eventInput.stopPropagation()}
        onPointerDown={(eventInput) => eventInput.stopPropagation()}
      >
        <button type="button" onClick={() => setDirectionsVisibility(true)}>
          <MapPinned aria-hidden="true" />
          <span>지도</span>
        </button>
        <button type="button" onClick={() => setDirectionsVisibility(true)}>
          <Car aria-hidden="true" />
          <span>주차</span>
        </button>
        {links.telephone ? (
          <a
            href={links.telephone}
            aria-label={`${event.venue.name}에 전화하기`}
            onClick={() => trackInvitationAnalytics("call_click", "venue")}
          >
            <Phone aria-hidden="true" />
            <span>전화</span>
          </a>
        ) : null}
        <button type="button" onClick={onSchedule}>
          <CalendarClock aria-hidden="true" />
          <span>일정</span>
        </button>
        <button type="button" onClick={onRsvp}>
          <MessageCircleHeart aria-hidden="true" />
          <span>참석</span>
        </button>
      </nav>
      {directionsOpen ? <DirectionsSheet onClose={() => setDirectionsVisibility(false)} /> : null}
    </>
  );
}
