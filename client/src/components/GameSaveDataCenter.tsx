import { ArrowRight, Check, Clock3, Download, Eye, HardDriveDownload, History, KeyRound, QrCode, RefreshCw, RotateCcw, ScanLine, Share2, ShieldCheck, Trash2, Upload, Wifi } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "@fontsource-variable/noto-sans-kr/wght.css";
import { claimServerGameTransfer, createServerGameTransfer, fetchServerGameTransfer, reportServerGameTransferProgress, revokeServerGameTransfer, type GameTransferState, type GameTransferStatus } from "../api/gameTransferApi";
import {
  createGameSaveBackup,
  createGameSaveRollback,
  downloadGameSaveBackup,
  parseGameSaveBackup,
  parseGameSaveRollback,
  restoreGameSaveBackup,
  restoreGameSaveRollback,
  summarizeGameSaveBackup,
  type GameSaveBackup,
  type GameSaveRollback
} from "../game/gameSaveBackup";
import {
  createCompactGameSaveBackup,
  createGameTransferUrl,
  decryptGameSaveBackup,
  downloadEncryptedGameSave,
  encryptGameSaveBackup,
  gameTransferExpiresAt,
  gameTransferLifetimeMs,
  assertGameTransferActive,
  parseEncryptedGameSaveEnvelope,
  readGameTransferFromUrl,
  shareEncryptedGameSaveNearby,
  type EncryptedGameSaveEnvelope
} from "../game/gameSaveTransfer";
import { loadGameTransferReceiptHistory, rememberCreatedGameTransfer, updateGameTransferReceiptState } from "../game/gameTransferReceiptHistory";
import { gameTransferLiveStatusLabel, gameTransferLiveSteps, type GameTransferLiveRole } from "../game/gameTransferLiveProgress";
import { GameSaveQrScanner } from "./GameSaveQrScanner";
import "../game-vault-optional.css";
import "../game-transfer-live.css";

function incomingTransfer(): { envelope: EncryptedGameSaveEnvelope | null; error: string | null } {
  try {
    return { envelope: readGameTransferFromUrl(window.location.href), error: null };
  } catch (error) {
    return { envelope: null, error: error instanceof Error ? error.message : "QR 진행을 읽지 못했어요" };
  }
}

function expiryLabel(expiresAt: number | null) {
  if (expiresAt === null) return null;
  return `${new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(expiresAt))}까지 사용 가능`;
}

const restoreRollbackKey = "wedding-game:restore-rollback-session:v1";
const transferStatusLabels: Record<GameTransferStatus, string> = {
  active: "전송 대기",
  claimed: "복원 완료",
  revoked: "전송 취소",
  expired: "기간 만료"
};

function storedRollback(): GameSaveRollback | null {
  try {
    const value = sessionStorage.getItem(restoreRollbackKey);
    return value ? parseGameSaveRollback(value) : null;
  } catch {
    return null;
  }
}

function TransferLiveProgress({ role, state }: { role: GameTransferLiveRole; state: GameTransferState }) {
  const steps = gameTransferLiveSteps(role, state);
  return (
    <section className="game-transfer-live" data-role={role} data-status={state.status} aria-label={`${role === "sender" ? "보내는" : "받는"} 기기 실시간 이전 상태`}>
      <header><Wifi aria-hidden="true" /><span><strong>{role === "sender" ? "보내는 기기" : "받는 기기"} 실시간 연결</strong><small aria-live="polite">{gameTransferLiveStatusLabel(role, state)}</small></span><i aria-hidden="true" /></header>
      <ol>{steps.map((step) => <li key={step.id} data-complete={step.complete || undefined} data-current={step.current || undefined}><i>{step.complete ? <Check aria-hidden="true" /> : null}</i><span>{step.label}</span></li>)}</ol>
    </section>
  );
}

export function GameSaveDataCenter() {
  const [initialIncoming] = useState(incomingTransfer);
  const inputRef = useRef<HTMLInputElement>(null);
  const encryptedInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(initialIncoming.error ?? "캐릭터·여정·사진·설정만 기기에 백업해요");
  const [passphrase, setPassphrase] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrEntryCount, setQrEntryCount] = useState(0);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [incomingEnvelope, setIncomingEnvelope] = useState(initialIncoming.envelope);
  const [pendingBackup, setPendingBackup] = useState<GameSaveBackup | null>(null);
  const [rollback, setRollback] = useState(storedRollback);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [expanded, setExpanded] = useState(Boolean(incomingEnvelope || rollback));
  const [busy, setBusy] = useState(false);
  const [transferReceipts, setTransferReceipts] = useState(loadGameTransferReceiptHistory);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [incomingServerState, setIncomingServerState] = useState<GameTransferState | null>(null);

  const activeOutgoingReceipt = (activeTransferId
    ? transferReceipts.find(({ id }) => id === activeTransferId)
    : transferReceipts.find(({ status }) => status === "active")) ?? null;

  useEffect(() => {
    const receipt = incomingEnvelope?.transferReceipt;
    if (!receipt) {
      setIncomingServerState(null);
      return;
    }
    let canceled = false;
    const sync = async (markOpened = false) => {
      try {
        const next = markOpened
          ? await reportServerGameTransferProgress(receipt.id, receipt.claimToken, "opened")
          : await fetchServerGameTransfer(receipt.id, receipt.claimToken);
        if (!canceled) setIncomingServerState(next);
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
        if (!canceled && code === "transfer_revoked") setStatus("보내는 기기에서 이전을 취소했어요");
      }
    };
    void sync(true);
    const timer = window.setInterval(() => void sync(), 2_000);
    return () => { canceled = true; window.clearInterval(timer); };
  }, [incomingEnvelope?.transferReceipt?.claimToken, incomingEnvelope?.transferReceipt?.id]);

  useEffect(() => {
    const activeReceipts = transferReceipts.filter(({ status }) => status === "active");
    if (!expanded || activeReceipts.length === 0) return;
    let canceled = false;
    const sync = async () => {
      const states = await Promise.all(activeReceipts.map(async (receipt) => {
        try { return await fetchServerGameTransfer(receipt.id, receipt.manageToken); } catch { return null; }
      }));
      if (canceled) return;
      setTransferReceipts((current) => states.reduce(
        (next, state) => state ? updateGameTransferReceiptState(next, state) : next,
        current
      ));
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 2_000);
    return () => { canceled = true; window.clearInterval(timer); };
  }, [expanded, transferReceipts.map(({ id, manageToken, status }) => `${id}:${manageToken}:${status}`).join("|")]);

  const backup = () => {
    try {
      const data = createGameSaveBackup(localStorage);
      downloadGameSaveBackup(data);
      setStatus(`${Object.keys(data.entries).length}개 저장 항목을 백업했어요`);
    } catch {
      setStatus("백업 파일을 만들지 못했어요");
    }
  };

  const finishRestore = (count: number) => {
    setStatus(`${count}개 항목을 복원했어요 · 게임을 다시 불러옵니다`);
    window.setTimeout(() => window.location.reload(), 700);
  };

  const restoreWithRollback = (data: GameSaveBackup) => {
    const checkpoint = createGameSaveRollback(data, localStorage);
    try {
      sessionStorage.setItem(restoreRollbackKey, JSON.stringify(checkpoint));
      const count = restoreGameSaveBackup(data, localStorage);
      setRollback(checkpoint);
      finishRestore(count);
    } catch (error) {
      sessionStorage.removeItem(restoreRollbackKey);
      throw error;
    }
  };

  const undoLastRestore = () => {
    if (!rollback) return;
    try {
      const count = restoreGameSaveRollback(rollback, localStorage);
      sessionStorage.removeItem(restoreRollbackKey);
      setRollback(null);
      finishRestore(count);
    } catch {
      setStatus("이전 진행으로 되돌리지 못했어요");
    }
  };

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      restoreWithRollback(parseGameSaveBackup(await file.text()));
    } catch {
      setStatus("올바른 게임 백업 파일인지 확인해 주세요");
    }
  };

  const saveEncrypted = async () => {
    setBusy(true);
    try {
      const envelope = await encryptGameSaveBackup(createGameSaveBackup(localStorage), passphrase);
      downloadEncryptedGameSave(envelope);
      setStatus("비밀번호로 보호한 전체 백업을 저장했어요");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "암호화 백업을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const restoreEncrypted = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const envelope = parseEncryptedGameSaveEnvelope(await file.text());
      restoreWithRollback(await decryptGameSaveBackup(envelope, passphrase));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "암호화 백업을 복원하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const makeTransferQr = async () => {
    setBusy(true);
    try {
      const compact = createCompactGameSaveBackup(localStorage);
      const expiresAt = new Date(Date.now() + gameTransferLifetimeMs).toISOString();
      const created = await createServerGameTransfer(Object.keys(compact.entries).length, expiresAt);
      const encrypted = await encryptGameSaveBackup(compact, passphrase);
      const url = createGameTransferUrl({
        ...encrypted,
        expiresAt,
        transferReceipt: { id: created.id, claimToken: created.claimToken }
      }, window.location.href);
      if (url.length > 2_900) throw new Error("진행 데이터가 커서 QR 대신 암호화 파일을 사용해 주세요.");
      const { default: QRCode } = await import("qrcode");
      setQrImage(await QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: "L", color: { dark: "#3f3430", light: "#fffdf5" } }));
      setQrEntryCount(Object.keys(compact.entries).length);
      setQrExpiresAt(gameTransferExpiresAt(readGameTransferFromUrl(url)!));
      setTransferReceipts(rememberCreatedGameTransfer(created));
      setActiveTransferId(created.id);
      setStatus("한 번만 복원할 수 있는 QR을 만들었어요");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "기기 이전 QR을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const shareFullSaveNearby = async () => {
    setBusy(true);
    try {
      const data = createGameSaveBackup(localStorage);
      const photoCount = Object.keys(data.entries).filter((key) => key.startsWith("wedding-game:photo-")).length;
      const result = await shareEncryptedGameSaveNearby(data, passphrase);
      setStatus(result === "shared"
        ? `사진 저장 ${photoCount}개를 포함해 근거리 공유창으로 보냈어요`
        : `사진 저장 ${photoCount}개를 포함한 암호화 파일을 저장했어요`);
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
        setStatus("근거리 전송을 취소했어요");
      } else {
        setStatus(error instanceof Error ? error.message : "사진 포함 전송 파일을 만들지 못했어요");
      }
    } finally {
      setBusy(false);
    }
  };

  const restoreIncomingTransfer = async () => {
    if (!incomingEnvelope) return;
    setBusy(true);
    try {
      assertGameTransferActive(incomingEnvelope);
      if (incomingEnvelope.transferReceipt) {
        const receipt = await fetchServerGameTransfer(incomingEnvelope.transferReceipt.id, incomingEnvelope.transferReceipt.claimToken);
        if (receipt.status !== "active") throw new Error(receipt.status === "claimed" ? "이미 다른 기기에서 복원한 QR입니다." : receipt.status === "revoked" ? "보내는 기기에서 취소한 QR입니다." : "사용 시간이 지난 QR입니다.");
      }
      const backup = await decryptGameSaveBackup(incomingEnvelope, passphrase);
      if (incomingEnvelope.transferReceipt) {
        const next = await reportServerGameTransferProgress(incomingEnvelope.transferReceipt.id, incomingEnvelope.transferReceipt.claimToken, "previewing");
        setIncomingServerState(next);
      }
      setPendingBackup(backup);
      setStatus("복원될 내용을 확인한 뒤 적용해 주세요");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QR 데이터를 복원하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const confirmIncomingRestore = async () => {
    if (!pendingBackup) return;
    setBusy(true);
    try {
      if (incomingEnvelope) assertGameTransferActive(incomingEnvelope);
      if (incomingEnvelope?.transferReceipt) {
        setIncomingServerState(await reportServerGameTransferProgress(incomingEnvelope.transferReceipt.id, incomingEnvelope.transferReceipt.claimToken, "restoring"));
        setIncomingServerState(await claimServerGameTransfer(incomingEnvelope.transferReceipt.id, incomingEnvelope.transferReceipt.claimToken));
      }
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      restoreWithRollback(pendingBackup);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      setStatus(code === "transfer_claimed" ? "이미 다른 기기에서 복원한 QR입니다."
        : code === "transfer_revoked" ? "보내는 기기에서 취소한 QR입니다."
          : code === "transfer_expired" ? "사용 시간이 지난 QR입니다."
            : error instanceof Error ? error.message : "QR 데이터를 복원하지 못했어요");
      setBusy(false);
    }
  };

  const refreshTransferReceipts = async () => {
    setBusy(true);
    let next = transferReceipts;
    try {
      const states = await Promise.all(transferReceipts.map(async (receipt) => {
        try { return await fetchServerGameTransfer(receipt.id, receipt.manageToken); } catch { return null; }
      }));
      states.forEach((state) => { if (state) next = updateGameTransferReceiptState(next, state); });
      setTransferReceipts(next);
      setStatus("기기 이전 이력을 서버 상태와 맞췄어요");
    } finally {
      setBusy(false);
    }
  };

  const revokeTransfer = async (id: string, manageToken: string) => {
    setBusy(true);
    try {
      const state = await revokeServerGameTransfer(id, manageToken);
      setTransferReceipts((current) => updateGameTransferReceiptState(current, state));
      setQrImage(null);
      setStatus("아직 복원되지 않은 기기 이전 QR을 취소했어요");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      setStatus(code === "transfer_claimed" ? "이미 복원된 QR은 취소할 수 없어요" : "기기 이전을 취소하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const preview = pendingBackup ? summarizeGameSaveBackup(pendingBackup, localStorage) : null;

  return (
    <details className="game-save-data-center" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary><span><HardDriveDownload aria-hidden="true" /><strong>게임 저장 백업</strong><small>{incomingEnvelope ? "QR 진행 도착" : "기기 변경 대비"}</small></span></summary>
      <p aria-live="polite">{status}</p>
      {rollback ? <section className="game-save-data-center__rollback" aria-label="최근 복원 되돌리기"><History aria-hidden="true" /><span><strong>방금 복원한 진행</strong><small>이 탭을 닫기 전까지 이전 상태로 되돌릴 수 있어요</small></span><button type="button" disabled={busy} onClick={undoLastRestore}><RotateCcw aria-hidden="true" />되돌리기</button><button type="button" aria-label="되돌리기 기록 지우기" title="기록 지우기" onClick={() => { sessionStorage.removeItem(restoreRollbackKey); setRollback(null); }}><Trash2 aria-hidden="true" /></button></section> : null}
      <div className="game-save-data-center__basic">
        <button type="button" disabled={busy} onClick={backup}><Download aria-hidden="true" />백업 저장</button>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />백업 복원</button>
        <input ref={inputRef} type="file" accept="application/json,.json" aria-label="게임 백업 파일 선택" onChange={(event) => void restore(event)} />
      </div>
      <section className="game-save-data-center__secure" aria-label="암호화 기기 이전">
        <label><KeyRound aria-hidden="true" /><span>이전 암호</span><input type="password" minLength={6} autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="6자 이상" /></label>
        {incomingEnvelope && !preview ? (
          <button type="button" disabled={busy} className="game-save-data-center__incoming" onClick={() => void restoreIncomingTransfer()}><Eye aria-hidden="true" />스캔 내용 확인</button>
        ) : null}
        {incomingServerState ? <TransferLiveProgress role="receiver" state={incomingServerState} /> : null}
        {preview ? <section className="game-save-data-center__preview" aria-label="QR 복원 미리보기"><header><QrCode aria-hidden="true" /><span><strong>핵심 진행 {preview.totalEntries}개 · 일회용</strong><small>{new Date(preview.createdAt).toLocaleString("ko-KR")}</small>{expiryLabel(gameTransferExpiresAt(incomingEnvelope!)) ? <small className="game-save-data-center__expiry"><Clock3 aria-hidden="true" />{expiryLabel(gameTransferExpiresAt(incomingEnvelope!))}</small> : null}</span></header><dl><div><dt>새로 추가</dt><dd>{preview.newEntries}</dd></div><div><dt>내용 변경</dt><dd>{preview.changedEntries}</dd></div><div><dt>동일 유지</dt><dd>{preview.unchangedEntries}</dd></div></dl><ul>{preview.categories.map((category) => <li key={category.id}><span>{category.label}</span><strong>{category.count}</strong></li>)}</ul><ol className="game-save-data-center__changes" aria-label="복원 전후 세부 비교">{preview.changes.map((change) => <li key={change.key} data-status={change.status}><header><strong>{change.label}</strong><small>{change.categoryLabel} · {change.status === "new" ? "새 항목" : change.status === "changed" ? "변경" : "동일"}</small></header><span>{change.before}<ArrowRight aria-hidden="true" />{change.after}</span></li>)}</ol><div><button type="button" disabled={busy} onClick={() => void confirmIncomingRestore()}><ShieldCheck aria-hidden="true" />확인하고 한 번 복원</button><button type="button" disabled={busy} onClick={() => { setPendingBackup(null); setIncomingEnvelope(null); setStatus("QR 복원을 취소했어요"); }}><Trash2 aria-hidden="true" />취소</button></div></section> : null}
        <div>
          <button type="button" disabled={busy} onClick={() => void saveEncrypted()}><ShieldCheck aria-hidden="true" />암호화 저장</button>
          <button type="button" disabled={busy} onClick={() => encryptedInputRef.current?.click()}><Upload aria-hidden="true" />암호화 복원</button>
          <button type="button" disabled={busy} onClick={() => void makeTransferQr()}><QrCode aria-hidden="true" />기기 이전 QR</button>
          <button type="button" disabled={busy} onClick={() => setScannerOpen(true)}><ScanLine aria-hidden="true" />QR 스캔 받기</button>
          <button type="button" disabled={busy} onClick={() => void shareFullSaveNearby()}><Share2 aria-hidden="true" />사진 포함 근거리 전송</button>
        </div>
        <input ref={encryptedInputRef} type="file" accept=".wgsave,application/json" aria-label="암호화 게임 백업 파일 선택" onChange={(event) => void restoreEncrypted(event)} />
        {qrImage ? <figure><img src={qrImage} alt="암호화된 게임 진행 기기 이전 QR" /><figcaption>핵심 진행 {qrEntryCount}개 · 사진 제외{expiryLabel(qrExpiresAt) ? <small><Clock3 aria-hidden="true" />{expiryLabel(qrExpiresAt)}</small> : null}</figcaption></figure> : null}
        {activeOutgoingReceipt ? <TransferLiveProgress role="sender" state={{ ...activeOutgoingReceipt, receiverPhase: activeOutgoingReceipt.receiverPhase ?? null, receiverSeenAt: activeOutgoingReceipt.receiverSeenAt ?? null, updatedAt: activeOutgoingReceipt.updatedAt ?? activeOutgoingReceipt.createdAt }} /> : null}
        {transferReceipts.length > 0 ? <section className="game-save-data-center__transfer-history" aria-label="기기 이전 서버 이력"><header><History aria-hidden="true" /><span><strong>기기 이전 이력</strong><small>복원·취소 상태는 서버에서 확인</small></span><button type="button" aria-label="기기 이전 이력 새로고침" title="서버 상태 새로고침" disabled={busy} onClick={() => void refreshTransferReceipts()}><RefreshCw aria-hidden="true" /></button></header><ol>{transferReceipts.slice(0, 4).map((receipt) => <li key={receipt.id} data-status={receipt.status}><span><strong>{transferStatusLabels[receipt.status]}</strong><small>{new Date(receipt.createdAt).toLocaleString("ko-KR")} · {receipt.entryCount}개</small></span>{receipt.status === "active" ? <button type="button" disabled={busy} onClick={() => void revokeTransfer(receipt.id, receipt.manageToken)}><Trash2 aria-hidden="true" />취소</button> : <small>{receipt.status === "claimed" && receipt.claimedAt ? new Date(receipt.claimedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }) : receipt.status === "revoked" ? "발신 취소" : "15분 종료"}</small>}</li>)}</ol></section> : null}
      </section>
      <small>QR은 핵심 진행만, 근거리 전송은 촬영 사진까지 포함합니다. 참석 답변·방명록·관리자 정보는 포함하지 않습니다.</small>
      {scannerOpen ? <GameSaveQrScanner onClose={() => setScannerOpen(false)} onDetected={(envelope) => { setIncomingEnvelope(envelope); setPendingBackup(null); setScannerOpen(false); setExpanded(true); setStatus("QR 진행을 읽었어요 · 같은 암호를 입력해 내용을 확인하세요"); }} /> : null}
    </details>
  );
}
