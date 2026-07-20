import { useEffect, useRef, useState } from "react";
import { normalizeRsvpPhone, type RsvpAttendance, type RsvpMealStatus, type RsvpSide, type RsvpSubmission } from "@wedding-game/shared";

export type RsvpPolicy = {
  responseDeadline: string;
  deleteAt: string;
  consentVersion: string;
};

type RsvpFormProps = {
  initialValue?: RsvpFormInitialValue;
  policy: RsvpPolicy;
  submitLabel: string;
  onSubmit: (payload: RsvpSubmission) => Promise<void>;
};

export type RsvpFormInitialValue = Omit<RsvpSubmission, "consentVersion"> & {
  consentVersion: string | null;
};

function formatPhone(value: string): string {
  const digits = normalizeRsvpPhone(value).slice(0, 15);
  if (digits.startsWith("010") && digits.length > 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
  }
  if (digits.length > 7) return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "답변을 보내지 못했습니다. 다시 시도해 주세요.";
}

function formatPolicyDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function RsvpForm({ initialValue, policy, submitLabel, onSubmit }: RsvpFormProps) {
  const [side, setSide] = useState<RsvpSide>(initialValue?.side ?? "groom");
  const [guestName, setGuestName] = useState(initialValue?.guestName ?? "");
  const [phone, setPhone] = useState(formatPhone(initialValue?.phone ?? ""));
  const [attendance, setAttendance] = useState<RsvpAttendance>(initialValue?.attendance ?? "yes");
  const [partySize, setPartySize] = useState(initialValue?.partySize && initialValue.partySize > 0 ? initialValue.partySize : 1);
  const [mealStatus, setMealStatus] = useState<Exclude<RsvpMealStatus, "not_applicable">>(
    initialValue?.mealStatus && initialValue.mealStatus !== "not_applicable" ? initialValue.mealStatus : "unsure"
  );
  const [note, setNote] = useState(initialValue?.note ?? "");
  const [consented, setConsented] = useState(initialValue?.consentVersion === policy.consentVersion);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const normalizedPhone = normalizeRsvpPhone(phone);
  const partySizeValid = attendance === "no" || (Number.isInteger(partySize) && partySize >= 1 && partySize <= 10);
  const valid = guestName.trim().length > 0
    && normalizedPhone.length >= 8
    && normalizedPhone.length <= 15
    && partySizeValid
    && consented;
  const deadlinePassed = Date.now() > Date.parse(policy.responseDeadline);
  const deadlineLabel = formatPolicyDate(policy.responseDeadline);
  const deleteAtLabel = formatPolicyDate(policy.deleteAt);

  function changeAttendance(value: RsvpAttendance) {
    setAttendance(value);
    if (value === "unsure") setMealStatus("unsure");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    const payload: RsvpSubmission = {
      side,
      guestName: guestName.trim(),
      phone: normalizedPhone,
      attendance,
      partySize: attendance === "no" ? 0 : partySize,
      mealStatus: attendance === "no" ? "not_applicable" : attendance === "unsure" ? "unsure" : mealStatus,
      note: note.trim(),
      consentVersion: policy.consentVersion
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      if (mountedRef.current) setMessage(errorMessage(error));
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <form className="rsvp-form form-stack" onSubmit={handleSubmit}>
      <p className="rsvp-deadline">{deadlinePassed
        ? "마감일이 지났지만 답변을 보내실 수 있습니다"
        : `${deadlineLabel}까지 알려주세요`}</p>

      <fieldset className="rsvp-fieldset" role="radiogroup">
        <legend>어느 분의 하객인가요?</legend>
        <div className="rsvp-segmented">
          <label><input type="radio" name="rsvp-side" value="groom" checked={side === "groom"} onChange={() => setSide("groom")} /><span>신랑측</span></label>
          <label><input type="radio" name="rsvp-side" value="bride" checked={side === "bride"} onChange={() => setSide("bride")} /><span>신부측</span></label>
        </div>
      </fieldset>

      <label className="field">
        <span>이름</span>
        <input value={guestName} maxLength={30} autoComplete="name" onChange={(event) => setGuestName(event.target.value)} required />
      </label>
      <label className="field">
        <span>연락처</span>
        <input type="tel" inputMode="tel" value={phone} maxLength={19} autoComplete="tel" onChange={(event) => setPhone(formatPhone(event.target.value))} required />
      </label>

      <fieldset className="rsvp-fieldset" role="radiogroup">
        <legend>참석 여부</legend>
        <div className="rsvp-segmented rsvp-segmented--three">
          {(["yes", "no", "unsure"] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="rsvp-attendance" value={value} checked={attendance === value} onChange={() => changeAttendance(value)} />
              <span>{{ yes: "참석", no: "불참", unsure: "미정" }[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {attendance !== "no" ? (
        <label className="field">
          <span>{attendance === "unsure" ? "예상 인원" : "본인 포함 참석 인원"}</span>
          <input type="number" min={1} max={10} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
        </label>
      ) : null}

      {attendance === "yes" ? (
        <fieldset className="rsvp-fieldset" role="radiogroup">
          <legend>식사 여부</legend>
          <div className="rsvp-segmented rsvp-segmented--three">
            {(["yes", "no", "unsure"] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="rsvp-meal" value={value} checked={mealStatus === value} onChange={() => setMealStatus(value)} />
                <span>{{ yes: "식사 예정", no: "식사 안 함", unsure: "미정" }[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="field">
        <span>전달사항</span>
        <textarea value={note} maxLength={160} onChange={(event) => setNote(event.target.value)} />
      </label>

      <label className="rsvp-consent">
        <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
        <span>개인정보 수집 및 이용에 동의합니다. 예식 참석 인원 확인을 위해 이름·연락처·답변을 {deleteAtLabel}까지 보관 후 자동 삭제합니다.</span>
      </label>

      <button className="primary-button rsvp-submit" type="submit" disabled={!valid || submitting}>
        {submitting ? "보내는 중" : submitLabel}
      </button>
      {message ? <p className="form-status form-status--error" role="alert">{message}</p> : null}
    </form>
  );
}
