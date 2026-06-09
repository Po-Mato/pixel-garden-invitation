import { useState } from "react";
import type { GuestbookMessage, GuestbookPayload } from "../api/weddingApi";

type GuestbookPanelProps = {
  nickname: string;
  messages: GuestbookMessage[];
  onSubmit: (payload: GuestbookPayload) => Promise<void>;
};

export function GuestbookPanel({ nickname, messages, onSubmit }: GuestbookPanelProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      await onSubmit({ nickname, message: message.trim() });
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="guestbook-panel">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>축하 메시지</span>
          <textarea value={message} maxLength={240} onChange={(event) => setMessage(event.target.value)} required />
        </label>
        <button className="primary-button" type="submit" disabled={status === "submitting"}>
          메시지 남기기
        </button>
      </form>
      {status === "sent" && <p className="form-status">메시지를 남겼습니다.</p>}
      {status === "error" && <p className="form-status form-status--error">전송에 실패했습니다. 다시 시도해 주세요.</p>}
      <ul className="guestbook-list">
        {messages.map((item) => (
          <li key={item.id}>
            <strong>{item.nickname}</strong>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
