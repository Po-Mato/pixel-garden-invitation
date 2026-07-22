import {
  CalendarHeart,
  Check,
  ChevronDown,
  Flower2,
  Footprints,
  Images,
  MapPinned,
  MessageCircleHeart,
  Sparkles,
  X,
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
  onSelectZone: (zoneId: WorldZoneId) => void;
};

type JourneyCompletionProps = {
  onClose: () => void;
  onOpenRsvp: () => void;
  onOpenShare: () => void;
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
          <ol>
            {journeyCheckpoints.map((checkpoint, index) => {
              const complete = completed.has(checkpoint.id);
              const current = activeZoneId === checkpoint.zoneId;
              const Icon = checkpointIcons[checkpoint.id];
              return (
                <li key={checkpoint.id} data-complete={complete || undefined} data-current={current || undefined}>
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

export function JourneyCompletion({ onClose, onOpenRsvp, onOpenShare }: JourneyCompletionProps) {
  return (
    <div className="journey-completion" role="dialog" aria-label="방문 여정 완주">
      <div className="journey-completion__petals" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>
      <section className="journey-completion__card">
        <button type="button" className="journey-completion__close" aria-label="완주 안내 닫기" onClick={onClose}>
          <X />
        </button>
        <span className="journey-completion__seal" aria-hidden="true"><Sparkles /><Flower2 /></span>
        <small>WEDDING TRAIL COMPLETE</small>
        <h2>축하의 정원 완주</h2>
        <p>두 사람의 소중한 순간을 모두 만나보셨어요.</p>
        <div className="journey-completion__actions">
          <button type="button" onClick={onOpenRsvp}>참석 답변하기</button>
          <button type="button" onClick={onOpenShare}>초대장 공유</button>
        </div>
      </section>
    </div>
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
