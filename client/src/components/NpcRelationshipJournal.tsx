import { BadgeCheck, BookHeart, Flower2, Gift, Heart, LockKeyhole, Mail, MapPin, MessageCircle, Sparkles, Wine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource-variable/noto-sans-kr/wght.css";
import type { NpcId } from "../game/npcDialogue";
import type { NpcDialogueMemory } from "../game/npcDialogueMemory";
import { buildNpcRelationshipJournal, buildNpcRelationshipStampBook } from "../game/npcRelationshipJournal";
import "../game-vault-optional.css";

type NpcRelationshipJournalProps = {
  memory: NpcDialogueMemory;
  names: Record<NpcId, string>;
  onRewardInteraction?: (npcId: NpcId, rewardLabel: string) => void;
};

export function NpcRelationshipJournal({ memory, names, onRewardInteraction }: NpcRelationshipJournalProps) {
  const [npcId, setNpcId] = useState<NpcId>("bride");
  const journal = useMemo(() => buildNpcRelationshipJournal(memory, npcId), [memory, npcId]);
  const stampBook = useMemo(() => buildNpcRelationshipStampBook(memory), [memory]);
  const [replay, setReplay] = useState<{ title: string; message: string; illustration?: "flowers" | "toast" | "letter" } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const previousCompleteRef = useRef(false);
  useEffect(() => {
    if (!stampBook.complete || previousCompleteRef.current) {
      previousCompleteRef.current = stampBook.complete;
      return;
    }
    previousCompleteRef.current = true;
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 2_600);
    return () => window.clearTimeout(timer);
  }, [stampBook.complete]);

  const replayCompletion = () => {
    setCelebrating(false);
    window.requestAnimationFrame(() => setCelebrating(true));
    window.setTimeout(() => setCelebrating(false), 2_600);
  };
  return (
    <details className="npc-relationship-journal">
      <summary><span><BookHeart aria-hidden="true" /><strong>두 사람과의 인연 일지</strong><small>해금 대화와 선택 기록</small></span></summary>
      <section className="npc-relationship-journal__stamp-book" aria-label="두 사람 전체 장소 도장책" data-complete={stampBook.complete || undefined}>
        {celebrating ? <div className="npc-relationship-journal__completion" role="status"><span aria-hidden="true"><Sparkles /><BadgeCheck /><Sparkles /></span><strong>{stampBook.rewardLabel}</strong><small>세 장소의 인연 도장이 하나의 약속으로 완성됐어요</small></div> : null}
        <header><BadgeCheck aria-hidden="true" /><span><strong>두 사람의 장소 도장책</strong><small>{stampBook.completedCount}/{stampBook.totalCount} · 세 만남을 모두 기록해요</small></span></header>
        <div>{stampBook.stamps.map((stamp) => <button key={stamp.id} type="button" disabled={!stamp.unlocked} data-unlocked={stamp.unlocked || undefined} onClick={() => setReplay({ title: stamp.label, message: `${stamp.label}을 ${stamp.count}번 기록했어요.` })}><i data-tone={stamp.stampTone} aria-hidden="true">{stamp.unlocked ? <BadgeCheck /> : <LockKeyhole />}{stamp.stampCode}</i><span>{stamp.label}</span></button>)}</div>
        <button className="npc-relationship-journal__hidden-letter" type="button" disabled={!stampBook.complete} onClick={() => { setReplay({ title: stampBook.hiddenLetterTitle, message: stampBook.hiddenLetterMessage, illustration: "letter" }); replayCompletion(); }}>{stampBook.complete ? <Mail aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span><small>완성 보상 · {stampBook.rewardLabel}</small><strong>{stampBook.hiddenLetterTitle}</strong></span></button>
      </section>
      <div className="npc-relationship-journal__tabs" role="tablist" aria-label="인연 일지 인물">
        {(["bride", "groom"] as const).map((candidate) => <button key={candidate} type="button" role="tab" aria-selected={npcId === candidate} onClick={() => { setNpcId(candidate); setReplay(null); }}>{candidate === "bride" ? "신부" : "신랑"} {names[candidate]}</button>)}
      </div>
      <header>
        <span><strong>{journal.relationshipLabel}</strong><small>대화 {journal.interactionCount}회</small></span>
        <div aria-label={`인연 ${journal.affinityLevel}/3단계`}>{[0, 1, 2].map((level) => <Heart key={level} aria-hidden="true" data-filled={level < journal.affinityLevel || undefined} />)}</div>
      </header>
      {journal.recentChoiceLabels.length > 0 ? <p>최근 마음 · {journal.recentChoiceLabels.join(" · ")}</p> : <p>두 사람에게 먼저 인사를 건네보세요.</p>}
      {journal.rewardLabel && journal.rewardMessage && journal.rewardActionLabel ? <div className="npc-relationship-journal__reward"><Gift aria-hidden="true" /><span><small>특별 보상</small><strong>{journal.rewardLabel}</strong></span><button type="button" onClick={() => { setReplay({ title: journal.rewardLabel!, message: journal.rewardMessage! }); onRewardInteraction?.(npcId, journal.rewardLabel!); }}><Sparkles aria-hidden="true" />{journal.rewardActionLabel}</button></div> : null}
      {journal.locations.length > 0 ? <section className="npc-relationship-journal__locations" aria-label={`${names[npcId]} 장소별 인연 기록`}><header><MapPin aria-hidden="true" /><strong>장소 스탬프 {journal.locations.length}개</strong></header><div>{journal.locations.map((location) => <button key={location.zoneId} type="button" onClick={() => setReplay({ title: location.label, message: location.message })}><i data-tone={location.stampTone} aria-hidden="true"><BadgeCheck />{location.stampCode}</i><span>{location.label}</span><small>{location.count}번의 대화</small></button>)}</div></section> : null}
      <section className="npc-relationship-journal__keepsakes" aria-label={`${names[npcId]} 삽화 편지 수집함`}><header><Mail aria-hidden="true" /><strong>삽화 편지 수집함</strong><small>{journal.keepsakes.filter(({ unlocked }) => unlocked).length}/{journal.keepsakes.length}</small></header>{journal.keepsakes.map((keepsake) => <button key={keepsake.id} type="button" disabled={!keepsake.unlocked} data-unlocked={keepsake.unlocked || undefined} onClick={() => setReplay({ title: keepsake.label, message: keepsake.message, illustration: keepsake.illustration })}>{keepsake.unlocked ? keepsake.illustration === "flowers" ? <Flower2 aria-hidden="true" /> : <Wine aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span><strong>{keepsake.label}</strong><small>{keepsake.unlocked ? keepsake.detail : "소중한 인연 보상으로 해금"}</small></span></button>)}</section>
      <ol>
        {journal.entries.map((entry) => <li key={entry.id} data-unlocked={entry.unlocked || undefined}><button type="button" disabled={!entry.unlocked} onClick={() => setReplay({ title: entry.title, message: entry.message })}>{entry.unlocked ? <MessageCircle aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span><strong>{entry.title}</strong><small>{entry.unlocked ? "다시 읽기" : "인연을 쌓으면 해금"}</small></span></button></li>)}
      </ol>
      {replay ? <blockquote aria-live="polite" data-illustration={replay.illustration}><span aria-hidden="true">{replay.illustration === "flowers" ? <Flower2 /> : replay.illustration === "toast" ? <Wine /> : replay.illustration === "letter" ? <Mail /> : null}</span><strong>{replay.title}</strong><p>{replay.message}</p></blockquote> : null}
    </details>
  );
}
