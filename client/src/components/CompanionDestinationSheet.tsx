import { MapPinned, Navigation, X } from "lucide-react";
import { gardenWorld, getWorldZone, type WorldPortal } from "../game/world";

type CompanionDestinationSheetProps = {
  companionName: string;
  portals: readonly WorldPortal[];
  onSelect: (portal: WorldPortal) => void;
  onClose: () => void;
};

export function CompanionDestinationSheet({ companionName, portals, onSelect, onClose }: CompanionDestinationSheetProps) {
  return (
    <div className="companion-destination-sheet" role="dialog" aria-modal="true" aria-label="동행 공동 목적지 선택">
      <header>
        <div><small>WALK TOGETHER</small><h2>함께 갈 목적지</h2><p>{companionName}님에게 같은 경로를 안내합니다.</p></div>
        <button type="button" aria-label="공동 목적지 닫기" onClick={onClose}><X /></button>
      </header>
      <div>
        {portals.map((portal) => (
          <button key={portal.id} type="button" onClick={() => onSelect(portal)}>
            <MapPinned aria-hidden="true" />
            <span><strong>{getWorldZone(gardenWorld, portal.to).label}</strong><small>{portal.label}에서 함께 이동</small></span>
            <Navigation aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
