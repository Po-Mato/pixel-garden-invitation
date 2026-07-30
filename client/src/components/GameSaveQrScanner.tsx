import { Camera, ClipboardPaste, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readGameTransferFromScannedValue, type EncryptedGameSaveEnvelope } from "../game/gameSaveTransfer";

type GameSaveQrScannerProps = {
  onDetected: (envelope: EncryptedGameSaveEnvelope) => void;
  onClose: () => void;
};

export function GameSaveQrScanner({ onDetected, onClose }: GameSaveQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState("카메라 연결 중");
  const [pastedValue, setPastedValue] = useState("");
  onDetectedRef.current = onDetected;

  const acceptValue = (value: string) => {
    try {
      const envelope = readGameTransferFromScannedValue(value);
      detectedRef.current = true;
      onDetectedRef.current(envelope);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QR 데이터를 읽지 못했습니다.");
    }
  };

  useEffect(() => {
    let canceled = false;
    let stop: (() => void) | null = null;
    void (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (canceled || !videoRef.current) return;
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result, _error, callbackControls) => {
            if (!result || detectedRef.current) return;
            try {
              const envelope = readGameTransferFromScannedValue(result.getText());
              detectedRef.current = true;
              callbackControls.stop();
              onDetectedRef.current(envelope);
            } catch {
              setStatus("웨딩 가든 기기 이전 QR을 화면 안에 맞춰주세요");
            }
          }
        );
        stop = () => controls.stop();
        if (canceled) controls.stop();
        else setStatus("기기 이전 QR을 찾고 있습니다");
      } catch {
        if (!canceled) setStatus("카메라를 열 수 없습니다. QR 링크 붙여넣기를 이용해 주세요.");
      }
    })();
    return () => {
      canceled = true;
      stop?.();
    };
  }, []);

  return createPortal(
    <div className="game-save-qr-scanner" role="dialog" aria-modal="true" aria-label="기기 이전 QR 스캔">
      <section>
        <header><span><ScanLine aria-hidden="true" /><strong>QR로 진행 받기</strong></span><button type="button" aria-label="QR 스캐너 닫기" onClick={onClose}><X aria-hidden="true" /></button></header>
        <div className="game-save-qr-scanner__camera"><video ref={videoRef} muted playsInline aria-label="QR 스캔 카메라 화면" /><span aria-hidden="true"><i /><i /><i /><i /></span><Camera aria-hidden="true" /></div>
        <p aria-live="polite">{status}</p>
        <div className="game-save-qr-scanner__paste">
          <label htmlFor="game-save-qr-value"><ClipboardPaste aria-hidden="true" />QR 링크</label>
          <input id="game-save-qr-value" value={pastedValue} onChange={(event) => setPastedValue(event.target.value)} inputMode="url" autoComplete="off" />
          <button type="button" disabled={!pastedValue.trim()} onClick={() => acceptValue(pastedValue)}>읽기</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
