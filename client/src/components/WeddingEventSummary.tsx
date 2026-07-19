import { useState } from "react";
import { CalendarDays, CalendarPlus, Copy, MapPin } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import {
  formatEventDate,
  formatEventStartTime,
  formatEventTimeRange,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { CalendarSaveSheet } from "./CalendarSaveSheet";

type WeddingEventSummaryProps = {
  variant: "compact" | "detail";
  onCalendarSheetOpenChange?: (open: boolean) => void;
};

export function WeddingEventSummary({
  variant,
  onCalendarSheetOpenChange
}: WeddingEventSummaryProps) {
  const event = invitationContent.event;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addressStatus, setAddressStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const setCalendarVisibility = (open: boolean) => {
    setCalendarOpen(open);
    onCalendarSheetOpenChange?.(open);
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
          <strong>{variant === "detail" ? formatEventTimeRange(event) : formatEventStartTime(event)}</strong>
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
      <button
        type="button"
        className="wedding-event-summary__calendar"
        onClick={() => setCalendarVisibility(true)}
      >
        <CalendarPlus aria-hidden="true" />
        캘린더 저장
      </button>
      <p className="wedding-event-summary__status" aria-live="polite">
        {addressStatus === "copied" ? "주소를 복사했습니다." : null}
        {addressStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
      </p>
      {calendarOpen ? <CalendarSaveSheet onClose={() => setCalendarVisibility(false)} /> : null}
    </section>
  );
}
