import { useState, type RefObject } from "react";
import { Car, Check, Copy, ExternalLink, MapPinned, Phone, TrainFront } from "lucide-react";
import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import { buildDirectionsLinks } from "../invitation/directions";
import { BottomSheet } from "./BottomSheet";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";

type DirectionsSheetProps = {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type DirectionsContentProps = {
  venue?: WeddingEvent["venue"];
};

type CopyStatus = "idle" | "copying" | "copied" | "error";

export function DirectionsContent({ venue = invitationContent.event.venue }: DirectionsContentProps) {
  const links = buildDirectionsLinks(venue);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const mapLinks = [
    ["네이버지도", links.naver, "naver", true],
    ["카카오맵", links.kakao, "kakao", false],
    ["Google 지도", links.google, "google", false]
  ] as const;

  const copyAddress = async () => {
    if (copyStatus === "copying") {
      return;
    }

    setCopyStatus("copying");

    try {
      await copyText(venue.address);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <div className="directions-sheet">
      <section className="directions-sheet__venue">
        <MapPinned aria-hidden="true" />
        <div>
          <strong>
            {venue.name} {venue.hall}
          </strong>
          <span>{venue.address}</span>
        </div>
        <button
          type="button"
          aria-label="주소 복사"
          data-status={copyStatus === "copied" ? "copied" : undefined}
          disabled={copyStatus === "copying"}
          onClick={copyAddress}
        >
          {copyStatus === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copyStatus === "copying" ? "복사 중" : copyStatus === "copied" ? "복사됨" : "복사"}</span>
        </button>
      </section>

      <p
        className="directions-sheet__status"
        data-status={copyStatus === "error" ? "error" : copyStatus === "copied" ? "copied" : undefined}
        aria-live="polite"
      >
        {copyStatus === "copied" ? "주소를 복사했습니다." : null}
        {copyStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
      </p>

      <section className="directions-sheet__route-actions" aria-labelledby="directions-map-title">
        <header>
          <h3 id="directions-map-title">지도 앱으로 길 찾기</h3>
          <span>원하는 앱을 선택하세요</span>
        </header>
        <div className="directions-sheet__maps">
          {mapLinks.map(([label, href, provider, preferred]) =>
            href ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-primary={preferred || undefined}
                onClick={() => trackInvitationAnalytics("map_click", provider)}
              >
                <ExternalLink aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  {preferred ? <small>추천</small> : null}
                </span>
              </a>
            ) : (
              <button key={label} type="button" data-primary={preferred || undefined} disabled>
                <ExternalLink aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  {preferred ? <small>추천</small> : null}
                </span>
              </button>
            )
          )}
        </div>
      </section>

      <section className="directions-sheet__travel-notes" aria-labelledby="directions-travel-title">
        <h3 id="directions-travel-title">교통 안내</h3>
        <section className="directions-sheet__info">
          <TrainFront aria-hidden="true" />
          <div>
            <strong>대중교통</strong>
            <span>{venue.directions.transit}</span>
          </div>
        </section>

        <section className="directions-sheet__info">
          <Car aria-hidden="true" />
          <div>
            <strong>자가용·주차</strong>
            <span>{venue.directions.parking}</span>
          </div>
        </section>
      </section>

      <section className="directions-sheet__phone">
        <Phone aria-hidden="true" />
        <strong>{venue.directions.phone}</strong>
        {links.telephone ? (
          <a
            href={links.telephone}
            aria-label={`${venue.directions.phone} 전화하기`}
            onClick={() => trackInvitationAnalytics("call_click", "venue")}
          >
            전화
          </a>
        ) : null}
      </section>
    </div>
  );
}

export function DirectionsSheet({ onClose, returnFocusRef }: DirectionsSheetProps) {
  return (
    <BottomSheet title="오시는 길" onClose={onClose} returnFocusRef={returnFocusRef}>
      <DirectionsContent />
    </BottomSheet>
  );
}
