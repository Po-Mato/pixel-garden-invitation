import { useId, useState, type RefObject } from "react";
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
type TravelMode = "transit" | "parking";

export function DirectionsContent({ venue = invitationContent.event.venue }: DirectionsContentProps) {
  const links = buildDirectionsLinks(venue);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [selectedMapProvider, setSelectedMapProvider] = useState<MapProvider | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("transit");
  const travelPanelId = useId();
  const mapLinks = [
    { label: "네이버지도", eyebrow: "NAVER MAP", helper: "추천 경로", href: links.naver, provider: "naver", preferred: true, Icon: Navigation },
    { label: "카카오맵", eyebrow: "KAKAO MAP", helper: "카카오맵으로 열기", href: links.kakao, provider: "kakao", preferred: false, Icon: Map },
    { label: "Google 지도", eyebrow: "GOOGLE MAP", helper: "Google 지도로 열기", href: links.google, provider: "google", preferred: false, Icon: Globe2 }
  ] as const;
  const travelOptions = [
    {
      mode: "transit",
      eyebrow: "SUBWAY · WALK",
      label: "대중교통",
      helper: "소사역 1번 출구",
      detail: venue.directions.transit,
      Icon: TrainFront
    },
    {
      mode: "parking",
      eyebrow: "CAR · PARKING",
      label: "자가용·주차",
      helper: "주차 정보 확인",
      detail: venue.directions.parking,
      Icon: Car
    }
  ] as const;
  const selectedTravel = travelOptions.find(({ mode }) => mode === travelMode) ?? travelOptions[0];
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
        <div className="directions-sheet__travel-tabs" role="tablist" aria-label="이동 방법 선택">
          {travelOptions.map(({ mode, label, helper, Icon }) => (
            <button
              key={mode}
              id={`${travelPanelId}-${mode}-tab`}
              type="button"
              role="tab"
              aria-selected={travelMode === mode}
              aria-controls={`${travelPanelId}-panel`}
              onClick={() => setTravelMode(mode)}
            >
              <Icon aria-hidden="true" />
              <span><strong>{label}</strong><small>{helper}</small></span>
            </button>
          ))}
        </div>
        <article
          id={`${travelPanelId}-panel`}
          className="directions-sheet__travel-panel directions-sheet__info"
          data-mode={selectedTravel.mode}
          role="tabpanel"
          aria-labelledby={`${travelPanelId}-${selectedTravel.mode}-tab`}
        >
          <selectedTravel.Icon aria-hidden="true" />
          <div>
            <small>{selectedTravel.eyebrow}</small>
            <strong>{selectedTravel.label === "대중교통" ? "지하철에서 예식장까지" : "주차장 이용 안내"}</strong>
            <span>{selectedTravel.detail}</span>
          </div>
        </article>
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
    <BottomSheet
      title="오시는 길"
      eyebrow="LOCATION & ROUTE"
      description="지도 앱과 이동 방법을 한곳에서 확인하세요."
      className="invitation-detail-sheet invitation-detail-sheet--directions"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <DirectionsContent />
    </BottomSheet>
  );
}
