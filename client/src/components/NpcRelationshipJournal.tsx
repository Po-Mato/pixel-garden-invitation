import { BookHeart, Gift, Heart, LockKeyhole, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { NpcId } from "../game/npcDialogue";
import type { NpcDialogueMemory } from "../game/npcDialogueMemory";
import { buildNpcRelationshipJournal } from "../game/npcRelationshipJournal";

type NpcRelationshipJournalProps = {
  memory: NpcDialogueMemory;
  names: Record<NpcId, string>;
};

export function NpcRelationshipJournal({ memory, names }: NpcRelationshipJournalProps) {
  const [npcId, setNpcId] = useState<NpcId>("bride");
  const journal = useMemo(() => buildNpcRelationshipJournal(memory, npcId), [memory, npcId]);
  const [replayId, setReplayId] = useState<string | null>(null);
  const replay = journal.entries.find(({ id, unlocked }) => id === replayId && unlocked) ?? null;
  return (
    <details className="npc-relationship-journal">
      <summary><span><BookHeart aria-hidden="true" /><strong>두 사람과의 인연 일지</strong><small>해금 대화와 선택 기록</small></span></summary>
      <div className="npc-relationship-journal__tabs" role="tablist" aria-label="인연 일지 인물">
        {(["bride", "groom"] as const).map((candidate) => <button key={candidate} type="button" role="tab" aria-selected={npcId === candidate} onClick={() => { setNpcId(candidate); setReplayId(null); }}>{candidate === "bride" ? "신부" : "신랑"} {names[candidate]}</button>)}
      </div>
      <header>
        <span><strong>{journal.relationshipLabel}</strong><small>대화 {journal.interactionCount}회</small></span>
        <div aria-label={`인연 ${journal.affinityLevel}/3단계`}>{[0, 1, 2].map((level) => <Heart key={level} aria-hidden="true" data-filled={level < journal.affinityLevel || undefined} />)}</div>
      </header>
      {journal.recentChoiceLabels.length > 0 ? <p>최근 마음 · {journal.recentChoiceLabels.join(" · ")}</p> : <p>두 사람에게 먼저 인사를 건네보세요.</p>}
      {journal.rewardLabel ? <div className="npc-relationship-journal__reward"><Gift aria-hidden="true" /><span><small>특별 보상</small><strong>{journal.rewardLabel}</strong></span></div> : null}
      <ol>
        {journal.entries.map((entry) => <li key={entry.id} data-unlocked={entry.unlocked || undefined}><button type="button" disabled={!entry.unlocked} onClick={() => setReplayId(entry.id)}>{entry.unlocked ? <MessageCircle aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span><strong>{entry.title}</strong><small>{entry.unlocked ? "다시 읽기" : "인연을 쌓으면 해금"}</small></span></button></li>)}
      </ol>
      {replay ? <blockquote aria-live="polite"><strong>{replay.title}</strong><p>{replay.message}</p></blockquote> : null}
    </details>
  );
}
