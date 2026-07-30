import { Download, HardDriveDownload, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { createGameSaveBackup, downloadGameSaveBackup, parseGameSaveBackup, restoreGameSaveBackup } from "../game/gameSaveBackup";

export function GameSaveDataCenter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("캐릭터·여정·사진·설정만 기기에 백업해요");

  const backup = () => {
    try {
      const data = createGameSaveBackup(localStorage);
      downloadGameSaveBackup(data);
      setStatus(`${Object.keys(data.entries).length}개 저장 항목을 백업했어요`);
    } catch {
      setStatus("백업 파일을 만들지 못했어요");
    }
  };

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const count = restoreGameSaveBackup(parseGameSaveBackup(await file.text()), localStorage);
      setStatus(`${count}개 항목을 복원했어요 · 게임을 다시 불러옵니다`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setStatus("올바른 게임 백업 파일인지 확인해 주세요");
    }
  };

  return (
    <details className="game-save-data-center">
      <summary><span><HardDriveDownload aria-hidden="true" /><strong>게임 저장 백업</strong><small>기기 변경 대비</small></span></summary>
      <p aria-live="polite">{status}</p>
      <div>
        <button type="button" onClick={backup}><Download aria-hidden="true" />백업 저장</button>
        <button type="button" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />백업 복원</button>
        <input ref={inputRef} type="file" accept="application/json,.json" aria-label="게임 백업 파일 선택" onChange={(event) => void restore(event)} />
      </div>
      <small>참석 답변·방명록·관리자 정보는 포함하지 않습니다.</small>
    </details>
  );
}
