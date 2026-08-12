import { useState, type RefObject } from "react";
import { Car, Check, Copy, Globe2, Map, MapPinned, Navigation, Phone, TrainFront } from "lucide-react";
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
type MapProvider = "naver" | "kakao" | "google";

export function DirectionsContent({ venue = invitationContent.event.venue }: DirectionsContentProps) {
  const links = buildDirectionsLinks(venue);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [selectedMapProvider, setSelectedMapProvider] = useState<MapProvider | null>(null);
  const mapLinks = [
    { label: "네이버지도", href: links.naver, provider: "naver", preferred: true, Icon: Navigation },
    { label: "카카오맵", href: links.kakao, provider: "kakao", preferred: false, Icon: Map },
    { label: "Google 지도", href: links.google, provider: "google", preferred: false, Icon: Globe2 }
  ] as const;
  const selectedMapLabel = mapLinks.find(({ provider }) => provider === selectedMapProvider)?.label;

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
          {mapLinks.map(({ label, href, provider, preferred, Icon }) =>
            href ? (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                data-primary={preferred || undefined}
                data-selected={selectedMapProvider === provider || undefined}
                aria-current={selectedMapProvider === provider ? "true" : undefined}
                onClick={() => {
                  setSelectedMapProvider(provider);
                  trackInvitationAnalytics("map_click", provider);
                }}
              >
                <span className="directions-sheet__map-icon"><Icon aria-hidden="true" /></span>
                <span>
                  <strong>{label}</strong>
                  {selectedMapProvider === provider ? <small>최근 선택</small> : preferred ? <small>추천</small> : null}
                </span>
              </a>
            ) : (
              <button
                key={label}
                type="button"
                aria-label={label}
                data-primary={preferred || undefined}
                disabled
              >
                <span className="directions-sheet__map-icon"><Icon aria-hidden="true" /></span>
                <span>
                  <strong>{label}</strong>
                  {preferred ? <small>추천</small> : null}
                </span>
              </button>
            )
          )}
        </div>
        <p className="directions-sheet__map-status" aria-live="polite">
          {selectedMapLabel ? `${selectedMapLabel} 앱을 새 창에서 열었습니다.` : "선택한 지도 앱은 새 창에서 열립니다."}
        </p>
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
