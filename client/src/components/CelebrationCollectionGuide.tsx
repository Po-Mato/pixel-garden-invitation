import { useState } from "react";
import { Check, Eye, Flower2, Gift, LockKeyhole, MapPinned, Navigation, Sparkles, X } from "lucide-react";
import type { CharacterAppearance, WorldZoneId } from "@wedding-game/shared";
import type { CelebrationCollectible } from "../game/celebrationCollectibles";
import { celebrationZoneProgress } from "../game/celebrationCollectionGuide";
import {
  celebrationKindRewardProgress,
  celebrationSetRewardProgress,
  type CelebrationCosmeticId
} from "../game/celebrationReward";
import { gardenWorld } from "../game/world";
import { CharacterSprite } from "./CharacterSprite";

type CelebrationCollectionGuideProps = {
  items: readonly CelebrationCollectible[];
  collectedIds: readonly string[];
  currentZoneId: WorldZoneId;
  guidedItemId: string | null;
  onGuide: (item: CelebrationCollectible) => void;
  equippedCosmetic: CelebrationCosmeticId;
  onEquipCosmetic: (cosmeticId: CelebrationCosmeticId) => void;
  appearance: CharacterAppearance;
  onClose: () => void;
};

export function CelebrationCollectionGuide({
  items,
  collectedIds,
  currentZoneId,
  guidedItemId,
  onGuide,
  equippedCosmetic,
  onEquipCosmetic,
  appearance,
  onClose
}: CelebrationCollectionGuideProps) {
  const collected = new Set(collectedIds);
  const progress = celebrationZoneProgress(gardenWorld.zones, items, collectedIds);
  const currentItems = items.filter(({ zoneId }) => zoneId === currentZoneId);
  const nextItem = items.find(({ id }) => !collected.has(id)) ?? null;
  const rewards = celebrationKindRewardProgress(collectedIds, items);
  const setReward = celebrationSetRewardProgress(collectedIds, items);
  const rewardIcons = { petal: Flower2, ribbon: Gift, star: Sparkles } as const;
  const [previewCosmetic, setPreviewCosmetic] = useState<CelebrationCosmeticId>(equippedCosmetic);
  const previewLabel = previewCosmetic === "none"
    ? "기본 모습"
    : rewards.find(({ cosmeticId }) => cosmeticId === previewCosmetic)?.label ?? setReward.label;

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
      <section className="celebration-collection-guide__rewards" aria-labelledby="celebration-reward-catalog-title">
        <h3 id="celebration-reward-catalog-title"><Gift aria-hidden="true" />수집 보상 도감</h3>
        <div
          className="celebration-collection-guide__cosmetic-preview"
          data-collection-cosmetic={previewCosmetic}
          aria-label={`${previewLabel} 캐릭터 미리보기`}
        >
          <span><CharacterSprite appearance={appearance} direction="down" moving={false} displayMode="preview" /></span>
          <div><small>실시간 미리보기</small><strong>{previewLabel}</strong><span>게임 캐릭터에 적용될 모습을 먼저 확인하세요.</span></div>
        </div>
        <div>
          {rewards.map((reward) => {
            const Icon = rewardIcons[reward.kind];
            const equipped = equippedCosmetic === reward.cosmeticId;
            return (
              <article key={reward.kind} data-unlocked={reward.unlocked || undefined} data-equipped={equipped || undefined}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{reward.label}</strong>
                  <small>{reward.collectedCount}/{reward.totalCount} · {reward.detail}</small>
                </span>
                <div>
                  <button
                    type="button"
                    aria-label={`${reward.label} 미리보기`}
                    disabled={!reward.unlocked}
                    onClick={() => setPreviewCosmetic(reward.cosmeticId)}
                  ><Eye aria-hidden="true" /></button>
                  <button
                    type="button"
                    disabled={!reward.unlocked}
                    aria-pressed={equipped}
                    onClick={() => {
                      const cosmetic = equipped ? "none" : reward.cosmeticId;
                      setPreviewCosmetic(cosmetic);
                      onEquipCosmetic(cosmetic);
                    }}
                  >
                    {!reward.unlocked ? <LockKeyhole aria-hidden="true" /> : equipped ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                    {!reward.unlocked ? "잠김" : equipped ? "착용 중" : "착용"}
                  </button>
                </div>
              </article>
            );
          })}
          <article data-unlocked={setReward.unlocked || undefined} data-equipped={equippedCosmetic === setReward.cosmeticId || undefined} data-set-bonus="true">
            <Sparkles aria-hidden="true" />
            <span>
              <strong>{setReward.label}</strong>
              <small>{setReward.completedCount}/{setReward.totalCount} 세트 · {setReward.detail}</small>
            </span>
            <div>
              <button
                type="button"
                aria-label={`${setReward.label} 미리보기`}
                disabled={!setReward.unlocked}
                onClick={() => setPreviewCosmetic(setReward.cosmeticId)}
              ><Eye aria-hidden="true" /></button>
              <button
                type="button"
                disabled={!setReward.unlocked}
                aria-pressed={equippedCosmetic === setReward.cosmeticId}
                onClick={() => {
                  const cosmetic = equippedCosmetic === setReward.cosmeticId ? "none" : setReward.cosmeticId;
                  setPreviewCosmetic(cosmetic);
                  onEquipCosmetic(cosmetic);
                }}
              >
                {!setReward.unlocked ? <LockKeyhole aria-hidden="true" /> : equippedCosmetic === setReward.cosmeticId ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {!setReward.unlocked ? "잠김" : equippedCosmetic === setReward.cosmeticId ? "착용 중" : "착용"}
              </button>
            </div>
          </article>
        </div>
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
