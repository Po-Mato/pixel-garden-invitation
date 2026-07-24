import { CloudOff, Send, Trash2 } from "lucide-react";

type PendingSubmissionManagerProps = {
  queuedAt: string;
  online: boolean;
  label: string;
  onDiscard: () => void;
};

function formatQueuedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장 시각 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function PendingSubmissionManager({ queuedAt, online, label, onDiscard }: PendingSubmissionManagerProps) {
  return (
    <section className="pending-submission" aria-label={`${label} 전송 대기함`}>
      <span className="pending-submission__icon" aria-hidden="true">{online ? <Send /> : <CloudOff />}</span>
      <span>
        <strong>{label} 전송 대기 중</strong>
        <small>{formatQueuedAt(queuedAt)} · 7일간 보관</small>
        <em>{online ? "연결됨 · 내용을 확인하고 아래 전송 버튼을 눌러주세요" : "연결되면 안전하게 다시 보낼 수 있어요"}</em>
      </span>
      <button type="button" aria-label="전송 대기 삭제" title="전송 대기 삭제" onClick={onDiscard}>
        <Trash2 aria-hidden="true" />
      </button>
    </section>
  );
}
