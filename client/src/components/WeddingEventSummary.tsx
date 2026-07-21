import { useState } from "react";
import { CalendarDays, CalendarPlus, Copy, MapPin, Navigation } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import {
  formatEventDate,
  formatEventEndTime,
  formatEventStartTime,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { CalendarSaveSheet } from "./CalendarSaveSheet";
import { DirectionsSheet } from "./DirectionsSheet";
import { WeddingDayQuickAccess } from "./WeddingDayQuickAccess";

type WeddingEventSummaryProps = {
  variant: "compact" | "detail";
  weddingDayPreview?: boolean;
  onCalendarSheetOpenChange?: (open: boolean) => void;
  onDirectionsSheetOpenChange?: (open: boolean) => void;
  onWeddingDaySheetOpenChange?: (open: boolean) => void;
  onFamilyContactOpen?: () => void;
};

export function WeddingEventSummary({
  variant,
  weddingDayPreview = false,
  onCalendarSheetOpenChange,
  onDirectionsSheetOpenChange,
  onWeddingDaySheetOpenChange,
  onFamilyContactOpen
}: WeddingEventSummaryProps) {
  const event = invitationContent.event;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [addressStatus, setAddressStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const setCalendarVisibility = (open: boolean) => {
    setCalendarOpen(open);
    onCalendarSheetOpenChange?.(open);
  };

  const setDirectionsVisibility = (open: boolean) => {
    setDirectionsOpen(open);
    onDirectionsSheetOpenChange?.(open);
  };

  const copyAddress = async () => {
    if (addressStatus === "copying") return;

    setAddressStatus("copying");

    try {
      await copyText(event.venue.address);
      setAddressStatus("copied");
    } catch {
      setAddressStatus("error");
    }
  };

  return (
    <section
      className={`wedding-event-summary wedding-event-summary--${variant}`}
      aria-label="예식 일정과 장소"
    >
      <div className="wedding-event-summary__date">
        <CalendarDays aria-hidden="true" />
        <div>
          <time dateTime={event.startAt}>{formatEventDate(event)}</time>
          <strong>
            <time dateTime={event.startAt}>{formatEventStartTime(event)}</time>
            {variant === "detail" ? (
              <>
                {" - "}
                <time dateTime={event.endAt}>{formatEventEndTime(event)}</time>
              </>
            ) : null}
          </strong>
        </div>
      </div>
      <div className="wedding-event-summary__venue">
        <MapPin aria-hidden="true" />
        <div>
          <strong>{formatVenueLabel(event)}</strong>
          {variant === "detail" ? <span>{event.venue.address}</span> : null}
        </div>
        {variant === "detail" ? (
          <button
            type="button"
            className="icon-button"
            aria-label="주소 복사"
            title="주소 복사"
            disabled={addressStatus === "copying"}
            onClick={copyAddress}
          >
            <Copy aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="wedding-event-summary__actions">
        <button
          type="button"
          className="wedding-event-summary__directions"
          onClick={() => setDirectionsVisibility(true)}
        >
          <Navigation aria-hidden="true" />
          오시는 길
        </button>
        <button
          type="button"
          className="wedding-event-summary__calendar"
          onClick={() => setCalendarVisibility(true)}
        >
          <CalendarPlus aria-hidden="true" />
          캘린더 저장
        </button>
        <WeddingDayQuickAccess
          variant="summary"
          preview={weddingDayPreview}
          onOpenChange={onWeddingDaySheetOpenChange}
          onFamilyContactOpen={onFamilyContactOpen}
        />
      </div>
      <p className="wedding-event-summary__status" aria-live="polite">
        {addressStatus === "copied" ? "주소를 복사했습니다." : null}
        {addressStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
      </p>
      {directionsOpen ? <DirectionsSheet onClose={() => setDirectionsVisibility(false)} /> : null}
      {calendarOpen ? <CalendarSaveSheet onClose={() => setCalendarVisibility(false)} /> : null}
    </section>
  );
}
