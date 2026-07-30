import { ChevronLeft, ChevronRight, Crown, Pause, Play, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { worldDepth } from "../game/worldVisuals";
import { getWorldZone, gardenWorld } from "../game/world";
import { worldSecretCatalog } from "../game/worldPropInteractions";
import { worldSecretAchievements, type WorldSecretCollection } from "../game/worldSecretCollection";

type WorldSecretMemorialProps = { collection: WorldSecretCollection };

export function WorldSecretMemorial({ collection }: WorldSecretMemorialProps) {
  const point = { x: 520, y: 620 };
  const [open, setOpen] = useState(false);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const memories = worldSecretCatalog.filter(({ secretId }) => collection.discoveredIds.includes(secretId));
  const memory = memories[memoryIndex] ?? memories[0];
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    if (!open || !autoPlaying || memories.length < 2) return;
    const timer = window.setInterval(() => {
      setMemoryIndex((index) => (index + 1) % memories.length);
      setReplayCount((count) => count + 1);
    }, 4_800);
    return () => window.clearInterval(timer);
  }, [autoPlaying, memories.length, open]);

  useEffect(() => {
    if (!open || !narrationEnabled || !memory || !speechSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${getWorldZone(gardenWorld, memory.zoneId).label}. ${memory.secretLabel}. ${memory.resultMessage}`
    );
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [memory, narrationEnabled, open, speechSupported]);

  const close = () => {
    window.speechSynthesis?.cancel();
    setNarrationEnabled(false);
    setAutoPlaying(false);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        className="world-secret-memorial"
        aria-label="숨은 추억을 모두 모아 완성한 기억의 등불 열기"
        style={{ left: point.x, top: point.y, zIndex: worldDepth(point.y) }}
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
      >
        <span aria-hidden="true"><i /><Sparkles /><i /></span>
        <strong>기억의 등불</strong>
      </button>
      {open && memory ? createPortal(
        <div className="world-secret-memorial-dialog" role="dialog" aria-modal="true" aria-label="기억의 등불 추억 다시 보기" onClick={(event) => event.stopPropagation()}>
          <div>
            <header>
              <span><Sparkles aria-hidden="true" /><small>MEMORY LANTERN</small><strong>발견한 순간 다시 보기</strong></span>
              <button type="button" aria-label="추억 다시 보기 닫기" onClick={close}><X aria-hidden="true" /></button>
            </header>
            <section className="world-secret-memorial-dialog__scene" data-replaying={replayCount > 0 || undefined} key={replayCount} aria-live={autoPlaying ? "polite" : "off"}>
              <span aria-hidden="true"><i /><Sparkles /><i /></span>
              <small>{memoryIndex + 1} / {memories.length} · {getWorldZone(gardenWorld, memory.zoneId).label}</small>
              <h2>{memory.secretLabel}</h2>
              <p>{memory.resultMessage}</p>
            </section>
            <div className="world-secret-memorial-dialog__paging">
              <button type="button" aria-label="이전 추억" disabled={memoryIndex === 0} onClick={() => { setMemoryIndex((index) => Math.max(0, index - 1)); setReplayCount((count) => count + 1); }}><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => setReplayCount((count) => count + 1)}><Play aria-hidden="true" />등불 다시 밝히기</button>
              <button type="button" aria-label="다음 추억" disabled={memoryIndex === memories.length - 1} onClick={() => { setMemoryIndex((index) => Math.min(memories.length - 1, index + 1)); setReplayCount((count) => count + 1); }}><ChevronRight aria-hidden="true" /></button>
            </div>
            <div className="world-secret-memorial-dialog__playback">
              <button type="button" aria-pressed={autoPlaying} onClick={() => setAutoPlaying((value) => !value)}>{autoPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{autoPlaying ? "자동 감상 멈춤" : "자동 감상 시작"}</button>
              <button type="button" aria-pressed={narrationEnabled} disabled={!speechSupported} onClick={() => setNarrationEnabled((value) => !value)}>{narrationEnabled ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}{narrationEnabled ? "음성 해설 끄기" : "음성 해설 듣기"}</button>
            </div>
            <nav className="world-secret-memorial-dialog__chapters" aria-label="추억 장면 선택">
              {memories.map((entry, index) => <button key={entry.secretId} type="button" aria-current={index === memoryIndex ? "true" : undefined} aria-label={`${index + 1}장 ${entry.secretLabel}`} onClick={() => { setMemoryIndex(index); setReplayCount((count) => count + 1); }}><span>{String(index + 1).padStart(2, "0")}</span><small>{entry.secretLabel}</small></button>)}
            </nav>
            <section className="world-secret-memorial-dialog__rewards" aria-label="획득한 발견 보상">
              <header><Crown aria-hidden="true" /><strong>함께 밝힌 보상</strong></header>
              <ul>{worldSecretAchievements.filter(({ id }) => collection.unlockedAchievementIds.includes(id)).map((reward) => <li key={reward.id}><Sparkles aria-hidden="true" /><span><strong>{reward.rewardLabel}</strong><small>{reward.requirement}번째 추억에서 해금</small></span></li>)}</ul>
            </section>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
