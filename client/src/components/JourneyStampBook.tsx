import {
  ArrowRight,
  CalendarHeart,
  Check,
  ChevronDown,
  Flower2,
  Footprints,
  Gift,
  Images,
  MapPinned,
  MessageCircleHeart,
  type LucideIcon
} from "lucide-react";
import { useState } from "react";
import type { WorldZoneId } from "@wedding-game/shared";
import {
  journeyCheckpoints,
  journeyCheckpointIds,
  type JourneyCheckpointId,
  type JourneyProgress
} from "../game/journeyProgress";

type JourneyStampBookProps = {
  progress: JourneyProgress;
  activeZoneId: WorldZoneId;
  highlightedCheckpointId: JourneyCheckpointId | null;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  activeZoneId,
  highlightedCheckpointId,
  disabled = false,
  onOpenChange,
  onOpenCompletion,
  onSelectZone
}: JourneyStampBookProps) {
  const [open, setOpen] = useState(false);
  const completed = new Set(progress.completedIds);
  const nextCheckpoint = journeyCheckpoints.find((checkpoint) => !completed.has(checkpoint.id)) ?? null;

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
          </header>
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
