import { Flower2, Gift, Sparkles } from "lucide-react";
import type { CelebrationCollectible } from "../game/celebrationCollectibles";

type WorldCelebrationCollectiblesProps = {
  items: readonly CelebrationCollectible[];
  collectedIds: readonly string[];
  onCollect: (item: CelebrationCollectible) => void;
};

type CelebrationCollectionProgressProps = {
  collectedCount: number;
  totalCount: number;
  onOpenGuide?: () => void;
};

const collectibleIcons = { petal: Flower2, ribbon: Gift, star: Sparkles } as const;

export function WorldCelebrationCollectibles({
  items,
  collectedIds,
  onCollect
}: WorldCelebrationCollectiblesProps) {
  const collected = new Set(collectedIds);
  return (
    <>
      <div className="world-collectibles" aria-label="웨딩 축하 아이템">
        {items.map((item) => {
          const Icon = collectibleIcons[item.kind];
          const complete = collected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className="world-collectible"
              data-kind={item.kind}
              data-collected={complete || undefined}
              aria-label={`${item.label} ${complete ? "수집 완료" : "수집하기"}`}
              disabled={complete}
              style={{ left: item.point.x, top: item.point.y }}
              onClick={(event) => { event.stopPropagation(); onCollect(item); }}
            >
              <Icon aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </>
  );
}

export function CelebrationCollectionProgress({
  collectedCount,
  totalCount,
  onOpenGuide
}: CelebrationCollectionProgressProps) {
  const content = <><Flower2 aria-hidden="true" /><span><strong>{collectedCount}</strong>/{totalCount}</span></>;
  return onOpenGuide ? (
    <button
      type="button"
      className="world-collection-progress"
      data-empty={collectedCount === 0 || undefined}
      aria-label={`축하 아이템 ${collectedCount}/${totalCount}, 수집 지도 열기`}
      onClick={(event) => { event.stopPropagation(); onOpenGuide(); }}
    >{content}</button>
  ) : (
    <div
      className="world-collection-progress"
      data-empty={collectedCount === 0 || undefined}
      aria-label={`축하 아이템 ${collectedCount}/${totalCount}`}
    >{content}</div>
  );
}
