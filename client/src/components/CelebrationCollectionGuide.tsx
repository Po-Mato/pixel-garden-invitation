import { useEffect, useState } from "react";
import { BookmarkPlus, Check, Eye, Flower2, Gift, LockKeyhole, MapPinned, Navigation, Palette, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import type { CharacterAppearance, WorldZoneId } from "@wedding-game/shared";
import type { CelebrationCollectible } from "../game/celebrationCollectibles";
import { celebrationZoneProgress } from "../game/celebrationCollectionGuide";
import {
  celebrationKindRewardProgress,
  celebrationCosmeticRecommendation,
  createCelebrationCosmeticFavorite,
  celebrationCosmeticToneLabels,
  celebrationCosmeticTones,
  loadCelebrationCosmeticFavorites,
  saveCelebrationCosmeticFavorites,
  celebrationSetRewardProgress,
  type CelebrationCosmeticId,
  type CelebrationCosmeticTone
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
  equippedTone: CelebrationCosmeticTone;
  onEquipCosmetic: (cosmeticId: CelebrationCosmeticId) => void;
  onChangeTone: (tone: CelebrationCosmeticTone) => void;
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
  equippedTone,
  onEquipCosmetic,
  onChangeTone,
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
  const [previewTone, setPreviewTone] = useState<CelebrationCosmeticTone>(equippedTone);
  const [favoriteLooks, setFavoriteLooks] = useState(loadCelebrationCosmeticFavorites);
  const recommendation = celebrationCosmeticRecommendation(appearance, collectedIds, items);
  const previewLabel = previewCosmetic === "none"
    ? "기본 모습"
    : rewards.find(({ cosmeticId }) => cosmeticId === previewCosmetic)?.label ?? setReward.label;
  const favoriteExists = favoriteLooks.some(({ cosmeticId, tone }) => (
    cosmeticId === previewCosmetic && tone === previewTone
  ));

  useEffect(() => {
    saveCelebrationCosmeticFavorites(favoriteLooks);
  }, [favoriteLooks]);

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
          data-collection-tone={previewTone}
          aria-label={`${previewLabel} 캐릭터 미리보기`}
        >
          <span><CharacterSprite appearance={appearance} direction="down" moving={false} displayMode="preview" /></span>
          <div><small>실시간 미리보기</small><strong>{previewLabel}</strong><span>게임 캐릭터에 적용될 모습을 먼저 확인하세요.</span></div>
        </div>
        <section className="celebration-collection-guide__recommendation" aria-label="의상별 꾸미기 추천">
          <WandSparkles aria-hidden="true" />
          <span>
            <small>현재 의상 추천</small>
            <strong>{recommendation.cosmeticLabel} · {recommendation.toneLabel}</strong>
            <span>{recommendation.detail}</span>
          </span>
          <button
            type="button"
            disabled={recommendation.cosmeticId === "none"}
            onClick={() => {
              setPreviewCosmetic(recommendation.cosmeticId);
              setPreviewTone(recommendation.tone);
              onChangeTone(recommendation.tone);
              onEquipCosmetic(recommendation.cosmeticId);
            }}
          >추천 적용</button>
        </section>
        <fieldset className="celebration-collection-guide__tones">
          <legend><Palette aria-hidden="true" />효과 색상 조합</legend>
          <div>
            {celebrationCosmeticTones.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`${celebrationCosmeticToneLabels[tone]} 효과 색상`}
                aria-pressed={previewTone === tone}
                data-tone={tone}
                onClick={() => {
                  setPreviewTone(tone);
                  onChangeTone(tone);
                }}
              ><span aria-hidden="true" />{celebrationCosmeticToneLabels[tone]}{recommendation.tone === tone ? <small>추천</small> : null}</button>
            ))}
          </div>
        </fieldset>
        <section className="celebration-collection-guide__favorites" aria-label="꾸미기 조합 즐겨찾기">
          <header>
            <span><BookmarkPlus aria-hidden="true" /><strong>즐겨찾는 조합</strong></span>
            <button
              type="button"
              disabled={favoriteExists || favoriteLooks.length >= 3}
              onClick={() => setFavoriteLooks((current) => [
                ...current,
                createCelebrationCosmeticFavorite(previewCosmetic, previewTone)
              ])}
            >{favoriteExists ? "저장됨" : favoriteLooks.length >= 3 ? "최대 3개" : "현재 조합 저장"}</button>
          </header>
          {favoriteLooks.length > 0 ? (
            <div>
              {favoriteLooks.map((favorite, index) => {
                const cosmeticLabel = favorite.cosmeticId === "none"
                  ? "기본 모습"
                  : rewards.find(({ cosmeticId }) => cosmeticId === favorite.cosmeticId)?.label ?? setReward.label;
                return (
                  <span key={favorite.id}>
                    <button
                      type="button"
                      aria-label={`즐겨찾기 ${index + 1} ${cosmeticLabel} ${celebrationCosmeticToneLabels[favorite.tone]} 적용`}
                      onClick={() => {
                        setPreviewCosmetic(favorite.cosmeticId);
                        setPreviewTone(favorite.tone);
                        onChangeTone(favorite.tone);
                        onEquipCosmetic(favorite.cosmeticId);
                      }}
                    ><Sparkles aria-hidden="true" /><strong>{cosmeticLabel}</strong><small>{celebrationCosmeticToneLabels[favorite.tone]}</small></button>
                    <button
                      type="button"
                      aria-label={`즐겨찾기 ${index + 1} 삭제`}
                      onClick={() => setFavoriteLooks((current) => current.filter(({ id }) => id !== favorite.id))}
                    ><Trash2 aria-hidden="true" /></button>
                  </span>
                );
              })}
            </div>
          ) : <p>자주 쓰는 효과와 색상을 한 번에 다시 적용할 수 있어요.</p>}
        </section>
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
