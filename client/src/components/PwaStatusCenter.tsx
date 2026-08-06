import { useEffect, useRef, useState } from "react";
import { CloudOff, Download, LoaderCircle, RefreshCw, Wifi, X } from "lucide-react";
import {
  applyPwaUpdate,
  checkForPwaUpdate,
  getPwaClientSnapshot,
  prepareOfflineGameFeatures,
  retryOfflinePreparation,
  startPwaClient,
  subscribePwaClient,
  type PwaClientSnapshot
} from "../pwa/pwaClient";

type PwaStatusCenterProps = {
  playing: boolean;
  showInstall: boolean;
  showBackgroundProgress?: boolean;
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

export function PwaStatusCenter({
  playing,
  showInstall,
  showBackgroundProgress = false
}: PwaStatusCenterProps) {
  const [client, setClient] = useState<PwaClientSnapshot>(getPwaClientSnapshot);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [recovered, setRecovered] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [featuresPrepared, setFeaturesPrepared] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(installWasDismissed);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);
  const previousCacheState = useRef(client.cacheState);
  const previousFeatureCacheState = useRef(client.featureCacheState);

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
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void checkForPwaUpdate();
    };
    const timer = window.setInterval(check, 30 * 60 * 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
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
    if (previousFeatureCacheState.current === "preparing" && client.featureCacheState === "ready") {
      setFeaturesPrepared(true);
    }
    previousFeatureCacheState.current = client.featureCacheState;
  }, [client.featureCacheState]);

  useEffect(() => {
    if (!featuresPrepared) return;
    const timer = window.setTimeout(() => setFeaturesPrepared(false), 2600);
    return () => window.clearTimeout(timer);
  }, [featuresPrepared]);

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

  const update = async () => {
    setApplyingUpdate(true);
    setUpdateError(false);
    const applied = await applyPwaUpdate();
    if (!applied) {
      setApplyingUpdate(false);
      setUpdateError(true);
    }
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
        <span>
          <strong>{applyingUpdate ? "최신 초대장으로 바꾸는 중" : "새 초대장이 도착했어요"}</strong>
          <small>{updateError ? "잠시 후 다시 눌러주세요" : "작성 중인 내용은 이 기기에 보관돼요"}</small>
        </span>
        <button type="button" disabled={applyingUpdate} onClick={() => { void update(); }}>
          {applyingUpdate ? "적용 중" : updateError ? "다시 적용" : "새 버전 적용"}
        </button>
      </>
    );
  } else if (client.cacheState === "error" && (showInstall || showBackgroundProgress) && !offlineNoticeDismissed) {
    tone = "notice";
    content = (
      <>
        <CloudOff aria-hidden="true" />
        <span><strong>오프라인 저장은 아직 준비 중이에요</strong><small>초대장과 게임은 지금 그대로 이용할 수 있어요</small></span>
        <button type="button" onClick={() => { void retryOfflinePreparation(); }}>저장 재시도</button>
        <button
          type="button"
          className="pwa-status__dismiss"
          aria-label="오프라인 저장 안내 닫기"
          onClick={() => setOfflineNoticeDismissed(true)}
        ><X /></button>
      </>
    );
  } else if (showBackgroundProgress && client.cacheState === "preparing" && client.total > 0) {
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
  } else if (showBackgroundProgress && playing && client.featureCacheState === "error") {
    tone = "error";
    content = (
      <>
        <CloudOff aria-hidden="true" />
        <span><strong>게임 기능 일부가 오프라인 준비 전이에요</strong><small>현재 화면은 계속 이용할 수 있어요</small></span>
        <button type="button" onClick={prepareOfflineGameFeatures}>다시 준비</button>
      </>
    );
  } else if (showBackgroundProgress && playing && client.featureCacheState === "preparing" && client.featureTotal > 0) {
    tone = "preparing";
    const percent = Math.round((client.featureCompleted / client.featureTotal) * 100);
    content = (
      <>
        <div className="pwa-status__icon pwa-status__icon--spinner" aria-hidden="true"><LoaderCircle /></div>
        <span><strong>게임 기능 오프라인 준비 중</strong><small>{percent}% · 사진·수집·동행 기능</small></span>
        <progress max={client.featureTotal} value={client.featureCompleted} aria-label={`게임 기능 오프라인 준비 ${percent}%`} />
      </>
    );
  } else if (recovered) {
    tone = "online";
    content = <><Wifi aria-hidden="true" /><span><strong>연결이 복구됐어요</strong><small>최신 내용을 확인할 수 있어요</small></span></>;
  } else if (showBackgroundProgress && prepared) {
    tone = "online";
    content = <><Wifi aria-hidden="true" /><span><strong>오프라인 준비 완료</strong><small>핵심 초대장을 저장했어요</small></span></>;
  } else if (showBackgroundProgress && playing && featuresPrepared) {
    tone = "online";
    content = <><Wifi aria-hidden="true" /><span><strong>게임 기능 오프라인 준비 완료</strong><small>사진·수집·동행 화면도 저장했어요</small></span></>;
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
