import { useState, type RefObject } from "react";
import { AlertCircle, Car, Check, CheckCircle2, Copy, Globe2, Map, MapPinned, Navigation, Phone, TrainFront } from "lucide-react";
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
    { label: "네이버지도", eyebrow: "NAVER MAP", helper: "추천 경로", href: links.naver, provider: "naver", preferred: true, Icon: Navigation },
    { label: "카카오맵", eyebrow: "KAKAO MAP", helper: "카카오맵으로 열기", href: links.kakao, provider: "kakao", preferred: false, Icon: Map },
    { label: "Google 지도", eyebrow: "GOOGLE MAP", helper: "Google 지도로 열기", href: links.google, provider: "google", preferred: false, Icon: Globe2 }
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
          aria-describedby={copyStatus === "copied" || copyStatus === "error" ? "directions-copy-feedback" : undefined}
          data-status={copyStatus === "copied" ? "copied" : undefined}
          disabled={copyStatus === "copying"}
          onClick={copyAddress}
        >
          {copyStatus === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copyStatus === "copying" ? "복사 중" : copyStatus === "copied" ? "복사 완료" : "주소 복사"}</span>
        </button>
      </section>

      {copyStatus === "copied" || copyStatus === "error" ? (
        <div
          id="directions-copy-feedback"
          className="directions-sheet__copy-feedback"
          data-status={copyStatus}
          role={copyStatus === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {copyStatus === "copied" ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
          <span>
            <strong>{copyStatus === "copied" ? "주소 복사를 완료했어요" : "주소를 복사하지 못했어요"}</strong>
            <small>
              {copyStatus === "copied"
                ? "지도 앱 검색창에 바로 붙여넣을 수 있습니다."
                : "위 주소를 길게 눌러 직접 복사해주세요."}
            </small>
          </span>
        </div>
      ) : null}

      <section className="directions-sheet__route-actions" aria-labelledby="directions-map-title">
        <header>
          <h3 id="directions-map-title">지도 앱으로 길 찾기</h3>
          <span>원하는 앱을 선택하세요</span>
        </header>
        <div className="directions-sheet__maps">
          {mapLinks.map(({ label, eyebrow, helper, href, provider, preferred, Icon }) =>
            href ? (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                data-provider={provider}
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
                  <small>{eyebrow}</small>
                  <strong>{label}</strong>
                  <em>{selectedMapProvider === provider ? "지금 연 앱" : helper}</em>
                </span>
              </a>
            ) : (
              <button
                key={label}
                type="button"
                aria-label={label}
                data-provider={provider}
                data-primary={preferred || undefined}
                disabled
              >
                <span className="directions-sheet__map-icon"><Icon aria-hidden="true" /></span>
                <span>
                  <small>{eyebrow}</small>
                  <strong>{label}</strong>
                  <em>{helper}</em>
                </span>
              </button>
            )
          )}
        </div>
        <div className="directions-sheet__map-status" data-selected={selectedMapProvider || undefined} aria-live="polite">
          <Navigation aria-hidden="true" />
          <span>
            <strong>{selectedMapLabel ? `${selectedMapLabel}을 열었어요` : "지도 앱을 선택해주세요"}</strong>
            <small>{selectedMapLabel ? "새 창에서 경로를 이어서 확인할 수 있습니다." : "선택한 지도 앱은 새 창에서 열립니다."}</small>
          </span>
        </div>
      </section>

      <section className="directions-sheet__travel-notes" aria-labelledby="directions-travel-title">
        <header>
          <span>ARRIVAL GUIDE</span>
          <h3 id="directions-travel-title">교통 안내</h3>
          <p>이동 방법에 맞는 안내를 확인하세요.</p>
        </header>
        <div className="directions-sheet__travel-grid">
          <section className="directions-sheet__info" data-mode="transit">
            <TrainFront aria-hidden="true" />
            <div>
              <small>지하철 · 도보</small>
              <strong>대중교통</strong>
              <span>{venue.directions.transit}</span>
            </div>
          </section>

          <section className="directions-sheet__info" data-mode="parking">
            <Car aria-hidden="true" />
            <div>
              <small>자가용 · 주차</small>
              <strong>주차 안내</strong>
              <span>{venue.directions.parking}</span>
            </div>
          </section>
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
