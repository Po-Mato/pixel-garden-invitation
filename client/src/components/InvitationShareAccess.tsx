import { useState } from "react";
import { CalendarDays, Copy, MapPin, Send, Share2 } from "lucide-react";
import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import {
  copyText,
  isShareAbortError,
  shareContent
} from "../invitation/browserActions";
import {
  formatEventDate,
  formatEventStartTime,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { formatCoupleNames, formatWeddingTitle } from "../invitation/coupleOrder";
import {
  buildInvitationShareData,
  invitationPublicUrl
} from "../invitation/shareInvitation";
import { BottomSheet } from "./BottomSheet";

type InvitationShareAccessProps = {
  variant: "icon" | "menu";
  event?: WeddingEvent;
  onOpenChange?: (open: boolean) => void;
};

type ShareStatus = "idle" | "sharing" | "shared" | "copied" | "fallback" | "canceled" | "error";

function canonicalShareUrl() {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? invitationPublicUrl;
}

function statusMessage(status: ShareStatus) {
  if (status === "sharing") return "공유 앱을 열고 있습니다.";
  if (status === "shared") return "공유 앱으로 초대장을 전달했습니다.";
  if (status === "copied") return "초대장 링크를 복사했습니다.";
  if (status === "fallback") return "공유창을 열지 못해 초대장 링크를 복사했습니다.";
  if (status === "canceled") return "공유를 취소했습니다.";
  if (status === "error") return "공유하거나 링크를 복사하지 못했습니다. 잠시 후 다시 시도해주세요.";
  return "";
}

export function InvitationShareAccess({
  variant,
  event = invitationContent.event,
  onOpenChange
}: InvitationShareAccessProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const coupleOrder = useCoupleOrder();
  const nativeShareSupported = typeof navigator.share === "function";
  const busy = status === "sharing";
  const data = buildInvitationShareData(event, canonicalShareUrl(), coupleOrder);

  const setVisibility = (visible: boolean) => {
    setOpen(visible);
    if (visible) setStatus("idle");
    onOpenChange?.(visible);
  };

  const copyLink = async (fallback = false) => {
    try {
      await copyText(data.url ?? invitationPublicUrl);
      setStatus(fallback ? "fallback" : "copied");
    } catch {
      setStatus("error");
    }
  };

  const openNativeShare = async () => {
    if (busy) return;
    setStatus("sharing");

    try {
      await shareContent(data);
      setStatus("shared");
    } catch (error) {
      if (isShareAbortError(error)) {
        setStatus("canceled");
        return;
      }
      await copyLink(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`invitation-share-trigger invitation-share-trigger--${variant}`}
        aria-label={variant === "icon" ? "초대장 공유" : undefined}
        title={variant === "icon" ? "초대장 공유" : undefined}
        onClick={() => setVisibility(true)}
      >
        <Share2 aria-hidden="true" />
        {variant === "menu" ? "초대장 공유" : null}
      </button>

      {open ? (
        <BottomSheet title="초대장 공유" onClose={() => setVisibility(false)}>
          <div className="invitation-share-sheet">
            <section className="invitation-share-sheet__preview">
              <span>WEDDING INVITATION</span>
              <strong>{formatCoupleNames(event, coupleOrder)}</strong>
              <p>{formatWeddingTitle(event, coupleOrder)}</p>
            </section>

            <section className="invitation-share-sheet__detail">
              <CalendarDays aria-hidden="true" />
              <div>
                <strong>{formatEventDate(event)}</strong>
                <span>{formatEventStartTime(event)}</span>
              </div>
            </section>
            <section className="invitation-share-sheet__detail">
              <MapPin aria-hidden="true" />
              <div>
                <strong>{formatVenueLabel(event)}</strong>
                <span>{event.venue.address}</span>
              </div>
            </section>

            <div className="invitation-share-sheet__actions">
              <button type="button" disabled={busy} onClick={() => void openNativeShare()}>
                <Send aria-hidden="true" />
                {nativeShareSupported ? "공유 앱 선택" : "링크 복사로 공유"}
              </button>
              <button type="button" disabled={busy} onClick={() => void copyLink()}>
                <Copy aria-hidden="true" />
                링크 복사
              </button>
            </div>

            <p className="invitation-share-sheet__status" aria-live="polite">
              {statusMessage(status)}
            </p>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
