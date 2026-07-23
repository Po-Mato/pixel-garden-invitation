import { useEffect, useRef, useState } from "react";
import { CloudOff, Download, LoaderCircle, RefreshCw, Wifi, X } from "lucide-react";
import {
  applyPwaUpdate,
  checkForPwaUpdate,
  getPwaClientSnapshot,
  startPwaClient,
  subscribePwaClient,
  type PwaClientSnapshot
} from "../pwa/pwaClient";

type PwaStatusCenterProps = {
  playing: boolean;
  showInstall: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const installDismissedKey = "wedding-garden:pwa-install-dismissed:v1";

function installWasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(installDismissedKey) === "true";
  } catch {
    return false;
  }
}

function rememberInstallDismissal() {
  try {
    window.sessionStorage.setItem(installDismissedKey, "true");
  } catch {
    // Installation remains optional when storage is unavailable.
  }
}

export function PwaStatusCenter({ playing, showInstall }: PwaStatusCenterProps) {
  const [client, setClient] = useState<PwaClientSnapshot>(getPwaClientSnapshot);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [recovered, setRecovered] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(installWasDismissed);
  const previousCacheState = useRef(client.cacheState);

  useEffect(() => {
    const unsubscribe = subscribePwaClient(setClient);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let timer: number | null = null;
    let idleId: number | null = null;
    const start = () => { void startPwaClient(); };
    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(start, { timeout: 1_500 });
    } else {
      timer = window.setTimeout(start, 700);
    }
    return () => {
      unsubscribe();
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      setRecovered(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRecovered(true);
      void checkForPwaUpdate();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!recovered) return;
    const timer = window.setTimeout(() => setRecovered(false), 2400);
    return () => window.clearTimeout(timer);
  }, [recovered]);

  useEffect(() => {
    if (previousCacheState.current === "preparing" && client.cacheState === "ready") {
      setPrepared(true);
    }
    previousCacheState.current = client.cacheState;
  }, [client.cacheState]);

  useEffect(() => {
    if (!prepared) return;
    const timer = window.setTimeout(() => setPrepared(false), 2600);
    return () => window.clearTimeout(timer);
  }, [prepared]);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismissInstall = () => {
    rememberInstallDismissal();
    setInstallDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "dismissed") dismissInstall();
    else setInstallPrompt(null);
  };

  let content: React.ReactNode = null;
  let tone = "neutral";
  if (!online) {
    tone = "offline";
    content = <><CloudOff aria-hidden="true" /><span><strong>오프라인 모드</strong><small>저장된 초대장을 보고 있어요</small></span></>;
  } else if (client.updateAvailable) {
    tone = "update";
    content = (
      <>
        <RefreshCw aria-hidden="true" />
        <span><strong>새 초대장이 도착했어요</strong><small>최신 버전으로 바로 바꿀 수 있어요</small></span>
        <button type="button" onClick={() => { void applyPwaUpdate(); }}>새 버전 적용</button>
      </>
    );
  } else if (client.cacheState === "error") {
    tone = "error";
    content = (
      <>
        <CloudOff aria-hidden="true" />
        <span><strong>오프라인 준비를 마치지 못했어요</strong><small>연결 상태를 확인해 주세요</small></span>
        <button type="button" onClick={() => window.location.reload()}>다시 시도</button>
      </>
    );
  } else if (client.cacheState === "preparing" && client.total > 0) {
    tone = "preparing";
    const percent = Math.round((client.completed / client.total) * 100);
    content = (
      <>
        <div className="pwa-status__icon pwa-status__icon--spinner" aria-hidden="true">
          <LoaderCircle />
        </div>
        <span><strong>오프라인 초대장 준비 중</strong><small>{percent}% · {client.completed}/{client.total}</small></span>
        <progress max={client.total} value={client.completed} aria-label={`오프라인 준비 ${percent}%`} />
      </>
    );
  } else if (recovered) {
    tone = "online";
    content = <><Wifi aria-hidden="true" /><span><strong>연결이 복구됐어요</strong><small>최신 내용을 확인할 수 있어요</small></span></>;
  } else if (prepared) {
    tone = "online";
    content = <><Wifi aria-hidden="true" /><span><strong>오프라인 준비 완료</strong><small>핵심 초대장을 저장했어요</small></span></>;
  } else if (showInstall && installPrompt && !installDismissed) {
    tone = "install";
    content = (
      <>
        <Download aria-hidden="true" />
        <span><strong>웨딩 가든 설치</strong><small>홈 화면에서 바로 열기</small></span>
        <button type="button" onClick={() => { void install(); }}>홈 화면에 추가</button>
        <button type="button" className="pwa-status__dismiss" aria-label="설치 안내 닫기" onClick={dismissInstall}><X /></button>
      </>
    );
  }

  if (!content) return null;
  return (
    <aside
      className={`pwa-status-center pwa-status-center--${tone}${playing ? " pwa-status-center--playing" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`pwa-status pwa-status--${tone}`} role="status">{content}</div>
    </aside>
  );
}
