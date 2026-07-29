import { useEffect, useState } from "react";
import { Check, Clock3, Copy, Link2, QrCode, RefreshCw, Send, UsersRound, X } from "lucide-react";
import QRCode from "qrcode";
import { companionInviteRemainingLabel } from "../game/companionMode";

type CompanionWaitingRoomProps = {
  inviteUrl: string;
  expiresAt: number;
  zoneLabel: string;
  nickname: string;
  status: "waiting" | "requested" | "connected";
  companionNickname?: string | null;
  onCopy: (url: string) => Promise<boolean>;
  onShare: (url: string) => Promise<boolean>;
  onRenew: () => void;
  onClose: () => void;
};

export function CompanionWaitingRoom({
  inviteUrl,
  expiresAt,
  zoneLabel,
  nickname,
  status,
  companionNickname = null,
  onCopy,
  onShare,
  onRenew,
  onClose
}: CompanionWaitingRoomProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const [actionStatus, setActionStatus] = useState<"idle" | "copied" | "shared" | "error">("idle");
  const expired = expiresAt <= now;

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(inviteUrl, {
      width: 440,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#33483a", light: "#fffdf7" }
    }).then((url) => {
      if (active) setQrDataUrl(url);
    }).catch(() => {
      if (active) setQrDataUrl("");
    });
    return () => { active = false; };
  }, [inviteUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (action: "copy" | "share") => {
    if (expired) return;
    const succeeded = await (action === "copy" ? onCopy(inviteUrl) : onShare(inviteUrl));
    setActionStatus(succeeded ? action === "copy" ? "copied" : "shared" : "error");
  };

  const statusLabel = status === "connected"
    ? `${companionNickname ?? "동행 하객"}님과 연결됐어요`
    : status === "requested"
      ? `${companionNickname ?? "동행 하객"}님의 응답을 기다려요`
      : "상대가 링크를 열면 이곳에서 바로 확인할 수 있어요";

  return (
    <div className="companion-waiting-room" role="dialog" aria-modal="true" aria-label="동행 초대 대기실">
      <header>
        <div><small>WALK TOGETHER</small><h2>동행 초대 대기실</h2></div>
        <button type="button" aria-label="동행 대기실 닫기" onClick={onClose}><X aria-hidden="true" /></button>
      </header>

      <section className="companion-waiting-room__status" data-status={status}>
        {status === "connected" ? <Check aria-hidden="true" /> : <UsersRound aria-hidden="true" />}
        <div><strong>{nickname}님 · {zoneLabel}</strong><span>{statusLabel}</span></div>
      </section>

      <div className="companion-waiting-room__qr" data-expired={expired || undefined}>
        {qrDataUrl ? <img src={qrDataUrl} alt="동행 초대 QR 코드" /> : <QrCode aria-label="QR 코드 준비 중" />}
        {expired ? <strong>초대 시간이 끝났어요</strong> : null}
      </div>

      <div className="companion-waiting-room__expiry" role="timer" aria-live="polite">
        <Clock3 aria-hidden="true" />
        <span>남은 초대 시간</span>
        <strong>{companionInviteRemainingLabel(expiresAt, now)}</strong>
      </div>

      {expired ? (
        <button type="button" className="companion-waiting-room__renew" onClick={onRenew}>
          <RefreshCw aria-hidden="true" />새 초대 만들기
        </button>
      ) : (
        <div className="companion-waiting-room__actions">
          <button type="button" onClick={() => void runAction("copy")}><Copy aria-hidden="true" />링크 복사</button>
          <button type="button" onClick={() => void runAction("share")}><Send aria-hidden="true" />공유하기</button>
        </div>
      )}

      <p className="companion-waiting-room__notice" role="status">
        <Link2 aria-hidden="true" />
        {actionStatus === "copied" ? "초대 링크를 복사했어요."
          : actionStatus === "shared" ? "공유 앱으로 초대 링크를 보냈어요."
            : actionStatus === "error" ? "링크를 보내지 못했어요. 다시 시도해 주세요."
              : "QR 코드와 링크는 표시된 시간까지만 사용할 수 있어요."}
      </p>
    </div>
  );
}
