import { useState } from "react";
import { CalendarPlus, Copy, ExternalLink } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { copyText, downloadIcs } from "../invitation/browserActions";
import { buildEventCopyText, buildGoogleCalendarUrl, buildIcs } from "../invitation/calendarEvent";
import { BottomSheet } from "./BottomSheet";

type CalendarSaveSheetProps = {
  onClose: () => void;
};

type ActionStatus = "idle" | "downloading" | "copying" | "copied" | "copy-error" | "download-error";

export function CalendarSaveSheet({ onClose }: CalendarSaveSheetProps) {
  const event = invitationContent.event;
  const eventText = buildEventCopyText(event);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const busy = status === "downloading" || status === "copying";

  const copyEvent = async () => {
    if (busy) return;

    setStatus("copying");

    try {
      await copyText(eventText);
      setStatus("copied");
    } catch {
      setStatus("copy-error");
    }
  };

  const saveNative = () => {
    if (busy) return;

    setStatus("downloading");

    try {
      downloadIcs(buildIcs(event));
      setStatus("idle");
    } catch {
      setStatus("download-error");
    }
  };

  return (
    <BottomSheet title="캘린더 저장" onClose={onClose}>
      <div className="calendar-save-options">
        <button type="button" onClick={saveNative} disabled={busy}>
          <CalendarPlus aria-hidden="true" />
          <span>기본 캘린더에 저장</span>
        </button>
        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          aria-label="Google 캘린더에서 열기"
        >
          <ExternalLink aria-hidden="true" />
          <span>Google 캘린더</span>
        </a>
        <button type="button" onClick={copyEvent} disabled={busy}>
          <Copy aria-hidden="true" />
          <span>일정 내용 복사</span>
        </button>
      </div>
      <p className="calendar-save-preview">{eventText}</p>
      <p className="calendar-action-status" aria-live="polite">
        {status === "copied" ? "일정을 복사했습니다." : null}
        {status === "copy-error" ? "복사하지 못했습니다. 내용을 길게 눌러 복사해주세요." : null}
        {status === "download-error" ? "캘린더 파일을 만들지 못했습니다. 다시 시도해주세요." : null}
      </p>
    </BottomSheet>
  );
}
