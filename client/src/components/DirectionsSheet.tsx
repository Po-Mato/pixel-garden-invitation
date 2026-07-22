import { useState } from "react";
import { Car, Copy, ExternalLink, MapPinned, Phone, TrainFront } from "lucide-react";
import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import { buildDirectionsLinks } from "../invitation/directions";
import { BottomSheet } from "./BottomSheet";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";

type DirectionsSheetProps = {
  onClose: () => void;
};

type DirectionsContentProps = {
  venue?: WeddingEvent["venue"];
};

type CopyStatus = "idle" | "copying" | "copied" | "error";

export function DirectionsContent({ venue = invitationContent.event.venue }: DirectionsContentProps) {
  const links = buildDirectionsLinks(venue);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const mapLinks = [
    ["네이버지도", links.naver, "naver"],
    ["카카오맵", links.kakao, "kakao"],
    ["Google 지도", links.google, "google"]
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
          disabled={copyStatus === "copying"}
          onClick={copyAddress}
        >
          <Copy aria-hidden="true" />
        </button>
      </section>

      <div className="directions-sheet__maps">
        {mapLinks.map(([label, href, provider]) =>
          href ? (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInvitationAnalytics("map_click", provider)}
            >
              <ExternalLink aria-hidden="true" />
              {label}
            </a>
          ) : (
            <button key={label} type="button" disabled>
              <ExternalLink aria-hidden="true" />
              {label}
            </button>
          )
        )}
      </div>

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

      <p className="directions-sheet__status" aria-live="polite">
        {copyStatus === "copied" ? "주소를 복사했습니다." : null}
        {copyStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
      </p>
    </div>
  );
}

export function DirectionsSheet({ onClose }: DirectionsSheetProps) {
  return (
    <BottomSheet title="오시는 길" onClose={onClose}>
      <DirectionsContent />
    </BottomSheet>
  );
}
