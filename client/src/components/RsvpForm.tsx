import { Check, CircleAlert, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizeRsvpPhone, type RsvpAttendance, type RsvpMealStatus, type RsvpSide, type RsvpSubmission } from "@wedding-game/shared";
import { shouldReduceMotion } from "../accessibility/viewPreferences";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import {
  clearRsvpFormDraft,
  saveRsvpFormDraft,
  type RsvpFormDraft
} from "../invitation/publicFormDraftStorage";
import { FormDraftManager } from "./FormDraftManager";
import { PendingSubmissionManager } from "./PendingSubmissionManager";

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
  draftResetValue?: RsvpFormInitialValue;
  queuedAt?: string;
  onDiscardQueued?: () => void;
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

export function RsvpForm({
  initialValue,
  policy,
  draftStorageId,
  restoredDraftAt,
  draftResetValue,
  queuedAt,
  onDiscardQueued,
  submitLabel,
  onSubmit
}: RsvpFormProps) {
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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(restoredDraftAt ?? null);
  const [draftStatus, setDraftStatus] = useState(() => (
    restoredDraftAt ? "이 기기에 저장된 작성 내용을 복원했습니다." : ""
  ));
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const previousOnlineRef = useRef(online);
  const guestNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const partySizeRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

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
      setDraftSavedAt(saved?.savedAt ?? null);
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
  const phoneValid = normalizedPhone.length >= 8 && normalizedPhone.length <= 15;
  const partySizeValid = attendance === "no" || (Number.isInteger(partySize) && partySize >= 1 && partySize <= 10);
  const identityComplete = guestName.trim().length > 0 && phoneValid;
  const attendanceComplete = identityComplete && partySizeValid;
  const consentComplete = attendanceComplete && consented;
  const completedSteps = consentComplete ? 3 : attendanceComplete ? 2 : identityComplete ? 1 : 0;
  const valid = identityComplete
    && partySizeValid
    && consented;
  const deadlinePassed = Date.now() > Date.parse(policy.responseDeadline);
  const deadlineLabel = formatPolicyDate(policy.responseDeadline);
  const deleteAtLabel = formatPolicyDate(policy.deleteAt);
  const readinessMessage = !identityComplete
    ? "이름과 연락처를 확인해 주세요."
    : !partySizeValid
      ? "참석 인원은 1명에서 10명 사이로 입력해 주세요."
      : !consented
        ? "개인정보 이용 동의 후 답변을 보낼 수 있습니다."
        : "답변을 보낼 준비가 되었습니다.";
  const validationMessage = !validationAttempted
    ? ""
    : guestName.trim().length === 0
      ? "이름을 입력해 주세요."
      : !phoneValid
        ? "연락처를 숫자 8자리 이상 입력해 주세요."
        : !partySizeValid
          ? "참석 인원을 1명에서 10명 사이로 확인해 주세요."
          : !consented
            ? "개인정보 수집 및 이용에 동의해 주세요."
            : "";

  function changeAttendance(value: RsvpAttendance) {
    setAttendance(value);
    if (value === "unsure") setMealStatus("unsure");
  }

  function adjustPartySize(delta: number) {
    setDraftTouched(true);
    setPartySize((current) => Math.min(10, Math.max(1, current + delta)));
  }

  function discardDraft() {
    if (!draftStorageId || !clearRsvpFormDraft(draftStorageId)) {
      setDraftStatus("임시 저장을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const reset = draftResetValue;
    setSide(reset?.side ?? sideOrder[0]);
    setGuestName(reset?.guestName ?? "");
    setPhone(formatPhone(reset?.phone ?? ""));
    setAttendance(reset?.attendance ?? "yes");
    setPartySize(reset?.partySize && reset.partySize > 0 ? reset.partySize : 1);
    setMealStatus(reset?.mealStatus && reset.mealStatus !== "not_applicable" ? reset.mealStatus : "unsure");
    setNote(reset?.note ?? "");
    setConsented(reset?.consentVersion === policy.consentVersion);
    setDraftTouched(false);
    setDraftSavedAt(null);
    setDraftStatus("이 기기의 임시 저장을 삭제했습니다.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!valid) {
      setValidationAttempted(true);
      setMessage("");
      const target = guestName.trim().length === 0
        ? guestNameRef.current
        : !phoneValid
          ? phoneRef.current
          : !partySizeValid
            ? partySizeRef.current
            : consentRef.current;
      const revealTarget = () => {
        if (!target) return;
        target.scrollIntoView?.({
          behavior: shouldReduceMotion() ? "auto" : "smooth",
          block: "center",
          inline: "nearest"
        });
        target.focus({ preventScroll: true });
      };
      if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(revealTarget);
      else window.setTimeout(revealTarget, 0);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    setValidationAttempted(false);
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
      setDraftSavedAt(null);
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
    <form className="rsvp-form form-stack" noValidate onSubmit={handleSubmit} onChange={() => setDraftTouched(true)}>
      {queuedAt && onDiscardQueued ? (
        <PendingSubmissionManager queuedAt={queuedAt} online={online} label="참석 답변" onDiscard={onDiscardQueued} />
      ) : draftSavedAt ? <FormDraftManager savedAt={draftSavedAt} onDiscard={discardDraft} /> : null}
      <p className="rsvp-deadline">{deadlinePassed
        ? "마감일이 지났지만 답변을 보내실 수 있습니다"
        : `${deadlineLabel}까지 알려주세요`}</p>

      <section className="rsvp-progress" aria-label="참석 답변 작성 진행">
        <div className="rsvp-progress__heading">
          <strong>{completedSteps === 3 ? "전송 준비 완료" : "답변 작성 중"}</strong>
          <span>{completedSteps}/3 완료</span>
        </div>
        <div
          className="rsvp-progress__track"
          role="progressbar"
          aria-label="참석 답변 작성 진행률"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={completedSteps}
        >
          <span style={{ width: `${(completedSteps / 3) * 100}%` }} />
        </div>
        <p className="rsvp-progress__focus-status" aria-live="polite">작성 안내 · {readinessMessage}</p>
        <ol className="rsvp-progress__steps">
          {[
            ["하객 정보", identityComplete],
            ["참석 정보", attendanceComplete],
            ["동의·전송", consentComplete]
          ].map(([label, complete], stepIndex) => (
            <li key={String(label)} data-complete={complete || undefined} data-current={completedSteps === stepIndex || undefined}>
              <span>{complete ? <Check aria-hidden="true" /> : stepIndex + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="rsvp-form__section"
        data-complete={identityComplete || undefined}
        data-invalid={validationAttempted && !identityComplete || undefined}
      >
        <header className="rsvp-form__section-header">
          <span>{identityComplete ? <Check aria-hidden="true" /> : 1}</span>
          <div><strong>하객 정보</strong><small>연락 가능한 정보를 적어주세요</small></div>
        </header>
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
          <input
            ref={guestNameRef}
            value={guestName}
            maxLength={30}
            autoComplete="name"
            aria-label="이름"
            aria-invalid={validationAttempted && guestName.trim().length === 0 ? "true" : undefined}
            aria-describedby={validationAttempted && guestName.trim().length === 0 ? "rsvp-name-hint" : undefined}
            onChange={(event) => setGuestName(event.target.value)}
            required
          />
          {validationAttempted && guestName.trim().length === 0 ? (
            <small className="rsvp-field-hint" id="rsvp-name-hint">성함을 입력해 주세요.</small>
          ) : null}
        </label>
        <label className="field">
          <span>연락처</span>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            aria-label="연락처"
            value={phone}
            maxLength={19}
            autoComplete="tel"
            aria-invalid={(phone.length > 0 || validationAttempted) && !phoneValid ? "true" : undefined}
            aria-describedby={(phone.length > 0 || validationAttempted) && !phoneValid ? "rsvp-phone-hint" : undefined}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            required
          />
          {(phone.length > 0 || validationAttempted) && !phoneValid ? (
            <small className="rsvp-field-hint" id="rsvp-phone-hint">숫자 8자리 이상 입력해 주세요.</small>
          ) : null}
        </label>
      </section>

      <section
        className="rsvp-form__section"
        data-complete={attendanceComplete || undefined}
        data-invalid={validationAttempted && !partySizeValid || undefined}
      >
        <header className="rsvp-form__section-header">
          <span>{attendanceComplete ? <Check aria-hidden="true" /> : 2}</span>
          <div><strong>참석 정보</strong><small>예식 준비에 필요한 내용입니다</small></div>
        </header>
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
          <div className="field rsvp-party-size">
            <span id="rsvp-party-size-label">{attendance === "unsure" ? "예상 인원" : "본인 포함 참석 인원"}</span>
            <div className="rsvp-party-size__control">
              <button type="button" aria-label="참석 인원 1명 줄이기" disabled={partySize <= 1} onClick={() => adjustPartySize(-1)}>
                <Minus aria-hidden="true" />
              </button>
              <label>
                <span className="sr-only">{attendance === "unsure" ? "예상 인원" : "본인 포함 참석 인원"}</span>
                <input
                  ref={partySizeRef}
                  type="number"
                  min={1}
                  max={10}
                  inputMode="numeric"
                  aria-labelledby="rsvp-party-size-label"
                  aria-invalid={validationAttempted && !partySizeValid ? "true" : undefined}
                  aria-describedby="rsvp-party-size-hint"
                  value={partySize}
                  onChange={(event) => setPartySize(Number(event.target.value))}
                />
                <small>명</small>
              </label>
              <button type="button" aria-label="참석 인원 1명 늘리기" disabled={partySize >= 10} onClick={() => adjustPartySize(1)}>
                <Plus aria-hidden="true" />
              </button>
            </div>
            <small className="rsvp-party-size__hint" id="rsvp-party-size-hint">
              {validationAttempted && !partySizeValid ? "1명에서 10명 사이로 입력해 주세요." : "본인을 포함한 전체 인원입니다."}
            </small>
          </div>
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
          <textarea value={note} maxLength={160} placeholder="알레르기, 유아 의자 등 필요한 내용을 남겨주세요. (선택)" onChange={(event) => setNote(event.target.value)} />
        </label>
      </section>

      <section
        className="rsvp-form__section rsvp-form__section--submit"
        data-complete={consentComplete || undefined}
        data-invalid={validationAttempted && !consented || undefined}
      >
        <header className="rsvp-form__section-header">
          <span>{consentComplete ? <Check aria-hidden="true" /> : 3}</span>
          <div><strong>동의 및 전송</strong><small>내용을 확인하고 답변을 보내주세요</small></div>
        </header>
        <label className="rsvp-consent">
          <input
            ref={consentRef}
            type="checkbox"
            checked={consented}
            aria-invalid={validationAttempted && !consented ? "true" : undefined}
            aria-describedby="rsvp-consent-detail"
            onChange={(event) => setConsented(event.target.checked)}
          />
          <span>
            <strong>개인정보 수집 및 이용에 동의합니다.</strong>
            <small id="rsvp-consent-detail">참석 인원 확인을 위해 이름·연락처·답변을 {deleteAtLabel}까지 보관 후 자동 삭제합니다.</small>
          </span>
        </label>

        {validationMessage ? (
          <p className="rsvp-validation-callout" role="alert">
            <CircleAlert aria-hidden="true" />
            <span><strong>확인이 필요한 항목으로 이동했어요</strong><small>{validationMessage}</small></span>
          </p>
        ) : null}
        <p className="rsvp-readiness" data-ready={valid || undefined} aria-live="polite">{readinessMessage}</p>
        <button className="primary-button rsvp-submit" type="submit" disabled={submitting}>
          {submitting
            ? online ? "보내는 중" : "저장 중"
            : !valid
              ? "입력 내용 확인하기"
              : !online
                ? "전송 대기함에 저장"
                : queuedAt
                  ? "대기 중인 답변 보내기"
                  : submitLabel}
        </button>
        {draftStatus ? <p className="form-draft-status" role="status">{draftStatus}</p> : null}
        {message ? <p className="form-status form-status--error" role="alert">{message}</p> : null}
      </section>
    </form>
  );
}
