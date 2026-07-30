import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trackInvitationAnalytics } from "../analytics/invitationAnalytics";
import { fetchInvitationPerformanceConfig } from "../api/performanceConfigApi";
import { networkConnection, type NetworkConnectionLike } from "./networkQuality";
import { createFrameQualityMonitor } from "./frameQualityMonitor";
import { createFpsSampler } from "./realUserPerformance";

export type DevicePerformanceMode = "standard" | "lite";
export type DevicePerformanceReason = "standard" | "memory" | "processor" | "network" | "frame-rate" | "battery" | "background";
export type DeviceEffectsQuality = "full" | "reduced" | "minimal";
export type DeviceEffectsPreference = "auto" | DeviceEffectsQuality;
export type DeviceEnergySavingReason = "none" | "battery" | "background";

export type DevicePerformanceStatus = {
  mode: DevicePerformanceMode;
  reason: DevicePerformanceReason;
};

export type DevicePerformanceContextValue = DevicePerformanceStatus & {
  effectsQuality: DeviceEffectsQuality;
  autoEffectsQuality: DeviceEffectsQuality;
  effectsPreference: DeviceEffectsPreference;
  setEffectsPreference: (preference: DeviceEffectsPreference) => void;
  reportAnimationFrame: (now: number) => void;
  energySavingReason: DeviceEnergySavingReason;
  batteryLevel: number | null;
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

type BatteryManagerLike = {
  charging: boolean;
  level: number;
  addEventListener?: (type: "chargingchange" | "levelchange", listener: () => void) => void;
  removeEventListener?: (type: "chargingchange" | "levelchange", listener: () => void) => void;
};

type BatteryNavigatorLike = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

type EffectsPreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export const effectsPreferenceStorageKey = "wedding-map-effects-quality:v1";

function effectsPreferenceStorage(): EffectsPreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadEffectsPreference(
  storage: EffectsPreferenceStorage | null = effectsPreferenceStorage()
): DeviceEffectsPreference {
  try {
    const value = storage?.getItem(effectsPreferenceStorageKey);
    return value === "full" || value === "reduced" || value === "minimal" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function saveEffectsPreference(
  preference: DeviceEffectsPreference,
  storage: EffectsPreferenceStorage | null = effectsPreferenceStorage()
): boolean {
  try {
    storage?.setItem(effectsPreferenceStorageKey, preference);
    return storage !== null;
  } catch {
    return false;
  }
}

const effectsQualityRank: Record<DeviceEffectsQuality, number> = {
  minimal: 0,
  reduced: 1,
  full: 2
};

export function resolvePreferredEffectsQuality(
  automatic: DeviceEffectsQuality,
  preference: DeviceEffectsPreference
): DeviceEffectsQuality {
  if (preference === "auto") return automatic;
  return effectsQualityRank[preference] < effectsQualityRank[automatic] ? preference : automatic;
}

export function resolveEnergySavingEffectsQuality(
  quality: DeviceEffectsQuality,
  reason: DeviceEnergySavingReason,
  batteryLevel: number | null
): DeviceEffectsQuality {
  if (reason === "background") return "minimal";
  if (reason !== "battery") return quality;
  const limit: DeviceEffectsQuality = batteryLevel !== null && batteryLevel <= 0.1 ? "minimal" : "reduced";
  return effectsQualityRank[limit] < effectsQualityRank[quality] ? limit : quality;
}

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
  effectsQuality: "full",
  autoEffectsQuality: "full",
  effectsPreference: "auto",
  setEffectsPreference: () => undefined,
  reportAnimationFrame: () => undefined,
  energySavingReason: "none",
  batteryLevel: null,
  tuningSource: "default",
  tuningSampleCount: 0
});

export function DevicePerformanceProvider({
  children,
  initialEffectsPreference
}: {
  children: ReactNode;
  initialEffectsPreference?: DeviceEffectsPreference;
}) {
  const [baseStatus, setBaseStatus] = useState(() => resolveDevicePerformanceStatus());
  const [observedEffectsQuality, setObservedEffectsQuality] = useState<DeviceEffectsQuality>("full");
  const [effectsPreference, setEffectsPreferenceState] = useState<DeviceEffectsPreference>(() => (
    initialEffectsPreference ?? loadEffectsPreference()
  ));
  const [visibilityState, setVisibilityState] = useState<DocumentVisibilityState>(() => document.visibilityState);
  const [batteryState, setBatteryState] = useState<{ available: boolean; charging: boolean; level: number }>({
    available: false,
    charging: true,
    level: 1
  });
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
    const update = () => setVisibilityState(document.visibilityState);
    document.addEventListener("visibilitychange", update);
    update();
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    const getBattery = (navigator as BatteryNavigatorLike).getBattery;
    if (typeof getBattery !== "function") return;
    let active = true;
    let battery: BatteryManagerLike | null = null;
    const update = () => {
      if (!active || !battery) return;
      setBatteryState({ available: true, charging: battery.charging, level: battery.level });
    };
    void getBattery.call(navigator).then((manager) => {
      if (!active) return;
      battery = manager;
      update();
      battery.addEventListener?.("chargingchange", update);
      battery.addEventListener?.("levelchange", update);
    }).catch(() => undefined);
    return () => {
      active = false;
      battery?.removeEventListener?.("chargingchange", update);
      battery?.removeEventListener?.("levelchange", update);
    };
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
      setObservedEffectsQuality("full");
      setTuning({ source: config.source, sampleCount: config.sampleCount });
    }).catch(() => {
      // The static defaults remain active when remote tuning is unavailable.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (baseStatus.mode === "standard") return;
    frameMonitorRef.current.reset();
    setObservedEffectsQuality("full");
  }, [baseStatus.mode]);

  const reportAnimationFrame = useCallback((now: number) => {
    const fps = fpsSamplerRef.current.sample(now);
    if (fps !== null) {
      const current = statusRef.current;
      trackInvitationAnalytics("performance_fps", `${current.mode}:${current.reason}`, fps);
      if (baseStatus.mode === "standard") {
        if (fps <= 30) setObservedEffectsQuality("minimal");
        else if (fps < 42) setObservedEffectsQuality((quality) => quality === "minimal" ? quality : "reduced");
      }
    }
    if (baseStatus.mode !== "standard") return;
    const decision = frameMonitorRef.current.sample(now);
    if (decision === "downgrade") {
      setObservedEffectsQuality((quality) => quality === "minimal" ? quality : "reduced");
    }
    if (decision === "restore") setObservedEffectsQuality("full");
  }, [baseStatus.mode]);

  const energySavingReason: DeviceEnergySavingReason = visibilityState === "hidden"
    ? "background"
    : batteryState.available && !batteryState.charging && batteryState.level <= 0.2
      ? "battery"
      : "none";
  const deviceEffectsQuality: DeviceEffectsQuality = baseStatus.mode === "lite" ? "minimal" : observedEffectsQuality;
  const autoEffectsQuality = resolveEnergySavingEffectsQuality(
    deviceEffectsQuality,
    energySavingReason,
    batteryState.available ? batteryState.level : null
  );
  const effectsQuality = resolvePreferredEffectsQuality(autoEffectsQuality, effectsPreference);
  const status: DevicePerformanceStatus = energySavingReason === "background"
    ? { mode: "lite", reason: "background" }
    : energySavingReason === "battery"
      ? { mode: baseStatus.mode, reason: "battery" }
    : autoEffectsQuality !== "full" && baseStatus.mode === "standard"
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
    document.documentElement.dataset.effectsQuality = effectsQuality;
    document.documentElement.dataset.effectsPreference = effectsPreference;
    return () => {
      delete document.documentElement.dataset.performanceMode;
      delete document.documentElement.dataset.performanceReason;
      delete document.documentElement.dataset.effectsQuality;
      delete document.documentElement.dataset.effectsPreference;
    };
  }, [effectsPreference, effectsQuality, status]);

  const setEffectsPreference = useCallback((preference: DeviceEffectsPreference) => {
    setEffectsPreferenceState(preference);
    saveEffectsPreference(preference);
  }, []);

  const value = useMemo(() => ({
    ...status,
    effectsQuality,
    autoEffectsQuality,
    effectsPreference,
    setEffectsPreference,
    reportAnimationFrame,
    energySavingReason,
    batteryLevel: batteryState.available ? batteryState.level : null,
    tuningSource: tuning.source,
    tuningSampleCount: tuning.sampleCount
  }), [autoEffectsQuality, batteryState.available, batteryState.level, effectsPreference, effectsQuality, energySavingReason, reportAnimationFrame, setEffectsPreference, status, tuning]);
  return <DevicePerformanceContext.Provider value={value}>{children}</DevicePerformanceContext.Provider>;
}

export function useDevicePerformance(): DevicePerformanceContextValue {
  return useContext(DevicePerformanceContext);
}
