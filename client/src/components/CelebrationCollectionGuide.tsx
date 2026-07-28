import { Flower2, MapPinned, Navigation, X } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import type { CelebrationCollectible } from "../game/celebrationCollectibles";
import { celebrationZoneProgress } from "../game/celebrationCollectionGuide";
import { gardenWorld } from "../game/world";

type CelebrationCollectionGuideProps = {
  items: readonly CelebrationCollectible[];
  collectedIds: readonly string[];
  currentZoneId: WorldZoneId;
  guidedItemId: string | null;
  onGuide: (item: CelebrationCollectible) => void;
  onClose: () => void;
};

export function CelebrationCollectionGuide({
  items,
  collectedIds,
  currentZoneId,
  guidedItemId,
  onGuide,
  onClose
}: CelebrationCollectionGuideProps) {
  const collected = new Set(collectedIds);
  const progress = celebrationZoneProgress(gardenWorld.zones, items, collectedIds);
  const currentItems = items.filter(({ zoneId }) => zoneId === currentZoneId);
  const nextItem = items.find(({ id }) => !collected.has(id)) ?? null;

  return (
    <div className="celebration-collection-guide" role="dialog" aria-modal="true" aria-label="축하 아이템 수집 지도">
      <header>
        <div><small>COLLECTION MAP</small><h2>축하 아이템 수집 지도</h2></div>
        <button type="button" aria-label="수집 지도 닫기" onClick={onClose}><X /></button>
      </header>
      <section className="celebration-collection-guide__zones" aria-label="맵별 수집 현황">
        {progress.map((zone) => (
          <span key={zone.zoneId} data-current={zone.zoneId === currentZoneId || undefined} data-complete={zone.complete || undefined}>
            <strong>{zone.label}</strong><small>{zone.collectedCount}/{zone.totalCount}</small>
          </span>
        ))}
      </section>
      <section className="celebration-collection-guide__current">
        <h3><MapPinned aria-hidden="true" />현재 구역 아이템</h3>
        <div>
          {currentItems.map((item) => {
            const complete = collected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={complete}
                data-guided={item.id === guidedItemId || undefined}
                onClick={() => onGuide(item)}
              >
                <Flower2 aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{complete ? "수집 완료" : item.id === guidedItemId ? "안내 중" : "위치 안내"}</small></span>
                {!complete ? <Navigation aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>
      {currentItems.every(({ id }) => collected.has(id)) && nextItem ? (
        <button type="button" className="celebration-collection-guide__next" onClick={() => onGuide(nextItem)}>
          <Navigation aria-hidden="true" />
          <span>현재 구역은 완료했어요. <strong>{gardenWorld.zones.find(({ id }) => id === nextItem.zoneId)?.label}</strong>의 다음 아이템으로 안내합니다.</span>
        </button>
      ) : null}
    </div>
  );
}
