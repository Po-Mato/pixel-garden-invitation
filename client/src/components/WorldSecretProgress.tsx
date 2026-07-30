import { Award, Search, Sparkles } from "lucide-react";
import type { WorldPropInteraction } from "../game/worldPropInteractions";
import {
  worldSecretAchievements,
  type WorldSecretCollection
} from "../game/worldSecretCollection";

type WorldSecretProgressProps = {
  collection: WorldSecretCollection;
  totalCount: number;
  currentHint?: Pick<WorldPropInteraction, "secretHint"> | null;
};

export function WorldSecretProgress({ collection, totalCount, currentHint = null }: WorldSecretProgressProps) {
  const nextAchievement = worldSecretAchievements.find(({ id }) => (
    !collection.unlockedAchievementIds.includes(id)
  ));
  return (
    <section className="world-secret-progress" aria-label="숨은 추억 수집 현황">
      <header>
        <span><Search aria-hidden="true" /> 숨은 추억</span>
        <strong>{collection.discoveredIds.length}/{totalCount}</strong>
      </header>
      <div className="world-secret-progress__meter" aria-hidden="true">
        <i style={{ width: `${Math.min(100, collection.discoveredIds.length / Math.max(1, totalCount) * 100)}%` }} />
      </div>
      <p>
        {currentHint ? <><Sparkles aria-hidden="true" /> {currentHint.secretHint}</> : nextAchievement
          ? <><Award aria-hidden="true" /> 다음 업적 · {nextAchievement.label} {nextAchievement.requirement}개</>
          : <><Award aria-hidden="true" /> 모든 숨은 추억을 발견했어요</>}
      </p>
    </section>
  );
}
