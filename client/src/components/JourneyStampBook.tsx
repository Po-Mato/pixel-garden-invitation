import {
  ArrowRight,
  CalendarHeart,
  Check,
  ChevronDown,
  Eye,
  Flower2,
  Footprints,
  Gift,
  Images,
  LockKeyhole,
  MapPinned,
  MessageCircleHeart,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CharacterAppearance, WorldZoneId } from "@wedding-game/shared";
import {
  journeyCheckpoints,
  journeyCheckpointIds,
  nextJourneyCheckpoint,
  type JourneyCheckpointId,
  type JourneyProgress
} from "../game/journeyProgress";
import {
  isJourneyStampRewardUnlocked,
  journeyStampRewards,
  type JourneyStampRewardId
} from "../game/journeyStampReward";
import { CharacterSprite } from "./CharacterSprite";
import "../journey-stamp-rewards.css";

type JourneyStampBookProps = {
  progress: JourneyProgress;
  syncStatus?: "local" | "syncing" | "synced" | "queued" | "merged" | "error";
  activeZoneId: WorldZoneId;
  highlightedCheckpointId: JourneyCheckpointId | null;
  disabled?: boolean;
  appearance: CharacterAppearance;
  equippedReward: JourneyStampRewardId;
  onOpenChange?: (open: boolean) => void;
  onEquipReward: (rewardId: JourneyStampRewardId) => void;
  onOpenCompletion: () => void;
  onSelectZone: (zoneId: WorldZoneId) => void;
};

type JourneyStampNoticeProps = {
  checkpointId: JourneyCheckpointId;
};

const checkpointIcons: Record<JourneyCheckpointId, LucideIcon> = {
  directions: MapPinned,
  gallery: Images,
  bride: Flower2,
  ceremony: CalendarHeart,
  guestbook: MessageCircleHeart
};

export function JourneyStampBook({
  progress,
  syncStatus = "local",
  activeZoneId,
  highlightedCheckpointId,
  disabled = false,
  appearance,
  equippedReward,
  onOpenChange,
  onEquipReward,
  onOpenCompletion,
  onSelectZone
}: JourneyStampBookProps) {
  const [open, setOpen] = useState(false);
  const [previewRewardId, setPreviewRewardId] = useState<JourneyStampRewardId>(equippedReward);
  const completed = new Set(progress.completedIds);
  const nextCheckpoint = nextJourneyCheckpoint(progress);
  const previewReward = journeyStampRewards.find(({ id }) => id === previewRewardId) ?? journeyStampRewards[0];
  const previewUnlocked = isJourneyStampRewardUnlocked(previewReward.id, progress);

  useEffect(() => {
    setPreviewRewardId(equippedReward);
  }, [equippedReward]);

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <section className="journey-stamp-book" data-complete={nextCheckpoint === null || undefined}>
      <button
        type="button"
        className="journey-stamp-book__toggle"
        aria-expanded={open}
        aria-controls="journey-stamp-panel"
        aria-label={`방문 스탬프 ${progress.completedIds.length}/${journeyCheckpointIds.length}${open ? ", 닫기" : ", 열기"}`}
        onClick={() => updateOpen(!open)}
      >
        <span className="journey-stamp-book__emblem" aria-hidden="true"><Footprints /></span>
        <span className="journey-stamp-book__summary">
          <strong>방문 스탬프</strong>
          <small>{nextCheckpoint ? `다음 · ${nextCheckpoint.label}` : "여정 완주"}</small>
        </span>
        <span className="journey-stamp-book__meter" aria-hidden="true">
          {journeyCheckpointIds.map((id) => (
            <i
              key={id}
              className={completed.has(id) ? "is-complete" : undefined}
              data-highlighted={id === highlightedCheckpointId || undefined}
            />
          ))}
        </span>
        <b>{progress.completedIds.length}/{journeyCheckpointIds.length}</b>
        <ChevronDown className="journey-stamp-book__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div id="journey-stamp-panel" className="journey-stamp-book__panel">
          <header>
            <span>WEDDING TRAIL</span>
            <strong>{nextCheckpoint ? "다음 추억을 찾아가요" : "모든 추억을 모았어요"}</strong>
            <small className="journey-stamp-book__sync" data-status={syncStatus} role="status">
              {syncStatus === "synced"
                ? "개인 초대 링크에 저장됨"
                : syncStatus === "merged"
                  ? "다른 기기의 기록과 합침 · 완료 기록은 유지됨"
                  : syncStatus === "queued"
                    ? "오프라인 변경 대기 중 · 연결되면 자동 저장"
                : syncStatus === "syncing"
                  ? "여정을 동기화하고 있어요"
                  : syncStatus === "error"
                    ? "기기에 저장됨 · 연결되면 다시 동기화"
                    : "이 기기에 안전하게 저장됨"}
            </small>
          </header>
          <section className="journey-stamp-wardrobe" aria-labelledby="journey-stamp-wardrobe-title">
            <header>
              <span><Sparkles aria-hidden="true" /></span>
              <div>
                <strong id="journey-stamp-wardrobe-title">스탬프 장식함</strong>
                <small>모은 추억을 캐릭터에 미리 입혀보세요</small>
              </div>
            </header>
            <div
              className="journey-stamp-wardrobe__preview"
              data-journey-stamp-reward={previewReward.id}
              data-locked={!previewUnlocked || undefined}
              aria-label={`${previewReward.label} 캐릭터 미리보기`}
            >
              <span aria-hidden="true">
                <CharacterSprite appearance={appearance} direction="down" moving={false} displayMode="preview" />
              </span>
              <div>
                <small><Eye aria-hidden="true" /> 실시간 미리보기</small>
                <strong>{previewReward.label}</strong>
                <p>{previewReward.detail}</p>
                <button
                  type="button"
                  disabled={disabled || !previewUnlocked}
                  aria-pressed={equippedReward === previewReward.id}
                  onClick={() => onEquipReward(equippedReward === previewReward.id ? "none" : previewReward.id)}
                >
                  {!previewUnlocked
                    ? <><LockKeyhole aria-hidden="true" />스탬프를 모으면 해금</>
                    : equippedReward === previewReward.id
                      ? <><Check aria-hidden="true" />착용 중 · 해제</>
                      : <><Sparkles aria-hidden="true" />이 장식 착용</>}
                </button>
              </div>
            </div>
            <div className="journey-stamp-wardrobe__catalog" role="list" aria-label="스탬프 장식 목록">
              {journeyStampRewards.map((reward) => {
                const unlocked = isJourneyStampRewardUnlocked(reward.id, progress);
                return (
                  <span key={reward.id} role="listitem">
                    <button
                      type="button"
                      data-reward={reward.id}
                      data-unlocked={unlocked || undefined}
                      data-selected={previewRewardId === reward.id || undefined}
                      aria-label={`${reward.label}, ${unlocked ? reward.unlockLabel : `${reward.unlockLabel} 필요`}`}
                      aria-pressed={previewRewardId === reward.id}
                      onClick={() => setPreviewRewardId(reward.id)}
                    >
                      <i aria-hidden="true" />
                      <span><strong>{reward.label}</strong><small>{unlocked ? reward.unlockLabel : `${reward.unlockLabel} 필요`}</small></span>
                      {unlocked ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                    </button>
                  </span>
                );
              })}
            </div>
          </section>
          {nextCheckpoint ? (
            <button
              type="button"
              className="journey-stamp-book__next"
              disabled={disabled}
              onClick={() => {
                updateOpen(false);
                onSelectZone(nextCheckpoint.zoneId);
              }}
            >
              <span><small>다음 목적지</small><strong>{nextCheckpoint.label}</strong></span>
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="journey-stamp-book__reward"
              disabled={disabled}
              onClick={() => {
                updateOpen(false);
                onOpenCompletion();
              }}
            >
              <Gift aria-hidden="true" />
              <span><small>완주 보상</small><strong>기념 카드 다시 보기</strong></span>
            </button>
          )}
          <ol>
            {journeyCheckpoints.map((checkpoint, index) => {
              const complete = completed.has(checkpoint.id);
              const current = activeZoneId === checkpoint.zoneId;
              const next = nextCheckpoint?.id === checkpoint.id;
              const Icon = checkpointIcons[checkpoint.id];
              return (
                <li
                  key={checkpoint.id}
                  data-complete={complete || undefined}
                  data-current={current || undefined}
                  data-next={next || undefined}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${checkpoint.label} ${complete ? "완료" : "방문하기"}`}
                    onClick={() => {
                      updateOpen(false);
                      onSelectZone(checkpoint.zoneId);
                    }}
                  >
                    <span className="journey-stamp-book__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="journey-stamp-book__stamp" aria-hidden="true">
                      <Icon />
                      {complete ? <Check className="journey-stamp-book__check" /> : null}
                    </span>
                    <span className="journey-stamp-book__copy">
                      <strong>{checkpoint.label}</strong>
                      <small>{checkpoint.detail}</small>
                    </span>
                    {current ? <span className="journey-stamp-book__here">현재</span> : null}
                    {next && !current ? <span className="journey-stamp-book__next-label">다음</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export function JourneyStampNotice({ checkpointId }: JourneyStampNoticeProps) {
  const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
  if (!checkpoint) return null;

  return (
    <div className="journey-stamp-toast" role="status">
      <Check aria-hidden="true" />
      <span><small>STAMP COMPLETE</small><strong>{checkpoint.label}</strong></span>
    </div>
  );
}
