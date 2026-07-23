import { useEffect, useRef, useState } from "react";
import { normalizeRsvpPhone, type RsvpAttendance, type RsvpMealStatus, type RsvpSide, type RsvpSubmission } from "@wedding-game/shared";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import {
  clearRsvpFormDraft,
  saveRsvpFormDraft,
  type RsvpFormDraft
} from "../invitation/publicFormDraftStorage";

export type RsvpPolicy = {
  responseDeadline: string;
  deleteAt: string;
  consentVersion: string;
};

type RsvpFormProps = {
  initialValue?: RsvpFormInitialValue;
  policy: RsvpPolicy;
  draftStorageId?: string;
  restoredDraftAt?: string;
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

export function RsvpForm({ initialValue, policy, draftStorageId, restoredDraftAt, submitLabel, onSubmit }: RsvpFormProps) {
  const coupleOrder = useCoupleOrder();
  const sideOrder = coupleSides(coupleOrder);
  const [side, setSide] = useState<RsvpSide>(initialValue?.side ?? sideOrder[0]);
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
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [draftStatus, setDraftStatus] = useState(() => (
    restoredDraftAt ? "이 기기에 저장된 작성 내용을 복원했습니다." : ""
  ));
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const previousOnlineRef = useRef(online);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!draftStorageId || !draftTouched) return;
    const value: RsvpFormDraft = {
      side,
      guestName,
      phone: normalizeRsvpPhone(phone),
      attendance,
      partySize: attendance === "no" ? 0 : partySize,
      mealStatus: attendance === "no" ? "not_applicable" : attendance === "unsure" ? "unsure" : mealStatus,
      note,
      consentVersion: consented ? policy.consentVersion : null
    };
    const timer = window.setTimeout(() => {
      const saved = saveRsvpFormDraft(draftStorageId, value);
      setDraftStatus(saved
        ? online
          ? "작성 중인 답변을 이 기기에 임시 저장했습니다."
          : "오프라인입니다. 작성 중인 답변을 이 기기에 임시 저장했습니다."
        : "이 기기에 임시 저장하지 못했습니다. 이 화면을 닫지 말아주세요.");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    attendance,
    consented,
    draftStorageId,
    draftTouched,
    guestName,
    mealStatus,
    note,
    online,
    partySize,
    phone,
    policy.consentVersion,
    side
  ]);

  useEffect(() => {
    if (draftStorageId && draftTouched && online && !previousOnlineRef.current) {
      setDraftStatus("연결이 복구됐습니다. 내용을 확인하고 답변을 보내주세요.");
    }
    previousOnlineRef.current = online;
  }, [draftStorageId, draftTouched, online]);

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
      if (draftStorageId) clearRsvpFormDraft(draftStorageId);
      setDraftStatus("");
    } catch (error) {
      if (mountedRef.current) {
        setMessage(errorMessage(error));
        setDraftTouched(true);
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <form className="rsvp-form form-stack" onSubmit={handleSubmit} onChange={() => setDraftTouched(true)}>
      <p className="rsvp-deadline">{deadlinePassed
        ? "마감일이 지났지만 답변을 보내실 수 있습니다"
        : `${deadlineLabel}까지 알려주세요`}</p>

      <fieldset className="rsvp-fieldset" role="radiogroup">
        <legend>어느 분의 하객인가요?</legend>
        <div className="rsvp-segmented">
          {sideOrder.map((weddingSide) => (
            <label key={weddingSide}>
              <input
                type="radio"
                name="rsvp-side"
                value={weddingSide}
                checked={side === weddingSide}
                onChange={() => setSide(weddingSide)}
              />
              <span>{weddingSide === "bride" ? "신부측" : "신랑측"}</span>
            </label>
          ))}
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

      <button className="primary-button rsvp-submit" type="submit" disabled={!valid || submitting || !online}>
        {submitting ? "보내는 중" : !online ? "연결 후 전송 가능" : submitLabel}
      </button>
      {draftStatus ? <p className="form-draft-status" role="status">{draftStatus}</p> : null}
      {message ? <p className="form-status form-status--error" role="alert">{message}</p> : null}
    </form>
  );
}
