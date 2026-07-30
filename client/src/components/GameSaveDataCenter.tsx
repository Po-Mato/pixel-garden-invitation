import { Download, HardDriveDownload, KeyRound, QrCode, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { createGameSaveBackup, downloadGameSaveBackup, parseGameSaveBackup, restoreGameSaveBackup } from "../game/gameSaveBackup";
import {
  createCompactGameSaveBackup,
  createGameTransferUrl,
  decryptGameSaveBackup,
  downloadEncryptedGameSave,
  encryptGameSaveBackup,
  parseEncryptedGameSaveEnvelope,
  readGameTransferFromUrl,
  type EncryptedGameSaveEnvelope
} from "../game/gameSaveTransfer";

function incomingTransfer(): EncryptedGameSaveEnvelope | null {
  try {
    return readGameTransferFromUrl(window.location.href);
  } catch {
    return null;
  }
}

export function GameSaveDataCenter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const encryptedInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("캐릭터·여정·사진·설정만 기기에 백업해요");
  const [passphrase, setPassphrase] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrEntryCount, setQrEntryCount] = useState(0);
  const [incomingEnvelope] = useState(incomingTransfer);
  const [expanded, setExpanded] = useState(Boolean(incomingEnvelope));
  const [busy, setBusy] = useState(false);

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

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      finishRestore(restoreGameSaveBackup(parseGameSaveBackup(await file.text()), localStorage));
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
      finishRestore(restoreGameSaveBackup(await decryptGameSaveBackup(envelope, passphrase), localStorage));
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
      const url = createGameTransferUrl(await encryptGameSaveBackup(compact, passphrase), window.location.href);
      if (url.length > 2_900) throw new Error("진행 데이터가 커서 QR 대신 암호화 파일을 사용해 주세요.");
      const { default: QRCode } = await import("qrcode");
      setQrImage(await QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: "L", color: { dark: "#3f3430", light: "#fffdf5" } }));
      setQrEntryCount(Object.keys(compact.entries).length);
      setStatus("다른 휴대폰으로 QR을 스캔한 뒤 같은 암호를 입력하세요");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "기기 이전 QR을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const restoreIncomingTransfer = async () => {
    if (!incomingEnvelope) return;
    setBusy(true);
    try {
      const backup = await decryptGameSaveBackup(incomingEnvelope, passphrase);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      finishRestore(restoreGameSaveBackup(backup, localStorage));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QR 데이터를 복원하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="game-save-data-center" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary><span><HardDriveDownload aria-hidden="true" /><strong>게임 저장 백업</strong><small>{incomingEnvelope ? "QR 진행 도착" : "기기 변경 대비"}</small></span></summary>
      <p aria-live="polite">{status}</p>
      <div className="game-save-data-center__basic">
        <button type="button" disabled={busy} onClick={backup}><Download aria-hidden="true" />백업 저장</button>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />백업 복원</button>
        <input ref={inputRef} type="file" accept="application/json,.json" aria-label="게임 백업 파일 선택" onChange={(event) => void restore(event)} />
      </div>
      <section className="game-save-data-center__secure" aria-label="암호화 기기 이전">
        <label><KeyRound aria-hidden="true" /><span>이전 암호</span><input type="password" minLength={6} autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="6자 이상" /></label>
        {incomingEnvelope ? (
          <button type="button" disabled={busy} className="game-save-data-center__incoming" onClick={() => void restoreIncomingTransfer()}><QrCode aria-hidden="true" />스캔한 진행 복원</button>
        ) : null}
        <div>
          <button type="button" disabled={busy} onClick={() => void saveEncrypted()}><ShieldCheck aria-hidden="true" />암호화 저장</button>
          <button type="button" disabled={busy} onClick={() => encryptedInputRef.current?.click()}><Upload aria-hidden="true" />암호화 복원</button>
          <button type="button" disabled={busy} onClick={() => void makeTransferQr()}><QrCode aria-hidden="true" />기기 이전 QR</button>
        </div>
        <input ref={encryptedInputRef} type="file" accept=".wgsave,application/json" aria-label="암호화 게임 백업 파일 선택" onChange={(event) => void restoreEncrypted(event)} />
        {qrImage ? <figure><img src={qrImage} alt="암호화된 게임 진행 기기 이전 QR" /><figcaption>핵심 진행 {qrEntryCount}개 · 사진 제외</figcaption></figure> : null}
      </section>
      <small>참석 답변·방명록·관리자 정보는 포함하지 않습니다.</small>
    </details>
  );
}
