import { BookHeart, Gift, Heart, LockKeyhole, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { NpcId } from "../game/npcDialogue";
import type { NpcDialogueMemory } from "../game/npcDialogueMemory";
import { buildNpcRelationshipJournal } from "../game/npcRelationshipJournal";

type NpcRelationshipJournalProps = {
  memory: NpcDialogueMemory;
  names: Record<NpcId, string>;
  onRewardInteraction?: (npcId: NpcId, rewardLabel: string) => void;
};

export function NpcRelationshipJournal({ memory, names, onRewardInteraction }: NpcRelationshipJournalProps) {
  const [npcId, setNpcId] = useState<NpcId>("bride");
  const journal = useMemo(() => buildNpcRelationshipJournal(memory, npcId), [memory, npcId]);
  const [replay, setReplay] = useState<{ title: string; message: string } | null>(null);
  return (
    <details className="npc-relationship-journal">
      <summary><span><BookHeart aria-hidden="true" /><strong>두 사람과의 인연 일지</strong><small>해금 대화와 선택 기록</small></span></summary>
      <div className="npc-relationship-journal__tabs" role="tablist" aria-label="인연 일지 인물">
        {(["bride", "groom"] as const).map((candidate) => <button key={candidate} type="button" role="tab" aria-selected={npcId === candidate} onClick={() => { setNpcId(candidate); setReplay(null); }}>{candidate === "bride" ? "신부" : "신랑"} {names[candidate]}</button>)}
      </div>
      <header>
        <span><strong>{journal.relationshipLabel}</strong><small>대화 {journal.interactionCount}회</small></span>
        <div aria-label={`인연 ${journal.affinityLevel}/3단계`}>{[0, 1, 2].map((level) => <Heart key={level} aria-hidden="true" data-filled={level < journal.affinityLevel || undefined} />)}</div>
      </header>
      {journal.recentChoiceLabels.length > 0 ? <p>최근 마음 · {journal.recentChoiceLabels.join(" · ")}</p> : <p>두 사람에게 먼저 인사를 건네보세요.</p>}
      {journal.rewardLabel && journal.rewardMessage && journal.rewardActionLabel ? <div className="npc-relationship-journal__reward"><Gift aria-hidden="true" /><span><small>특별 보상</small><strong>{journal.rewardLabel}</strong></span><button type="button" onClick={() => { setReplay({ title: journal.rewardLabel!, message: journal.rewardMessage! }); onRewardInteraction?.(npcId, journal.rewardLabel!); }}><Sparkles aria-hidden="true" />{journal.rewardActionLabel}</button></div> : null}
      {journal.locations.length > 0 ? <section className="npc-relationship-journal__locations" aria-label={`${names[npcId]} 장소별 인연 기록`}><header><MapPin aria-hidden="true" /><strong>장소별 인연</strong></header><div>{journal.locations.map((location) => <button key={location.zoneId} type="button" onClick={() => setReplay({ title: location.label, message: location.message })}><span>{location.label}</span><small>{location.count}번의 대화</small></button>)}</div></section> : null}
      <ol>
        {journal.entries.map((entry) => <li key={entry.id} data-unlocked={entry.unlocked || undefined}><button type="button" disabled={!entry.unlocked} onClick={() => setReplay({ title: entry.title, message: entry.message })}>{entry.unlocked ? <MessageCircle aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span><strong>{entry.title}</strong><small>{entry.unlocked ? "다시 읽기" : "인연을 쌓으면 해금"}</small></span></button></li>)}
      </ol>
      {replay ? <blockquote aria-live="polite"><strong>{replay.title}</strong><p>{replay.message}</p></blockquote> : null}
    </details>
  );
}
