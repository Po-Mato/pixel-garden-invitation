import { useState } from "react";
import type { RsvpPayload } from "../api/weddingApi";

type RsvpFormProps = {
  onSubmit: (payload: RsvpPayload) => Promise<void>;
};

export function RsvpForm({ onSubmit }: RsvpFormProps) {
  const [guestName, setGuestName] = useState("");
  const [attendance, setAttendance] = useState<RsvpPayload["attendance"]>("yes");
  const [partySize, setPartySize] = useState(1);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedGuestName = guestName.trim();
    const trimmedNote = note.trim();

    if (!trimmedGuestName) {
      setErrorMessage("이름을 입력해 주세요.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");
    try {
      await onSubmit({ guestName: trimmedGuestName, attendance, partySize, note: trimmedNote });
      setStatus("sent");
    } catch {
      setErrorMessage("전송에 실패했습니다. 다시 시도해 주세요.");
      setStatus("error");
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>이름</span>
        <input value={guestName} maxLength={30} onChange={(event) => setGuestName(event.target.value)} required />
      </label>
      <label className="field">
        <span>참석 여부</span>
        <select value={attendance} onChange={(event) => setAttendance(event.target.value as RsvpPayload["attendance"])}>
          <option value="yes">참석</option>
          <option value="no">불참</option>
          <option value="unsure">미정</option>
        </select>
      </label>
      <label className="field">
        <span>동행 인원</span>
        <input
          type="number"
          min={1}
          max={10}
          value={partySize}
          onChange={(event) => setPartySize(Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>메모</span>
        <textarea value={note} maxLength={160} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="primary-button" type="submit" disabled={status === "submitting"}>
        참석 답변 보내기
      </button>
      {status === "sent" && (
        <p className="form-status" role="status">
          답변을 받았습니다.
        </p>
      )}
      {status === "error" && (
        <p className="form-status form-status--error" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
