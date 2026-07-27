import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";
import { fetchInvitationPerformanceConfig } from "../api/performanceConfigApi";
import { networkConnection, type NetworkConnectionLike } from "./networkQuality";
import { createFrameQualityMonitor } from "./frameQualityMonitor";
import { createFpsSampler } from "./realUserPerformance";

export type DevicePerformanceMode = "standard" | "lite";
export type DevicePerformanceReason = "standard" | "memory" | "processor" | "network" | "frame-rate";

export type DevicePerformanceStatus = {
  mode: DevicePerformanceMode;
  reason: DevicePerformanceReason;
};

export type DevicePerformanceContextValue = DevicePerformanceStatus & {
  reportAnimationFrame: (now: number) => void;
  tuningSource: "default" | "observed";
  tuningSampleCount: number;
};

export type DeviceNavigatorLike = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
};

export function resolveDevicePerformanceStatus(source: DeviceNavigatorLike = navigator): DevicePerformanceStatus {
  if (typeof source.deviceMemory === "number" && source.deviceMemory > 0 && source.deviceMemory <= 4) {
    return { mode: "lite", reason: "memory" };
  }
  if (typeof source.hardwareConcurrency === "number" && source.hardwareConcurrency > 0 && source.hardwareConcurrency <= 4) {
    return { mode: "lite", reason: "processor" };
  }
  const connection = networkConnection(source);
  if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
    return { mode: "lite", reason: "network" };
  }
  return { mode: "standard", reason: "standard" };
}

const DevicePerformanceContext = createContext<DevicePerformanceContextValue>({
  mode: "standard",
  reason: "standard",
  reportAnimationFrame: () => undefined,
  tuningSource: "default",
  tuningSampleCount: 0
});

export function DevicePerformanceProvider({ children }: { children: ReactNode }) {
  const [baseStatus, setBaseStatus] = useState(() => resolveDevicePerformanceStatus());
  const [frameConstrained, setFrameConstrained] = useState(false);
  const [tuning, setTuning] = useState<{ source: "default" | "observed"; sampleCount: number }>({
    source: "default",
    sampleCount: 0
  });
  const frameMonitorRef = useRef(createFrameQualityMonitor());
  const fpsSamplerRef = useRef(createFpsSampler());
  const statusRef = useRef<DevicePerformanceStatus>(baseStatus);
  const previousStatusRef = useRef<DevicePerformanceStatus | null>(null);

  useEffect(() => {
    const update = () => setBaseStatus(resolveDevicePerformanceStatus());
    const connection = networkConnection();
    connection?.addEventListener?.("change", update);
    update();
    return () => connection?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchInvitationPerformanceConfig().then((config) => {
      if (!active) return;
      frameMonitorRef.current = createFrameQualityMonitor({
        slowFpsThreshold: config.slowFpsThreshold,
        recoveryFpsThreshold: config.recoveryFpsThreshold,
        slowWindowsRequired: config.slowWindowsRequired,
        recoveryWindowsRequired: config.recoveryWindowsRequired
      });
      setFrameConstrained(false);
      setTuning({ source: config.source, sampleCount: config.sampleCount });
    }).catch(() => {
      // The static defaults remain active when remote tuning is unavailable.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (baseStatus.mode === "standard") return;
    frameMonitorRef.current.reset();
    setFrameConstrained(false);
  }, [baseStatus.mode]);

  const reportAnimationFrame = useCallback((now: number) => {
    const fps = fpsSamplerRef.current.sample(now);
    if (fps !== null) {
      const current = statusRef.current;
      trackInvitationAnalytics("performance_fps", `${current.mode}:${current.reason}`, fps);
    }
    if (baseStatus.mode !== "standard") return;
    const decision = frameMonitorRef.current.sample(now);
    if (decision === "downgrade") setFrameConstrained(true);
    if (decision === "restore") setFrameConstrained(false);
  }, [baseStatus.mode]);

  const status: DevicePerformanceStatus = frameConstrained
    ? { mode: "lite", reason: "frame-rate" }
    : baseStatus;
  statusRef.current = status;

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;
    if (!previous || (previous.mode === status.mode && previous.reason === status.reason)) return;
    trackInvitationAnalytics("performance_quality_change", `${status.mode}:${status.reason}`);
  }, [status]);

  useEffect(() => {
    document.documentElement.dataset.performanceMode = status.mode;
    document.documentElement.dataset.performanceReason = status.reason;
    return () => {
      delete document.documentElement.dataset.performanceMode;
      delete document.documentElement.dataset.performanceReason;
    };
  }, [status]);

  const value = useMemo(() => ({
    ...status,
    reportAnimationFrame,
    tuningSource: tuning.source,
    tuningSampleCount: tuning.sampleCount
  }), [reportAnimationFrame, status, tuning]);
  return <DevicePerformanceContext.Provider value={value}>{children}</DevicePerformanceContext.Provider>;
}

export function useDevicePerformance(): DevicePerformanceContextValue {
  return useContext(DevicePerformanceContext);
}
