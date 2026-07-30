import { BookOpen, Check, LockKeyhole, MapPin } from "lucide-react";
import type { WorldZoneId } from "@wedding-game/shared";
import { gardenWorld, getWorldZone } from "../game/world";
import type { WorldSecretCollection } from "../game/worldSecretCollection";
import { worldSecretCatalog } from "../game/worldPropInteractions";

type WorldSecretCollectionBookProps = {
  collection: WorldSecretCollection;
  activeZoneId: WorldZoneId;
  disabled?: boolean;
  onSelectZone: (zoneId: WorldZoneId) => void;
};

export function WorldSecretCollectionBook({
  collection,
  activeZoneId,
  disabled = false,
  onSelectZone
}: WorldSecretCollectionBookProps) {
  const discovered = new Set(collection.discoveredIds);
  return (
    <details className="world-secret-book">
      <summary>
        <span><BookOpen aria-hidden="true" /><strong>숨은 추억 컬렉션북</strong><small>발견 기록과 장소 보기</small></span>
        <em>{collection.discoveredIds.length}/{worldSecretCatalog.length}</em>
      </summary>
      <ol aria-label="숨은 추억 목록">
        {worldSecretCatalog.map((entry, index) => {
          const found = discovered.has(entry.secretId);
          const zone = getWorldZone(gardenWorld, entry.zoneId);
          return (
            <li key={entry.secretId} data-found={found || undefined}>
              <button
                type="button"
                disabled={disabled || entry.zoneId === activeZoneId}
                aria-label={`${index + 1}번 ${found ? entry.secretLabel : "미발견 추억"}, ${zone.label}${entry.zoneId === activeZoneId ? ", 현재 위치" : "로 이동"}`}
                onClick={() => onSelectZone(entry.zoneId)}
              >
                <span aria-hidden="true">{found ? <Check /> : <LockKeyhole />}</span>
                <strong>{found ? entry.secretLabel : "미발견 추억"}</strong>
                <small><MapPin aria-hidden="true" />{zone.label}</small>
                <p>{found ? entry.resultMessage : entry.secretHint}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
