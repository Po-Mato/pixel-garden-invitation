import { Clock3, Trash2 } from "lucide-react";

type FormDraftManagerProps = {
  savedAt: string;
  onDiscard: () => void;
};

function formatSavedAt(value: string): string {
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

export function FormDraftManager({ savedAt, onDiscard }: FormDraftManagerProps) {
  return (
    <section className="form-draft-manager" aria-label="이 기기의 임시 저장">
      <Clock3 aria-hidden="true" />
      <span>
        <strong>이 기기에 임시 저장됨</strong>
        <small>{formatSavedAt(savedAt)} · 7일간 보관</small>
      </span>
      <button type="button" aria-label="임시 저장 삭제" title="임시 저장 삭제" onClick={onDiscard}>
        <Trash2 aria-hidden="true" />
      </button>
    </section>
  );
}
